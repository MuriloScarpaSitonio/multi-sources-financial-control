from datetime import timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from config.settings.base import BASE_API_URL
from variable_income_assets.integrations.b3.handlers import (
    import_b3_renda_fixa_positions,
)
from variable_income_assets.models import Asset, AssetMetaData, Transaction
from variable_income_assets.tests.integrations.test__b3_handlers import (
    WORKBOOK_DT,
    _build_movimentacao,
    _build_posicao,
    _cdb_movimentacao_row,
    _cdb_position_row,
    fixed_br_asset,  # noqa: F401  -- re-exported pytest fixture
)

pytestmark = pytest.mark.django_db

B3_IMPORT_URL = f"/{BASE_API_URL}assets/b3_import"


def test_renda_fixa_handler_is_exported():
    from variable_income_assets.integrations import b3

    assert hasattr(b3, "import_b3_renda_fixa_positions")
    assert "import_b3_renda_fixa_positions" in b3.__all__


def test_dry_run_does_not_write_price_metadata(tmp_path, user, fixed_br_asset):
    posicao_path = _build_posicao(tmp_path, [_cdb_position_row()])
    movimentacao_path = _build_movimentacao(tmp_path, [])

    report = import_b3_renda_fixa_positions(
        user_id=user.id,
        dry_run=True,
        posicao_path=posicao_path,
        movimentacao_path=movimentacao_path,
    )

    # action is still reported...
    assert report["actions"][0]["action"] == "price_updated"
    # ...but the metadata row was NOT mutated on a dry run
    metadata = AssetMetaData.objects.get(code="CDB426DGCVL")
    assert metadata.current_price == Decimal("1000")  # unchanged stale value


def test_explicit_workbook_dt_overrides_filename(tmp_path, user, fixed_br_asset):
    # fixed_br_asset metadata was updated at WORKBOOK_DT - 1 day.
    # Pass an explicit workbook_dt OLDER than the metadata -> price must be skipped,
    # proving the explicit value (not the filename's 2026-04-29) is used.
    posicao_path = _build_posicao(tmp_path, [_cdb_position_row()])
    movimentacao_path = _build_movimentacao(tmp_path, [])
    older_dt = timezone.make_aware(WORKBOOK_DT - timedelta(days=10))

    report = import_b3_renda_fixa_positions(
        user_id=user.id,
        dry_run=False,
        posicao_path=posicao_path,
        movimentacao_path=movimentacao_path,
        workbook_dt=older_dt,
    )

    assert report["actions"][0]["action"] == "price_skipped"
    assert report["workbook_dt"] == older_dt.isoformat()


# --- Task 4: B3ImportSerializer -------------------------------------------------


