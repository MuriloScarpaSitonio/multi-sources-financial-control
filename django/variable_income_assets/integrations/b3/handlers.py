from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import transaction as djtransaction
from django.utils import timezone

from rest_framework.exceptions import ValidationError as DRFValidationError

from ...adapters.key_value_store import get_dollar_conversion_rate
from ...choices import (
    AssetObjectives,
    AssetTypes,
    Currencies,
    LiquidityTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
)
from ...domain import events
from ...models import Asset, AssetMetaData, PassiveIncome, Transaction
from ...serializers import AssetSerializer, TransactionListSerializer
from ...service_layer import messagebus
from ...service_layer.unit_of_work import DjangoUnitOfWork
from ._workbook import WorkbookSource
from .movimentacao import parse_movements
from .negociacao import (
    parse_fii_positions,
    parse_negotiations,
    parse_stock_positions,
    resolve_negociacao_path,
)
from .parser import parse_positions
from .proventos import parse_proventos, resolve_proventos_path
from .schemas import (
    B3FixedIncomeAction,
    B3FixedIncomeMovement,
    B3FixedIncomePosition,
    B3ProventoType,
    B3StockNegotiation,
    B3StockPosition,
    B3TesouroMovement,
    B3TesouroPosition,
)
from .tesouro import parse_tesouro_movements, parse_tesouro_positions

User = get_user_model()

_POSICAO_FILENAME_RE = re.compile(r"^posicao-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.xlsx$")
_S_A_PATTERN = re.compile(r"\s+S[./]A\.?$", re.IGNORECASE)


class B3ImportError(Exception):
    pass


class _DryRunRollback(Exception):
    pass


def _parse_workbook_dt(path: Path) -> datetime:
    match = _POSICAO_FILENAME_RE.match(path.name)
    if not match:
        raise B3ImportError(
            f"could not parse timestamp from filename {path.name!r}; "
            "expected posicao-YYYY-MM-DD-HH-MM-SS.xlsx"
        )
    return datetime.strptime(match.group(1), "%Y-%m-%d-%H-%M-%S").replace(
        tzinfo=timezone.get_current_timezone()
    )


def _resolve_posicao_path(source: WorkbookSource | None) -> WorkbookSource:
    from .parser import _resolve_path

    return _resolve_path(source)


def _resolve_movimentacao_path(path: WorkbookSource | None) -> WorkbookSource:
    from .movimentacao import _resolve_path

    return _resolve_path(path)


def _source_label(source: WorkbookSource | None) -> str | None:
    """Path strings help in CLI reports; an in-memory upload has no path."""
    if isinstance(source, bytes):
        return None
    return str(source) if source is not None else None


def _validation_message(exc: DRFValidationError) -> str:
    # Flatten a serializer/domain ValidationError to a single readable message,
    # dropping internal field names (e.g. "action" for a sell-exceeds-holdings).
    detail = exc.detail
    if isinstance(detail, dict):
        messages: list = []
        for value in detail.values():
            messages.extend(value if isinstance(value, list | tuple) else [value])
        return "; ".join(str(m) for m in messages)
    if isinstance(detail, list | tuple):
        return "; ".join(str(m) for m in detail)
    return str(detail)


def _build_description(position: B3FixedIncomePosition) -> str:
    base = _S_A_PATTERN.sub("", position.description).strip()
    if position.maturity_date is None:
        return base
    return f"{base} - venc {position.maturity_date.strftime('%d/%m/%Y')}"


def _bulk_fetch_fixed_br_metadata(codes) -> dict[str, AssetMetaData]:
    # The global (B3-synced) metadata row per code, scoped by type+currency and
    # asset__isnull so we never touch a same-code row of another type/currency or
    # a user's direct self-custody metadata (AssetMetaData.code is not unique).
    return {
        metadata.code: metadata
        for metadata in AssetMetaData.objects.filter(
            code__in=set(codes),
            type=AssetTypes.fixed_br,
            currency=Currencies.real,
            asset__isnull=True,
        )
    }


