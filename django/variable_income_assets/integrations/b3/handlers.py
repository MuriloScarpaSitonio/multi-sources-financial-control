from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import transaction as djtransaction
from django.utils import timezone

from ...choices import AssetObjectives, AssetTypes, Currencies, LiquidityTypes
from ...models import Asset, AssetMetaData, Transaction
from ...scripts import update_asset_metadata_current_price
from ...serializers import AssetSerializer, TransactionListSerializer
from .movimentacao import parse_movements
from .negociacao import (
    parse_fii_positions,
    parse_negotiations,
    parse_stock_positions,
    resolve_negociacao_path,
)
from .parser import parse_positions
from .schemas import (
    B3FixedIncomeAction,
    B3FixedIncomeMovement,
    B3FixedIncomePosition,
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


def _resolve_posicao_path(path: str | None) -> Path:
    from .parser import _resolve_path

    return _resolve_path(path)


def _resolve_movimentacao_path(path: str | None) -> Path:
    from .movimentacao import _resolve_path

    return _resolve_path(path)


def _build_description(position: B3FixedIncomePosition) -> str:
    base = _S_A_PATTERN.sub("", position.description).strip()
    if position.maturity_date is None:
        return base
    return f"{base} - venc {position.maturity_date.strftime('%d/%m/%Y')}"


def _update_existing_price(
    *, code: str, new_price: Decimal | None, workbook_dt: datetime
) -> dict:
    if new_price is None:
        return {"code": code, "action": "skipped", "reason": "no current_price in posicao"}

    metadata = AssetMetaData.objects.filter(code=code).first()
    if metadata is None:
        return {"code": code, "action": "skipped", "reason": "no AssetMetaData row"}

    previous_dt = metadata.current_price_updated_at
    if previous_dt is not None and previous_dt >= workbook_dt:
        return {
            "code": code,
            "action": "price_skipped",
            "reason": "metadata is at least as fresh as workbook",
            "metadata_updated_at": previous_dt.isoformat(),
            "workbook_dt": workbook_dt.isoformat(),
        }

    update_asset_metadata_current_price(code=code, price=new_price)
    return {
        "code": code,
        "action": "price_updated",
        "previous_price": str(metadata.current_price) if metadata.current_price else None,
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
    for movement in movements:
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
    for movement in movements:
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
    positions = parse_positions(str(posicao_path_resolved))
    movements = parse_movements(str(movimentacao_path_resolved))

    movements_by_code: dict[str, list[B3FixedIncomeMovement]] = defaultdict(list)
    for movement in movements:
        movements_by_code[movement.code].append(movement)

    actions: list[dict] = []
    for position in positions:
        if not position.code:
            actions.append(
                {
                    "code": None,
                    "action": "skipped",
                    "reason": "position has no code",
                    "description": position.description,
                }
            )
            continue

        if Asset.objects.filter(
            user_id=user_id, code=position.code, type=AssetTypes.fixed_br
        ).exists():
            actions.append(
                _update_existing_price(
                    code=position.code,
                    new_price=position.current_price,
                    workbook_dt=workbook_dt,
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
                        "reason": "asset not in DB and no movimentação row",
                    }
                )
                continue
            fallback = _movement_from_position(position)
            if fallback is None:
                actions.append(
                    {
                        "code": position.code,
                        "action": "skipped",
                        "reason": "fallback requested but posicao is missing price/issue_date",
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

    return actions


def _create_missing_transactions(
    *, user, asset, movements: list[B3TesouroMovement]
) -> list[dict]:
    existing = set(
        Transaction.objects.filter(asset=asset).values_list(
            "action", "operation_date", "quantity", "price"
        )
    )
    context = {"request": _RequestContext(user)}
    created: list[dict] = []
    for movement in movements:
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
    td_positions = parse_tesouro_positions(str(posicao_path_resolved))
    td_movements = parse_tesouro_movements(str(movimentacao_path_resolved))

    td_by_name: dict[str, list[B3TesouroMovement]] = defaultdict(list)
    for td_movement in td_movements:
        td_by_name[td_movement.name].append(td_movement)

    actions: list[dict] = []
    for td_position in td_positions:
        existing_asset = Asset.objects.filter(
            user_id=user_id, code=td_position.isin, type=AssetTypes.fixed_br
        ).first()
        if existing_asset is not None:
            actions.append(
                _update_existing_price(
                    code=td_position.isin,
                    new_price=td_position.current_price,
                    workbook_dt=workbook_dt,
                )
            )
            actions.extend(
                _create_missing_transactions(
                    user=user,
                    asset=existing_asset,
                    movements=td_by_name.get(td_position.name, []),
                )
            )
            continue

        td_code_movements = td_by_name.get(td_position.name, [])
        if not td_code_movements:
            actions.append(
                {
                    "code": td_position.isin,
                    "name": td_position.name,
                    "action": "skipped",
                    "reason": "asset not in DB and no movimentação row",
                }
            )
            continue

        actions.append(
            _create_tesouro_asset_and_transactions(
                user=user, position=td_position, movements=td_code_movements
            )
        )

    return actions


def _run_with_rollback(
    *,
    user_id: int,
    dry_run: bool,
    posicao_path: str | None,
    pipelines: list,
) -> dict:
    posicao_path_resolved = _resolve_posicao_path(posicao_path)
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
        "posicao_path": str(posicao_path_resolved),
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
    negotiations = parse_negotiations(str(negociacao_path_resolved))
    by_code: dict[str, list[B3StockNegotiation]] = defaultdict(list)
    for negotiation in negotiations:
        by_code[negotiation.code].append(negotiation)

    position_by_code: dict[str, B3StockPosition] = {}
    if posicao_path_resolved is not None:
        for position in parse_stock_positions(
            str(posicao_path_resolved), asset_type=AssetTypes.stock
        ):
            position_by_code[position.code] = position
        for position in parse_fii_positions(
            str(posicao_path_resolved), asset_type=AssetTypes.fii
        ):
            position_by_code[position.code] = position

    actions: list[dict] = []

    for code, code_negotiations in by_code.items():
        asset = Asset.objects.filter(user_id=user_id, code=code).first()
        asset_action: dict | None = None

        if asset is None:
            position = position_by_code.get(code)
            if position is None:
                reason = (
                    "asset not in DB and no matching posicao row"
                    if posicao_path_resolved is not None
                    else "asset not in DB (pass create_missing_assets=True to create it)"
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
        else:
            asset_pk = asset.id
            existing = set(
                Transaction.objects.filter(asset=asset).values_list(
                    "action", "operation_date", "quantity", "price"
                )
            )

        for negotiation in code_negotiations:
            key = (
                negotiation.action.value,
                negotiation.operation_date,
                negotiation.quantity,
                negotiation.price,
            )
            if key in existing:
                continue

            _create_transaction(user=user, asset_pk=asset_pk, negotiation=negotiation)
            actions.append(
                {
                    "code": code,
                    "action": "transaction_created",
                    "asset_pk": asset_pk,
                    "transaction": {
                        "action": negotiation.action.value,
                        "price": str(negotiation.price),
                        "quantity": str(negotiation.quantity),
                        "operation_date": negotiation.operation_date.isoformat(),
                    },
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
) -> dict:
    return _run_with_rollback(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao_path,
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
) -> dict:
    return _run_with_rollback(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao_path,
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
        "negociacao_path": str(negociacao_resolved),
        "posicao_path": str(posicao_resolved) if posicao_resolved else None,
        "actions": actions,
    }


def import_b3_fixed_income_positions(
    *,
    user_id: int,
    dry_run: bool = True,
    use_posicao_price_when_missing_movement: bool = False,
    posicao_path: str | None = None,
    movimentacao_path: str | None = None,
) -> dict:
    return _run_with_rollback(
        user_id=user_id,
        dry_run=dry_run,
        posicao_path=posicao_path,
        pipelines=[
            _make_renda_fixa_pipeline(
                movimentacao_path=movimentacao_path,
                use_posicao_price_when_missing_movement=use_posicao_price_when_missing_movement,
            ),
            _make_tesouro_pipeline(movimentacao_path=movimentacao_path),
        ],
    )


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
    if action == "skipped":
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
    if action == "exists":
        return f"already in DB ({entry.get('type', '')})"
    if action == "asset_created":
        return f"#{entry['asset_pk']}  {entry.get('type', '')}  {entry.get('description', '')}"
    return ""


def print_report(report: dict) -> None:
    print(format_report(report))