def _xlsx_upload(name: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(
        name,
        b"PK\x03\x04fake-xlsx-bytes",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def test_serializer_requires_at_least_one_operation():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(data={"operations": [], "dry_run": True})
    assert not serializer.is_valid()
    assert "operations" in serializer.errors


def test_serializer_negociacoes_requires_negociacao_file():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(
        data={"operations": ["negociacoes"], "dry_run": True}
    )
    assert not serializer.is_valid()
    assert "negociacao" in str(serializer.errors)


def test_serializer_renda_fixa_requires_posicao_movimentacao_and_workbook_dt():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(
        data={
            "operations": ["renda_fixa"],
            "dry_run": True,
            "posicao": _xlsx_upload("posicao-2026-04-29-12-00-00.xlsx"),
        }
    )
    assert not serializer.is_valid()
    errors = str(serializer.errors)
    assert "movimentacao" in errors
    assert "workbook_dt" in errors


def test_serializer_rejects_non_xlsx_extension():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(
        data={
            "operations": ["negociacoes"],
            "dry_run": True,
            "negociacao": _xlsx_upload("trades.csv"),
        }
    )
    assert not serializer.is_valid()
    assert "negociacao" in serializer.errors


def test_serializer_valid_negociacoes():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(
        data={
            "operations": ["negociacoes"],
            "dry_run": True,
            "negociacao": _xlsx_upload("negociacao.xlsx"),
        }
    )
    assert serializer.is_valid(), serializer.errors


def test_serializer_dedupes_duplicate_operations():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(
        data={
            "operations": ["negociacoes", "negociacoes"],
            "dry_run": True,
            "negociacao": _xlsx_upload("negociacao.xlsx"),
        }
    )
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["operations"] == ["negociacoes"]


def test_serializer_create_missing_assets_requires_posicao():
    from variable_income_assets.serializers import B3ImportSerializer

    serializer = B3ImportSerializer(
        data={
            "operations": ["negociacoes"],
            "dry_run": True,
            "create_missing_assets": True,
            "negociacao": _xlsx_upload("negociacao.xlsx"),
        }
    )
    assert not serializer.is_valid()
    assert "posicao" in serializer.errors


# --- Task 5: run_b3_import service ---------------------------------------------


def _upload_from_path(path: str, name: str) -> SimpleUploadedFile:
    with open(path, "rb") as fh:
        return SimpleUploadedFile(name, fh.read())


def test_service_dry_run_writes_nothing(tmp_path, user, sync_assets_read_model):
    from variable_income_assets.integrations.b3.import_service import run_b3_import

    posicao = _upload_from_path(
        _build_posicao(tmp_path, [_cdb_position_row()]), "posicao-2026-04-29-12-00-00.xlsx"
    )
    movimentacao = _upload_from_path(
        _build_movimentacao(tmp_path, [_cdb_movimentacao_row()]), "movimentacao.xlsx"
    )

    result = run_b3_import(
        user_id=user.id,
        operations=["renda_fixa"],
        dry_run=True,
        workbook_dt=timezone.make_aware(WORKBOOK_DT),
        negociacao_file=None,
        posicao_file=posicao,
        movimentacao_file=movimentacao,
    )

    assert result["dry_run"] is True
    assert result["reports"]["renda_fixa"]["actions"][0]["action"] == "created"
    assert not Asset.objects.filter(user=user, code="CDB426DGCVL").exists()  # rolled back


def test_service_apply_writes(tmp_path, user, sync_assets_read_model):
    from variable_income_assets.integrations.b3.import_service import run_b3_import

    posicao = _upload_from_path(
        _build_posicao(tmp_path, [_cdb_position_row()]), "posicao-2026-04-29-12-00-00.xlsx"
    )
    movimentacao = _upload_from_path(
        _build_movimentacao(tmp_path, [_cdb_movimentacao_row()]), "movimentacao.xlsx"
    )

    run_b3_import(
        user_id=user.id,
        operations=["renda_fixa"],
        dry_run=False,
        workbook_dt=timezone.make_aware(WORKBOOK_DT),
        negociacao_file=None,
        posicao_file=posicao,
        movimentacao_file=movimentacao,
    )

    asset = Asset.objects.get(user=user, code="CDB426DGCVL")
    assert Transaction.objects.filter(asset=asset).exists()


def test_service_bad_file_raises_operation_error(tmp_path, user):
    from variable_income_assets.integrations.b3.import_service import (
        B3ImportOperationError,
        run_b3_import,
    )

    bad = SimpleUploadedFile("posicao-2026-04-29-12-00-00.xlsx", b"not a real workbook")
    movimentacao = SimpleUploadedFile("movimentacao.xlsx", b"not a real workbook")

    with pytest.raises(B3ImportOperationError) as exc:
        run_b3_import(
            user_id=user.id,
            operations=["tesouro"],
            dry_run=True,
            workbook_dt=timezone.make_aware(WORKBOOK_DT),
            negociacao_file=None,
            posicao_file=bad,
            movimentacao_file=movimentacao,
        )
    assert exc.value.operation == "tesouro"


# --- Task 6: POST /assets/b3_import endpoint -----------------------------------


def test_endpoint_requires_authentication():
    response = APIClient().post(
        B3_IMPORT_URL, data={"operations": ["negociacoes"]}, format="multipart"
    )
    assert response.status_code == 401


def test_endpoint_dry_run_returns_reports(client, user, tmp_path, sync_assets_read_model):
    posicao_path = _build_posicao(tmp_path, [_cdb_position_row()])
    movimentacao_path = _build_movimentacao(tmp_path, [_cdb_movimentacao_row()])

    with open(posicao_path, "rb") as posicao, open(movimentacao_path, "rb") as movimentacao:
        response = client.post(
            B3_IMPORT_URL,
            data={
                "operations": ["renda_fixa"],
                "dry_run": True,
                "workbook_dt": timezone.make_aware(WORKBOOK_DT).isoformat(),
                "posicao": posicao,
                "movimentacao": movimentacao,
            },
            format="multipart",
        )

    assert response.status_code == 200, response.data
    body = response.json()
    assert body["dry_run"] is True
    assert body["reports"]["renda_fixa"]["actions"][0]["action"] == "created"
    assert not Asset.objects.filter(user=user, code="CDB426DGCVL").exists()


def test_endpoint_validation_error_is_400(client):
    response = client.post(
        B3_IMPORT_URL, data={"operations": ["renda_fixa"], "dry_run": True}, format="multipart"
    )
    assert response.status_code == 400
    assert "posicao" in str(response.data)


def test_endpoint_bad_file_returns_400_with_operation(client):
    bad = SimpleUploadedFile("posicao-2026-04-29-12-00-00.xlsx", b"not a workbook")
    mov = SimpleUploadedFile("movimentacao.xlsx", b"not a workbook")
    response = client.post(
        B3_IMPORT_URL,
        data={
            "operations": ["tesouro"],
            "dry_run": True,
            "workbook_dt": timezone.make_aware(WORKBOOK_DT).isoformat(),
            "posicao": bad,
            "movimentacao": mov,
        },
        format="multipart",
    )
    assert response.status_code == 400
    assert response.data["operation"] == "tesouro"