def _bulk_fetch_existing_transactions(asset_ids) -> dict[int, set]:
    # {asset_id: {(action, operation_date, quantity, price)}} for transaction dedup.
    existing: dict[int, set] = defaultdict(set)
    for asset_id, action, operation_date, quantity, price in Transaction.objects.filter(
        asset_id__in=asset_ids
    ).values_list("asset_id", "action", "operation_date", "quantity", "price"):
        existing[asset_id].add((action, operation_date, quantity, price))
    return existing


def _update_existing_price(
    *,
    code: str,
    new_price: Decimal | None,
    workbook_dt: datetime,
    metadata: AssetMetaData | None,
    updates: list[AssetMetaData],
    description: str | None = None,
) -> dict:
    if new_price is None:
        return {
            "code": code,
            "description": description,
            "action": "skipped",
            "reason": "sem preço atual na posição",
        }

    if metadata is None:
        return {
            "code": code,
            "description": description,
            "action": "skipped",
            "reason": "sem metadados do ativo",
        }

    previous_dt = metadata.current_price_updated_at
    if previous_dt is not None and previous_dt >= workbook_dt:
        return {
            "code": code,
            "description": description,
            "action": "price_skipped",
            "reason": "cotação já atualizada (planilha não é mais recente)",
            "metadata_updated_at": previous_dt.isoformat(),
            "workbook_dt": workbook_dt.isoformat(),
        }

    previous_price = metadata.current_price
    metadata.current_price = new_price
    metadata.current_price_updated_at = timezone.now()
    updates.append(metadata)
    return {
        "code": code,
        "description": description,
        "action": "price_updated",
        "previous_price": str(previous_price) if previous_price else None,
        "new_price": str(new_price),
    }


class _RequestContext:
    def __init__(self, user) -> None:
        self.user = user


def _create_asset_and_transactions(
    *,
    user,
    code: str,
    position: B3FixedIncomePosition,
    movements: list[B3FixedIncomeMovement],
) -> dict:
    description = _build_description(position)
    context = {"request": _RequestContext(user)}

    asset_serializer = AssetSerializer(
        data={
            "type": AssetTypes.fixed_br,
            "code": code,
            "currency": Currencies.real,
            "description": description,
            "objective": AssetObjectives.growth,
            "liquidity_type": LiquidityTypes.at_maturity,
            "maturity_date": (
                position.maturity_date.strftime("%d/%m/%Y") if position.maturity_date else None
            ),
        },
        context=context,
    )
    asset_serializer.is_valid(raise_exception=True)
    asset = asset_serializer.save()

    transactions: list[dict] = []
    for movement in sorted(movements, key=lambda m: m.operation_date):
        tx_serializer = TransactionListSerializer(
            data={
                "asset_pk": asset.id,
                "action": movement.action.value,
                "price": str(movement.unit_price),
                "quantity": str(movement.quantity),
                "operation_date": movement.operation_date.strftime("%d/%m/%Y"),
            },
            context=context,
        )
        tx_serializer.is_valid(raise_exception=True)
        tx_serializer.save()
        transactions.append(
            {
                "action": movement.action.value,
                "price": str(movement.unit_price),
                "quantity": str(movement.quantity),
                "operation_date": movement.operation_date.isoformat(),
            }
        )

    return {
        "code": code,
        "action": "created",
        "asset_pk": asset.id,
        "description": description,
        "transactions": transactions,
    }


def _build_tesouro_description(position: B3TesouroPosition) -> str:
    if position.maturity_date is None:
        return position.name
    return f"{position.name} - venc {position.maturity_date.strftime('%d/%m/%Y')}"


def _create_tesouro_asset_and_transactions(
    *,
    user,
    position: B3TesouroPosition,
    movements: list[B3TesouroMovement],
) -> dict:
    description = _build_tesouro_description(position)
    context = {"request": _RequestContext(user)}

    asset_serializer = AssetSerializer(
        data={
            "type": AssetTypes.fixed_br,
            "code": position.isin,
            "currency": Currencies.real,
            "description": description,
            "objective": AssetObjectives.growth,
            "liquidity_type": LiquidityTypes.at_maturity,
            "maturity_date": (
                position.maturity_date.strftime("%d/%m/%Y") if position.maturity_date else None
            ),
        },
        context=context,
    )
    asset_serializer.is_valid(raise_exception=True)
    asset = asset_serializer.save()

    transactions: list[dict] = []
    for movement in sorted(movements, key=lambda m: m.operation_date):
        tx_serializer = TransactionListSerializer(
            data={
                "asset_pk": asset.id,
                "action": movement.action.value,
                "price": str(movement.unit_price),
                "quantity": str(movement.quantity),
                "operation_date": movement.operation_date.strftime("%d/%m/%Y"),
            },
            context=context,
        )
        tx_serializer.is_valid(raise_exception=True)
        tx_serializer.save()
        transactions.append(
            {
                "action": movement.action.value,
                "price": str(movement.unit_price),
                "quantity": str(movement.quantity),
                "operation_date": movement.operation_date.isoformat(),
            }
        )

    return {
        "code": position.isin,
        "name": position.name,
        "action": "created",
        "asset_pk": asset.id,
        "description": description,
        "transactions": transactions,
    }


def _movement_from_position(position: B3FixedIncomePosition) -> B3FixedIncomeMovement | None:
    if position.current_price is None or position.issue_date is None or position.code is None:
        return None
    return B3FixedIncomeMovement(
        kind=position.kind,
        code=position.code,
        action=B3FixedIncomeAction.BUY,
        operation_date=position.issue_date,
        quantity=position.quantity,
        unit_price=position.current_price,
    )


def _renda_fixa_actions(
    *,
    user,
    user_id: int,
    workbook_dt: datetime,
    posicao_path_resolved: Path,
    movimentacao_path_resolved: Path,
    use_posicao_price_when_missing_movement: bool,
    **_,
) -> list[dict]:
    positions = parse_positions(posicao_path_resolved)
    movements = parse_movements(movimentacao_path_resolved)

    movements_by_code: dict[str, list[B3FixedIncomeMovement]] = defaultdict(list)
    for movement in movements:
        movements_by_code[movement.code].append(movement)

    # Bulk-load which codes already exist + their metadata (2 queries) instead of
    # one lookup per position; price writes are batched via bulk_update at the end.
    position_codes = {p.code for p in positions if p.code}
    existing_codes = set(
        Asset.objects.filter(
            user_id=user_id, type=AssetTypes.fixed_br, code__in=position_codes
        ).values_list("code", flat=True)
    )
    metadata_by_code = _bulk_fetch_fixed_br_metadata(existing_codes)
    price_updates: list[AssetMetaData] = []

    actions: list[dict] = []
    for position in positions:
        if not position.code:
            actions.append(
                {
                    "code": None,
                    "action": "skipped",
                    "reason": "posição sem código",
                    "description": position.description,
                }
            )
            continue

        if position.code in existing_codes:
            actions.append(
                _update_existing_price(
                    code=position.code,
                    new_price=position.current_price,
                    workbook_dt=workbook_dt,
                    metadata=metadata_by_code.get(position.code),
                    updates=price_updates,
                    description=_build_description(position),
                )
            )
            continue

        code_movements = movements_by_code.get(position.code, [])
        if not code_movements:
            if not use_posicao_price_when_missing_movement:
                actions.append(
                    {
                        "code": position.code,
                        "action": "skipped",
                        "reason": "ativo não cadastrado e sem linha de movimentação",
                    }
                )
                continue
            fallback = _movement_from_position(position)
            if fallback is None:
                actions.append(
                    {
                        "code": position.code,
                        "action": "skipped",
                        "reason": "posição sem preço/data de emissão para usar como movimentação",
                    }
                )
                continue
            code_movements = [fallback]

        actions.append(
            _create_asset_and_transactions(
                user=user,
                code=position.code,
                position=position,
                movements=code_movements,
            )
        )

    if price_updates:
        AssetMetaData.objects.bulk_update(
            price_updates, ["current_price", "current_price_updated_at"]
        )
    return actions


def _create_missing_transactions(
    *, user, asset, movements: list[B3TesouroMovement], existing: set
) -> list[dict]:
    context = {"request": _RequestContext(user)}
    created: list[dict] = []
    for movement in sorted(movements, key=lambda m: m.operation_date):
        key = (movement.action.value, movement.operation_date, movement.quantity, movement.unit_price)
        if key in existing:
            continue

        tx_serializer = TransactionListSerializer(
            data={
                "asset_pk": asset.id,
                "action": movement.action.value,
                "price": str(movement.unit_price),
                "quantity": str(movement.quantity),
                "operation_date": movement.operation_date.strftime("%d/%m/%Y"),
            },
            context=context,
        )
        tx_serializer.is_valid(raise_exception=True)
        tx_serializer.save()
        created.append(
            {
                "code": asset.code,
                "description": asset.description,
                "action": "transaction_created",
                "asset_pk": asset.id,
                "transaction": {
                    "action": movement.action.value,
                    "price": str(movement.unit_price),
                    "quantity": str(movement.quantity),
                    "operation_date": movement.operation_date.isoformat(),
                },
            }
        )
    return created


def _tesouro_actions(
    *,
    user,
    user_id: int,
    workbook_dt: datetime,
    posicao_path_resolved: Path,
    movimentacao_path_resolved: Path,
    **_,
) -> list[dict]:
    td_positions = parse_tesouro_positions(posicao_path_resolved)
    td_movements = parse_tesouro_movements(movimentacao_path_resolved)

    td_by_name: dict[str, list[B3TesouroMovement]] = defaultdict(list)
    for td_movement in td_movements:
        td_by_name[td_movement.name].append(td_movement)

    # Bulk-load existing assets, their metadata, and their transactions (for dedup)
    # up front; batch the price writes via bulk_update at the end.
    existing_assets_by_isin = {
        asset.code: asset
        for asset in Asset.objects.filter(
            user_id=user_id,
            type=AssetTypes.fixed_br,
            code__in={p.isin for p in td_positions},
        )
    }
    metadata_by_code = _bulk_fetch_fixed_br_metadata(existing_assets_by_isin)
    existing_tx_by_asset = _bulk_fetch_existing_transactions(
        [asset.id for asset in existing_assets_by_isin.values()]
    )
    price_updates: list[AssetMetaData] = []

    actions: list[dict] = []
    for td_position in td_positions:
        existing_asset = existing_assets_by_isin.get(td_position.isin)
        if existing_asset is not None:
            actions.append(
                _update_existing_price(
                    code=td_position.isin,
                    new_price=td_position.current_price,
                    workbook_dt=workbook_dt,
                    metadata=metadata_by_code.get(td_position.isin),
                    updates=price_updates,
                    description=_build_tesouro_description(td_position),
                )
            )
            actions.extend(
                _create_missing_transactions(
                    user=user,
                    asset=existing_asset,
                    movements=td_by_name.get(td_position.name, []),
                    existing=existing_tx_by_asset[existing_asset.id],
                )
            )
            continue

        td_code_movements = td_by_name.get(td_position.name, [])
        if not td_code_movements:
            actions.append(
                {
                    "code": td_position.isin,
                    "description": _build_tesouro_description(td_position),
                    "action": "skipped",
                    "reason": "ativo não cadastrado e sem linha de movimentação",
                }
            )
            continue

        actions.append(
            _create_tesouro_asset_and_transactions(
                user=user, position=td_position, movements=td_code_movements
            )
        )

    if price_updates:
        AssetMetaData.objects.bulk_update(
            price_updates, ["current_price", "current_price_updated_at"]
        )
    return actions


def _run_with_rollback(
    *,
    user_id: int,
    dry_run: bool,
    posicao_path: str | None,
    pipelines: list,
    workbook_dt: datetime | None = None,
) -> dict:
    posicao_path_resolved = _resolve_posicao_path(posicao_path)
    if workbook_dt is None:
        workbook_dt = _parse_workbook_dt(posicao_path_resolved)
    user = User.objects.get(pk=user_id)

    actions: list[dict] = []
    try:
        with djtransaction.atomic():
            for pipeline in pipelines:
                actions.extend(
                    pipeline(
                        user=user,
                        user_id=user_id,
                        workbook_dt=workbook_dt,
                        posicao_path_resolved=posicao_path_resolved,
                    )
                )
            if dry_run:
                raise _DryRunRollback
    except _DryRunRollback:
        pass

    return {
        "dry_run": dry_run,
        "workbook_dt": workbook_dt.isoformat(),
        "posicao_path": _source_label(posicao_path_resolved),
        "actions": actions,
    }


def _create_negociacao_asset(*, user, position: B3StockPosition) -> int:
    context = {"request": _RequestContext(user)}
    asset_serializer = AssetSerializer(
        data={
            "type": position.type,
            "code": position.code,
            "currency": Currencies.real,
            "description": position.description.strip(),
            "objective": AssetObjectives.growth,
        },
        context=context,
    )
    asset_serializer.is_valid(raise_exception=True)
    return asset_serializer.save().id


def _create_transaction(
    *, user, asset_pk: int, negotiation: B3StockNegotiation
) -> None:
    tx_serializer = TransactionListSerializer(
        data={
            "asset_pk": asset_pk,
            "action": negotiation.action.value,
            "price": str(negotiation.price),
            "quantity": str(negotiation.quantity),
            "operation_date": negotiation.operation_date.strftime("%d/%m/%Y"),
        },
        context={"request": _RequestContext(user)},
    )
    tx_serializer.is_valid(raise_exception=True)
    tx_serializer.save()


def _negociacao_actions(
    *,
    user,
    user_id: int,
    negociacao_path_resolved: Path,
    posicao_path_resolved: Path | None,
) -> list[dict]:
    negotiations = parse_negotiations(negociacao_path_resolved)
    by_code: dict[str, list[B3StockNegotiation]] = defaultdict(list)
    for negotiation in negotiations:
        by_code[negotiation.code].append(negotiation)

    position_by_code: dict[str, B3StockPosition] = {}
    if posicao_path_resolved is not None:
        for position in parse_stock_positions(
            posicao_path_resolved, asset_type=AssetTypes.stock
        ):
            position_by_code[position.code] = position
        for position in parse_fii_positions(
            posicao_path_resolved, asset_type=AssetTypes.fii
        ):
            position_by_code[position.code] = position

    # Bulk-load the existing assets (by code) and their transactions (for dedup)
    # up front instead of one query per code.
    assets_by_code: dict[str, Asset] = {}
    for asset in Asset.objects.filter(
        user_id=user_id, code__in=set(by_code)
    ).order_by("id"):
        assets_by_code.setdefault(asset.code, asset)
    existing_tx_by_asset = _bulk_fetch_existing_transactions(
        [asset.id for asset in assets_by_code.values()]
    )

    actions: list[dict] = []

    for code, code_negotiations in by_code.items():
        asset = assets_by_code.get(code)
        asset_action: dict | None = None

        if asset is None:
            position = position_by_code.get(code)
            if position is None:
                reason = (
                    "ativo não cadastrado e sem linha correspondente na posição"
                    if posicao_path_resolved is not None
                    else (
                        "ativo não cadastrado; marque 'Criar ativos ausentes' "
                        "e envie a posição para criá-lo"
                    )
                )
                actions.append({"code": code, "action": "skipped", "reason": reason})
                continue

            new_asset_pk = _create_negociacao_asset(user=user, position=position)
            asset_action = {
                "code": code,
                "type": position.type,
                "action": "asset_created",
                "asset_pk": new_asset_pk,
                "description": position.description.strip(),
            }
            actions.append(asset_action)
            asset_pk = new_asset_pk
            existing: set = set()
            description = position.description.strip()
        else:
            asset_pk = asset.id
            description = asset.description
            existing = existing_tx_by_asset[asset.id]

        # Apply chronologically: B3 reports list trades most-recent-first, but the
        # domain enforces a running balance (no selling more than held).
        for negotiation in sorted(code_negotiations, key=lambda n: n.operation_date):
            key = (
                negotiation.action.value,
                negotiation.operation_date,
                negotiation.quantity,
                negotiation.price,
            )
            if key in existing:
                continue

            tx_payload = {
                "action": negotiation.action.value,
                "price": str(negotiation.price),
                "quantity": str(negotiation.quantity),
                "operation_date": negotiation.operation_date.isoformat(),
            }
            try:
                with djtransaction.atomic():
                    _create_transaction(user=user, asset_pk=asset_pk, negotiation=negotiation)
            except DRFValidationError as exc:
                # e.g. a sell that exceeds holdings (partial history). Skip it and
                # report it instead of aborting the whole import.
                actions.append(
                    {
                        "code": code,
                        "description": description,
                        "action": "error",
                        "reason": _validation_message(exc),
                        "transaction": tx_payload,
                    }
                )
                continue

            actions.append(
                {
                    "code": code,
                    "description": description,
                    "action": "transaction_created",
                    "asset_pk": asset_pk,
                    "transaction": tx_payload,
                }
            )

    return actions


def _make_renda_fixa_pipeline(
    *,
    movimentacao_path: str | None,
    use_posicao_price_when_missing_movement: bool,
):
    movimentacao_resolved = _resolve_movimentacao_path(movimentacao_path)

    def pipeline(**kw):
        return _renda_fixa_actions(
            movimentacao_path_resolved=movimentacao_resolved,
            use_posicao_price_when_missing_movement=use_posicao_price_when_missing_movement,
            **kw,
        )

    return pipeline


def _make_tesouro_pipeline(*, movimentacao_path: str | None):
    movimentacao_resolved = _resolve_movimentacao_path(movimentacao_path)

    def pipeline(**kw):
        return _tesouro_actions(movimentacao_path_resolved=movimentacao_resolved, **kw)

    return pipeline


def import_b3_renda_fixa_positions(
    *,
    user_id: int,
    dry_run: bool = True,
    use_posicao_price_when_missing_movement: bool = False,
    posicao_path: str | None = None,
    movimentacao_path: str | None = None,
    workbook_dt: datetime | None = None,
) -> dict:
    return _run_with_rollback(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao_path,
        workbook_dt=workbook_dt,
        pipelines=[
            _make_renda_fixa_pipeline(
                movimentacao_path=movimentacao_path,
                use_posicao_price_when_missing_movement=use_posicao_price_when_missing_movement,
            )
        ],
    )


def import_b3_tesouro_positions(
    *,
    user_id: int,
    dry_run: bool = True,
    posicao_path: str | None = None,
    movimentacao_path: str | None = None,
    workbook_dt: datetime | None = None,
) -> dict:
    return _run_with_rollback(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao_path,
        workbook_dt=workbook_dt,
        pipelines=[_make_tesouro_pipeline(movimentacao_path=movimentacao_path)],
    )


def import_b3_negociacoes(
    *,
    user_id: int,
    dry_run: bool = True,
    create_missing_assets: bool = False,
    negociacao_path: str | None = None,
    posicao_path: str | None = None,
) -> dict:
    user = User.objects.get(pk=user_id)
    negociacao_resolved = resolve_negociacao_path(negociacao_path)
    posicao_resolved = _resolve_posicao_path(posicao_path) if create_missing_assets else None

    actions: list[dict] = []
    try:
        with djtransaction.atomic():
            actions = _negociacao_actions(
                user=user,
                user_id=user_id,
                negociacao_path_resolved=negociacao_resolved,
                posicao_path_resolved=posicao_resolved,
            )
            if dry_run:
                raise _DryRunRollback
    except _DryRunRollback:
        pass

    return {
        "dry_run": dry_run,
        "negociacao_path": _source_label(negociacao_resolved),
        "posicao_path": _source_label(posicao_resolved),
        "actions": actions,
    }


def import_b3_fixed_income_positions(
    *,
    user_id: int,
    dry_run: bool = True,
    use_posicao_price_when_missing_movement: bool = False,
    posicao_path: str | None = None,
    movimentacao_path: str | None = None,
    workbook_dt: datetime | None = None,
) -> dict:
    return _run_with_rollback(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao_path,
        workbook_dt=workbook_dt,
        pipelines=[
            _make_renda_fixa_pipeline(
                movimentacao_path=movimentacao_path,
                use_posicao_price_when_missing_movement=use_posicao_price_when_missing_movement,
            ),
            _make_tesouro_pipeline(movimentacao_path=movimentacao_path),
        ],
    )


_PROVENTO_TYPE_MAP = {
    B3ProventoType.DIVIDENDO: PassiveIncomeTypes.dividend,
    B3ProventoType.JSCP: PassiveIncomeTypes.jcp,
    B3ProventoType.RENDIMENTO: PassiveIncomeTypes.income,
    B3ProventoType.REEMBOLSO: PassiveIncomeTypes.reimbursement,
}


def _proventos_actions(*, user_id: int, proventos_path_resolved) -> list[dict]:
    proventos = parse_proventos(proventos_path_resolved)
    if not proventos:
        return []

    # Bulk-load every involved asset and their existing credited incomes (2 queries
    # total) instead of querying per row; persist with a single bulk_create.
    assets_by_code = {
        asset.code: asset
        for asset in Asset.objects.filter(
            user_id=user_id, code__in={p.code for p in proventos}
        )
    }
    existing = set(
        PassiveIncome.objects.filter(
            asset_id__in=[a.id for a in assets_by_code.values()],
            event_type=PassiveIncomeEventTypes.credited,
        ).values_list("asset_id", "type", "operation_date", "amount")
    )

    today = timezone.localdate()
    actions: list[dict] = []
    to_create: list[PassiveIncome] = []

    for provento in proventos:
        asset = assets_by_code.get(provento.code)
        if asset is None:
            actions.append(
                {"code": provento.code, "action": "skipped", "reason": "ativo não cadastrado"}
            )
            continue

        income_type = _PROVENTO_TYPE_MAP[provento.kind]
        base = {
            "code": provento.code,
            "description": asset.description,
            "income": {
                "type": income_type,
                "amount": str(provento.amount),
                "currency": asset.currency,
                "operation_date": provento.payment_date.isoformat(),
            },
        }

        key = (asset.id, income_type, provento.payment_date, provento.amount)
        if key in existing:
            actions.append(
                {**base, "action": "already_exists", "reason": "provento já cadastrado"}
            )
            continue
        if provento.payment_date > today:
            actions.append(
                {
                    **base,
                    "action": "error",
                    "reason": "rendimento creditado não pode estar no futuro",
                }
            )
            continue
        choice = AssetTypes.get_choice(asset.type)
        if not choice.accept_incomes:
            actions.append(
                {
                    **base,
                    "action": "error",
                    "reason": f"ativos de classe {choice.label} não aceitam rendimentos",
                }
            )
            continue

        to_create.append(
            PassiveIncome(
                asset=asset,
                type=income_type,
                event_type=PassiveIncomeEventTypes.credited,
                amount=provento.amount,
                operation_date=provento.payment_date,
                current_currency_conversion_rate=(
                    Decimal("1")
                    if asset.currency == Currencies.real
                    else get_dollar_conversion_rate()
                ),
            )
        )
        existing.add(key)  # also dedupe duplicate rows within the same file
        actions.append({**base, "action": "income_created", "asset_pk": asset.id})

    if to_create:
        PassiveIncome.objects.bulk_create(to_create)
        # bulk_create skips the messagebus, so upsert each affected asset's read
        # model once (PassiveIncomeCreated -> upsert_read_model, aggregate fields).
        for affected_asset_id in {income.asset_id for income in to_create}:
            with DjangoUnitOfWork(asset_pk=affected_asset_id) as uow:
                messagebus.handle(
                    message=events.PassiveIncomeCreated(asset_pk=affected_asset_id),
                    uow=uow,
                )

    return actions


def import_b3_proventos(
    *,
    user_id: int,
    dry_run: bool = True,
    proventos_path: str | None = None,
) -> dict:
    proventos_resolved = resolve_proventos_path(proventos_path)

    actions: list[dict] = []
    try:
        with djtransaction.atomic():
            actions = _proventos_actions(
                user_id=user_id, proventos_path_resolved=proventos_resolved
            )
            if dry_run:
                raise _DryRunRollback
    except _DryRunRollback:
        pass

    return {
        "dry_run": dry_run,
        "proventos_path": _source_label(proventos_resolved),
        "actions": actions,
    }


def format_report(report: dict) -> str:
    lines: list[str] = []
    label = "DRY RUN" if report["dry_run"] else "APPLIED"
    lines.append(f"B3 import — {label}")
    if "workbook_dt" in report:
        lines.append(f"  workbook: {report['workbook_dt']}")
    if "posicao_path" in report:
        lines.append(f"  posicao:  {report['posicao_path']}")
    if "negociacao_path" in report:
        lines.append(f"  negociacao: {report['negociacao_path']}")
    if "proventos_path" in report:
        lines.append(f"  proventos: {report['proventos_path']}")
    lines.append("")

    counts: dict[str, int] = defaultdict(int)
    for action in report["actions"]:
        counts[action["action"]] += 1
    summary = "  ".join(f"{name}={count}" for name, count in sorted(counts.items()))
    lines.append(f"summary: {summary}  total={len(report['actions'])}")
    lines.append("")

    code_w = max((len(str(a.get("code") or "—")) for a in report["actions"]), default=4)
    action_w = max((len(a["action"]) for a in report["actions"]), default=6)
    header = f"  {'CODE':<{code_w}}  {'ACTION':<{action_w}}  DETAILS"
    lines.append(header)
    lines.append("  " + "-" * (len(header) - 2))

    for entry in report["actions"]:
        code = str(entry.get("code") or "—")
        action_name = entry["action"]
        detail = _format_action_detail(entry)
        lines.append(f"  {code:<{code_w}}  {action_name:<{action_w}}  {detail}")

    return "\n".join(lines)


def _format_action_detail(entry: dict) -> str:
    action = entry["action"]
    if action == "price_updated":
        return f"{entry.get('previous_price', '—')} -> {entry['new_price']}"
    if action == "price_skipped":
        return f"metadata @ {entry['metadata_updated_at']} >= workbook"
    if action in ("skipped", "already_exists"):
        return entry.get("reason", "")
    if action == "created":
        head = f"asset #{entry['asset_pk']}  {entry['description']}"
        tx_lines = [
            f"      {tx['action']} {tx['quantity']} @ {tx['price']} on {tx['operation_date']}"
            for tx in entry.get("transactions", [])
        ]
        return "\n".join([head, *tx_lines])
    if action == "transaction_created":
        tx = entry["transaction"]
        return f"{tx['action']} {tx['quantity']} @ {tx['price']} on {tx['operation_date']}"
    if action == "income_created":
        inc = entry["income"]
        return f"{inc['type']} {inc['amount']} on {inc['operation_date']}"
    if action == "error":
        return entry.get("reason", "")
    if action == "exists":
        return f"already in DB ({entry.get('type', '')})"
    if action == "asset_created":
        return f"#{entry['asset_pk']}  {entry.get('type', '')}  {entry.get('description', '')}"
    return ""


def print_report(report: dict) -> None:
    print(format_report(report))
