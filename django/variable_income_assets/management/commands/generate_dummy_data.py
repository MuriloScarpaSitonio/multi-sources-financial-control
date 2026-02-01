from __future__ import annotations

import random
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction
from django.utils import timezone

from dateutil.relativedelta import relativedelta

from expenses.choices import (
    DEFAULT_CATEGORIES_MAP,
    DEFAULT_REVENUE_CATEGORIES_MAP,
    DEFAULT_SOURCES_MAP,
)
from expenses.models import (
    BankAccount,
    BankAccountSnapshot,
    Expense,
    ExpenseCategory,
    ExpenseSource,
    Revenue,
    RevenueCategory,
)
from variable_income_assets.choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    Currencies,
    LiquidityTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from variable_income_assets.models import (
    Asset,
    AssetClosedOperation,
    AssetMetaData,
    AssetsTotalInvestedSnapshot,
    PassiveIncome,
    Transaction,
)
from variable_income_assets.service_layer.tasks import upsert_asset_read_model

if TYPE_CHECKING:
    from django.core.management.base import CommandParser

    from authentication.models import CustomUser

UserModel = get_user_model()

# Asset configurations: (code, type, currency, sector, base_price, dividend_yield)
# dividend_yield is annual yield as decimal (0.05 = 5%)
DUMMY_ASSETS = [
    # Brazilian stocks
    (
        "PETR4",
        AssetTypes.stock,
        Currencies.real,
        AssetSectors.raw_energy,
        Decimal("35.50"),
        Decimal("0.12"),
    ),
    (
        "VALE3",
        AssetTypes.stock,
        Currencies.real,
        AssetSectors.materials,
        Decimal("62.80"),
        Decimal("0.08"),
    ),
    (
        "ITUB4",
        AssetTypes.stock,
        Currencies.real,
        AssetSectors.finance,
        Decimal("32.15"),
        Decimal("0.06"),
    ),
    (
        "BBDC4",
        AssetTypes.stock,
        Currencies.real,
        AssetSectors.finance,
        Decimal("14.20"),
        Decimal("0.07"),
    ),
    (
        "WEGE3",
        AssetTypes.stock,
        Currencies.real,
        AssetSectors.industrials,
        Decimal("42.30"),
        Decimal("0.02"),
    ),
    # FIIs
    (
        "HGLG11",
        AssetTypes.fii,
        Currencies.real,
        AssetSectors.unknown,
        Decimal("158.50"),
        Decimal("0.09"),
    ),
    (
        "KNRI11",
        AssetTypes.fii,
        Currencies.real,
        AssetSectors.unknown,
        Decimal("132.80"),
        Decimal("0.08"),
    ),
    (
        "MXRF11",
        AssetTypes.fii,
        Currencies.real,
        AssetSectors.unknown,
        Decimal("10.25"),
        Decimal("0.10"),
    ),
    # US stocks
    (
        "AAPL",
        AssetTypes.stock_usa,
        Currencies.dollar,
        AssetSectors.tech,
        Decimal("178.50"),
        Decimal("0.005"),
    ),
    (
        "MSFT",
        AssetTypes.stock_usa,
        Currencies.dollar,
        AssetSectors.tech,
        Decimal("378.90"),
        Decimal("0.008"),
    ),
    (
        "GOOGL",
        AssetTypes.stock_usa,
        Currencies.dollar,
        AssetSectors.tech,
        Decimal("141.20"),
        Decimal("0.00"),
    ),
    # Crypto
    (
        "BTC",
        AssetTypes.crypto,
        Currencies.dollar,
        AssetSectors.unknown,
        Decimal("43500.00"),
        Decimal("0.00"),
    ),
    (
        "ETH",
        AssetTypes.crypto,
        Currencies.dollar,
        AssetSectors.unknown,
        Decimal("2280.00"),
        Decimal("0.00"),
    ),
    # Fixed income (NOT self-custody - metadata not linked to asset)
    # One per liquidity type: DAILY and AT_MATURITY
    # Tuple: (code, type, currency, sector, current_price, div_yield, liquidity_type, description)
    (
        "CDB9876DEMO",
        AssetTypes.fixed_br,
        Currencies.real,
        AssetSectors.unknown,
        Decimal("1.1520"),
        Decimal("0.00"),
        LiquidityTypes.daily,
        "CDB Banco Demo - 102% CDI",
    ),
    (
        "98L12345678",
        AssetTypes.fixed_br,
        Currencies.real,
        AssetSectors.unknown,
        Decimal("1.1207"),
        Decimal("0.00"),
        LiquidityTypes.at_maturity,
        "LCI Banco Demo - 13,50% a.a.",
    ),
]

# Expense descriptions by category
EXPENSE_DESCRIPTIONS = {
    "Supermercado": ["Compras do mês", "Extra", "Pão de Açúcar", "Carrefour", "Atacadão"],
    "Alimentação": ["iFood", "Rappi", "Restaurante", "Almoço", "Jantar", "Lanchonete", "Padaria"],
    "Lazer": ["Netflix", "Spotify", "Cinema", "Teatro", "Show", "Bar", "Parque"],
    "Transporte": ["Uber", "99", "Combustível", "Estacionamento", "Pedágio", "Metrô"],
    "Casa": ["Luz", "Água", "Internet", "Condomínio", "Manutenção", "Móveis"],
    "Saúde": ["Farmácia", "Consulta médica", "Exames", "Academia", "Plano de saúde"],
    "Roupas": ["Zara", "Renner", "C&A", "Shein", "Calçados"],
    "Presentes": ["Presente aniversário", "Presente Natal", "Lembrança"],
    "Viagem": ["Passagem aérea", "Hotel", "Passeio turístico", "Aluguel de carro"],
    "Outros": ["Assinatura", "Compra online", "Serviço", "Taxa"],
}

# Revenue descriptions by category
REVENUE_DESCRIPTIONS = {
    "Salário": ["Salário"],
    "Bônus": ["Bônus anual", "PLR", "Participação nos lucros"],
    "Prêmio": ["Prêmio", "Bonificação"],
    "Presente": ["Presente", "Doação"],
    "Outros": ["Freelance", "Venda", "Reembolso", "Cashback"],
}

# Base monthly salary range
BASE_SALARY_MIN = Decimal("8000.00")
BASE_SALARY_MAX = Decimal("15000.00")

# Monthly expense ranges by category (min, max, probability of occurring)
EXPENSE_RANGES = {
    "Supermercado": (Decimal("800"), Decimal("1500"), 1.0),
    "Alimentação": (Decimal("400"), Decimal("1200"), 1.0),
    "Lazer": (Decimal("100"), Decimal("600"), 0.8),
    "Transporte": (Decimal("200"), Decimal("800"), 1.0),
    "Casa": (Decimal("500"), Decimal("1500"), 1.0),
    "Saúde": (Decimal("100"), Decimal("500"), 0.6),
    "Roupas": (Decimal("0"), Decimal("500"), 0.4),
    "Presentes": (Decimal("50"), Decimal("300"), 0.3),
    "Viagem": (Decimal("500"), Decimal("3000"), 0.15),
    "Outros": (Decimal("50"), Decimal("300"), 0.5),
}

# Fixed monthly expenses (description, category, source, value_min, value_max)
# Note: only "Cartão de crédito" and "Pix" are allowed for future expenses
FIXED_EXPENSES = [
    ("Aluguel", "Casa", "Pix", Decimal("2000"), Decimal("4000")),
    ("Condomínio", "Casa", "Pix", Decimal("500"), Decimal("1200")),
    ("Internet", "Casa", "Cartão de crédito", Decimal("100"), Decimal("200")),
    ("Energia elétrica", "Casa", "Pix", Decimal("150"), Decimal("400")),
    ("Água", "Casa", "Pix", Decimal("50"), Decimal("150")),
    ("Celular", "Outros", "Cartão de crédito", Decimal("50"), Decimal("150")),
    ("Streaming", "Lazer", "Cartão de crédito", Decimal("50"), Decimal("150")),
    ("Academia", "Saúde", "Cartão de crédito", Decimal("80"), Decimal("200")),
]

# USD to BRL conversion rate
USD_TO_BRL = Decimal("5.00")


class Command(BaseCommand):
    help = "Generate dummy data for demonstration purposes"

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--from_date",
            type=str,
            required=True,
            help="Start date for generating data (YYYY-MM-DD format)",
        )
        parser.add_argument(
            "--total",
            type=Decimal,
            required=True,
            help="Target current portfolio value (based on current asset prices)",
        )
        parser.add_argument(
            "--email",
            type=str,
            required=True,
            help="Email for the dummy user",
        )
        parser.add_argument(
            "--password",
            type=str,
            required=True,
            help="Password for the dummy user",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing user and all their data before creating new dummy data",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without actually saving to database",
        )

    def handle(self, **options) -> None:
        from_date = self._parse_date(options["from_date"])
        # Ensure total is Decimal (call_command passes strings)
        total = Decimal(str(options["total"]))
        email = options["email"]
        password = options["password"]
        clear = options.get("clear", False)
        dry_run = options.get("dry_run", False)

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No data will be saved"))

        existing_user = UserModel.objects.filter(email=email).first()
        if existing_user and not clear:
            raise CommandError(
                f"User with email '{email}' already exists. Use --clear to delete and recreate."
            )

        if total <= 0:
            raise CommandError("Total must be greater than 0")

        if from_date >= date.today():
            raise CommandError("from_date must be in the past")

        self.stdout.write(f"Creating dummy data from {from_date} to {date.today()}")
        self.stdout.write(f"Target portfolio value: R$ {total:,.2f}")

        with transaction.atomic():
            sid = transaction.savepoint()
            try:
                # Delete existing user inside transaction so it's rolled back in dry-run
                if existing_user and clear:
                    self._delete_user_data(existing_user)
                    self.stdout.write(
                        self.style.WARNING(f"Deleted existing user and data for: {email}")
                    )

                user = self._create_user(email, password)
                self.stdout.write(self.style.SUCCESS(f"Created user: {user.email}"))

                bank_account = self._create_bank_account(user)
                self.stdout.write(
                    self.style.SUCCESS(f"Created bank account: {bank_account.description}")
                )

                months = self._get_months_between(from_date, date.today())
                self.stdout.write(f"Generating data for {len(months)} months")

                # Create related entities (categories, sources)
                related_entities = self._create_related_entities(user)
                self.stdout.write(
                    self.style.SUCCESS("Created expense/revenue categories and sources")
                )

                # Generate expenses and revenues
                self._generate_expenses_and_revenues(user, bank_account, months, related_entities)
                self.stdout.write(self.style.SUCCESS("Created expenses and revenues"))

                # Generate assets and transactions
                asset_ids = self._generate_assets_and_transactions(user, total, months)
                self.stdout.write(
                    self.style.SUCCESS(f"Created {len(asset_ids)} assets with transactions")
                )

                # Generate passive incomes
                self._generate_passive_incomes(user, months)
                self.stdout.write(self.style.SUCCESS("Created passive incomes"))

                # Generate snapshots
                self._generate_snapshots(user, bank_account, months, total)
                self.stdout.write(self.style.SUCCESS("Created historical snapshots"))

                # Sync CQRS read models
                for asset_id in asset_ids:
                    upsert_asset_read_model(asset_id=asset_id)
                self.stdout.write(self.style.SUCCESS("Synced CQRS read models"))

                if dry_run:
                    transaction.savepoint_rollback(sid)
                    self.stdout.write(self.style.WARNING("\nDRY RUN - All changes rolled back"))
                else:
                    transaction.savepoint_commit(sid)
                    self.stdout.write(self.style.SUCCESS("\nDummy data generation completed!"))
                    self.stdout.write(f"  Email: {email}")
                    self.stdout.write(f"  Password: {password}")
            except Exception:
                transaction.savepoint_rollback(sid)
                raise

    def _parse_date(self, date_str: str) -> date:
        try:
            return date.fromisoformat(date_str)
        except ValueError as e:
            raise CommandError(f"Invalid date format: {date_str}. Use YYYY-MM-DD") from e

    def _delete_user_data(self, user: CustomUser) -> None:
        """Delete all data associated with a user in the correct order."""
        from variable_income_assets.models import AssetReadModel

        # Delete expenses and revenues first (they reference BankAccount with PROTECT)
        Expense.objects.filter(user=user).delete()
        Revenue.objects.filter(user=user).delete()

        # Delete related entities (categories, sources)
        ExpenseCategory.objects.filter(user=user).delete()
        ExpenseSource.objects.filter(user=user).delete()
        RevenueCategory.objects.filter(user=user).delete()

        BankAccountSnapshot.objects.filter(user=user).delete()
        BankAccount.objects.filter(user=user).delete()

        # Delete asset-related data
        PassiveIncome.objects.filter(asset__user=user).delete()
        AssetClosedOperation.objects.filter(asset__user=user).delete()
        Transaction.objects.filter(asset__user=user).delete()
        AssetReadModel.objects.filter(user_id=user.id).delete()
        AssetsTotalInvestedSnapshot.objects.filter(user=user).delete()

        # Delete metadata linked to user's fixed income assets (self-custody)
        AssetMetaData.objects.filter(asset__user=user).delete()
        Asset.objects.filter(user=user).delete()

        # Finally delete the user
        user.delete()

    def _create_user(self, email: str, password: str) -> CustomUser:
        # Set subscription to expire 1 year from now for demo purposes
        subscription_end = timezone.now() + timedelta(days=365)
        user = UserModel.objects.create_user(
            email=email,
            username=email.split("@")[0],
            password=password,
            is_active=True,
            is_personal_finances_module_enabled=True,
            is_investments_module_enabled=True,
            subscription_ends_at=subscription_end,
        )
        return user

    def _create_bank_account(self, user: CustomUser) -> BankAccount:
        return BankAccount.objects.create(
            user=user,
            description="Conta Principal",
            amount=Decimal("10000.00"),
            is_default=True,
            is_active=True,
            credit_card_bill_day=10,
        )

    def _get_months_between(self, start_date: date, end_date: date) -> list[date]:
        months = []
        current = date(start_date.year, start_date.month, 1)
        end = date(end_date.year, end_date.month, 1)

        while current <= end:
            months.append(current)
            current = current + relativedelta(months=1)

        return months

    def _create_related_entities(self, user: CustomUser) -> dict:
        """Create ExpenseCategory, ExpenseSource, and RevenueCategory for the user."""
        expense_categories = {}
        expense_sources = {}
        revenue_categories = {}

        # Create expense categories using DEFAULT_CATEGORIES_MAP for colors
        for category_name, hex_color in DEFAULT_CATEGORIES_MAP.items():
            expense_categories[category_name] = ExpenseCategory.objects.create(
                user=user,
                name=category_name,
                hex_color=hex_color,
            )

        # Create expense sources using DEFAULT_SOURCES_MAP for colors
        for source_name, hex_color in DEFAULT_SOURCES_MAP.items():
            expense_sources[source_name] = ExpenseSource.objects.create(
                user=user,
                name=source_name,
                hex_color=hex_color,
            )

        # Create revenue categories using DEFAULT_REVENUE_CATEGORIES_MAP for colors
        for category_name, hex_color in DEFAULT_REVENUE_CATEGORIES_MAP.items():
            revenue_categories[category_name] = RevenueCategory.objects.create(
                user=user,
                name=category_name,
                hex_color=hex_color,
            )

        return {
            "expense_categories": expense_categories,
            "expense_sources": expense_sources,
            "revenue_categories": revenue_categories,
        }

    def _generate_expenses_and_revenues(
        self,
        user: CustomUser,
        bank_account: BankAccount,
        months: list[date],
        related_entities: dict,
    ) -> None:
        expense_categories = related_entities["expense_categories"]
        expense_sources = related_entities["expense_sources"]
        revenue_categories = related_entities["revenue_categories"]

        # Determine a consistent salary for this user
        monthly_salary = Decimal(
            random.uniform(float(BASE_SALARY_MIN), float(BASE_SALARY_MAX))
        ).quantize(Decimal("0.01"))

        # Generate recurring_ids for fixed items
        salary_recurring_id = uuid.uuid4()
        fixed_expense_recurring_ids = {desc: uuid.uuid4() for desc, *_ in FIXED_EXPENSES}

        # Generate fixed values for each fixed expense
        fixed_expense_values = {}
        for desc, _category, _source, val_min, val_max in FIXED_EXPENSES:
            fixed_expense_values[desc] = Decimal(
                random.uniform(float(val_min), float(val_max))
            ).quantize(Decimal("0.01"))

        expenses_to_create = []
        revenues_to_create = []
        sources = list(DEFAULT_SOURCES_MAP.keys())

        # Track the last date for future entries
        last_salary_date = None
        last_fixed_expense_dates = {}

        for month_date in months:
            # Create salary (fixed revenue)
            salary_date = date(month_date.year, month_date.month, 5)
            if salary_date <= date.today():
                revenues_to_create.append(
                    Revenue(
                        user=user,
                        bank_account=bank_account,
                        value=monthly_salary,
                        description="Salário",
                        category="Salário",
                        expanded_category=revenue_categories.get("Salário"),
                        created_at=salary_date,
                        is_fixed=True,
                        recurring_id=salary_recurring_id,
                    )
                )
                last_salary_date = salary_date

            # Create fixed expenses for this month
            for desc, category, source, _, _ in FIXED_EXPENSES:
                expense_date = date(month_date.year, month_date.month, 10)
                if expense_date <= date.today():
                    expenses_to_create.append(
                        Expense(
                            user=user,
                            bank_account=bank_account,
                            value=fixed_expense_values[desc],
                            description=desc,
                            category=category,
                            expanded_category=expense_categories.get(category),
                            source=source,
                            expanded_source=expense_sources.get(source),
                            created_at=expense_date,
                            is_fixed=True,
                            recurring_id=fixed_expense_recurring_ids[desc],
                        )
                    )
                    last_fixed_expense_dates[desc] = expense_date

            # Create random additional revenues (occasional)
            if random.random() < 0.2:  # 20% chance of extra revenue
                extra_categories = ["Bônus", "Presente", "Outros"]
                category = random.choice(extra_categories)
                description = random.choice(REVENUE_DESCRIPTIONS.get(category, ["Extra"]))
                value = Decimal(random.uniform(100, 2000)).quantize(Decimal("0.01"))
                revenue_date = self._random_date_in_month(month_date)
                if revenue_date <= date.today():
                    revenues_to_create.append(
                        Revenue(
                            user=user,
                            bank_account=bank_account,
                            value=value,
                            description=description,
                            category=category,
                            expanded_category=revenue_categories.get(category),
                            created_at=revenue_date,
                            is_fixed=False,
                        )
                    )

            # Create variable expenses for each category
            for category, (min_val, max_val, probability) in EXPENSE_RANGES.items():
                if random.random() > probability:
                    continue

                # Number of expenses in this category (1-5)
                num_expenses = random.randint(1, 5)
                category_total = Decimal(random.uniform(float(min_val), float(max_val)))
                descriptions = EXPENSE_DESCRIPTIONS.get(category, ["Despesa"])

                for i in range(num_expenses):
                    # Distribute the total across expenses
                    if i == num_expenses - 1:
                        value = category_total
                    else:
                        value = Decimal(random.uniform(0.1, 0.5)) * category_total
                        category_total -= value

                    value = max(value, Decimal("1.00")).quantize(Decimal("0.01"))
                    description = random.choice(descriptions)
                    source = random.choice(sources)
                    expense_date = self._random_date_in_month(month_date)

                    # Only create if date is in past or today
                    if expense_date <= date.today():
                        expenses_to_create.append(
                            Expense(
                                user=user,
                                bank_account=bank_account,
                                value=value,
                                description=description,
                                category=category,
                                expanded_category=expense_categories.get(category),
                                source=source,
                                expanded_source=expense_sources.get(source),
                                created_at=expense_date,
                                is_fixed=False,
                            )
                        )

        # Create future fixed revenues (11 months)
        if last_salary_date:
            for i in range(1, 12):
                future_date = last_salary_date + relativedelta(months=i)
                revenues_to_create.append(
                    Revenue(
                        user=user,
                        bank_account=bank_account,
                        value=monthly_salary,
                        description="Salário",
                        category="Salário",
                        expanded_category=revenue_categories.get("Salário"),
                        created_at=future_date,
                        is_fixed=True,
                        recurring_id=salary_recurring_id,
                    )
                )

        # Create future fixed expenses (11 months)
        for desc, category, source, _, _ in FIXED_EXPENSES:
            if desc in last_fixed_expense_dates:
                last_date = last_fixed_expense_dates[desc]
                for i in range(1, 12):
                    future_date = last_date + relativedelta(months=i)
                    expenses_to_create.append(
                        Expense(
                            user=user,
                            bank_account=bank_account,
                            value=fixed_expense_values[desc],
                            description=desc,
                            category=category,
                            expanded_category=expense_categories.get(category),
                            source=source,
                            expanded_source=expense_sources.get(source),
                            created_at=future_date,
                            is_fixed=True,
                            recurring_id=fixed_expense_recurring_ids[desc],
                        )
                    )

        # Bulk create
        Revenue.objects.bulk_create(revenues_to_create)
        Expense.objects.bulk_create(expenses_to_create)

    def _generate_assets_and_transactions(
        self, user: CustomUser, target_total: Decimal, months: list[date]
    ) -> list[int]:
        # First, ensure all AssetMetaData entries exist
        metadata_map = self._ensure_asset_metadata()

        # Select a subset of assets for this portfolio (8-12 assets)
        num_assets = random.randint(8, min(12, len(DUMMY_ASSETS)))
        selected_assets = random.sample(DUMMY_ASSETS, num_assets)

        # Assign strategies: hold_only (~60%), partial_sell (~25%), fully_closed (~15%)
        # But ensure at least one of each type if we have enough assets
        strategies = []
        for _ in range(num_assets):
            roll = random.random()
            if roll < 0.15:
                strategies.append("fully_closed")
            elif roll < 0.40:
                strategies.append("partial_sell")
            else:
                strategies.append("hold_only")

        # Ensure we have at least one of each type (if enough assets)
        if num_assets >= 3:
            if "fully_closed" not in strategies:
                strategies[0] = "fully_closed"
            if "partial_sell" not in strategies:
                strategies[1] = "partial_sell"

        # Calculate allocations - only hold_only and partial_sell contribute to target_total
        # Fully closed positions are "bonus" historical trades
        open_indices = [i for i, s in enumerate(strategies) if s != "fully_closed"]
        weights = [Decimal(str(random.uniform(0.5, 2.0))) for _ in open_indices]
        total_weight = sum(weights) if weights else Decimal("1")

        allocations = {}
        for idx, i in enumerate(open_indices):
            allocations[i] = (weights[idx] / total_weight) * target_total

        # Closed positions get a random "historical" allocation (not counted in target)
        for i, s in enumerate(strategies):
            if s == "fully_closed":
                allocations[i] = Decimal(str(random.uniform(5000, 20000)))

        asset_ids = []

        for i, asset_data in enumerate(selected_assets):
            code, asset_type, currency, _, base_price, __ = asset_data[:6]
            # Fixed income assets have liquidity_type (7th) and description (8th)
            liquidity_type = asset_data[6] if len(asset_data) > 6 else None
            description = asset_data[7] if len(asset_data) > 7 else ""

            target_allocation = allocations[i]
            metadata = metadata_map[(code, asset_type, currency)]
            current_price = metadata.current_price
            strategy = strategies[i]

            # Calculate target value in asset currency
            if currency == Currencies.dollar:
                target_in_currency = target_allocation / USD_TO_BRL
            else:
                target_in_currency = target_allocation

            is_fixed_income = asset_type == AssetTypes.fixed_br
            conversion_rate = USD_TO_BRL if currency == Currencies.dollar else Decimal("1.0")

            if is_fixed_income:
                asset = self._create_fixed_income_asset(
                    user,
                    code,
                    asset_type,
                    currency,
                    metadata,
                    target_in_currency,
                    months,
                    liquidity_type,
                    description,
                )
            else:
                asset = self._create_variable_income_asset(
                    user,
                    code,
                    asset_type,
                    currency,
                    current_price,
                    base_price,
                    target_in_currency,
                    months,
                    strategy,
                    conversion_rate,
                )

            if asset:
                asset_ids.append(asset.pk)

        return asset_ids

    def _create_fixed_income_asset(
        self,
        user: CustomUser,
        code: str,
        asset_type: str,
        currency: str,
        metadata: AssetMetaData,
        target_value: Decimal,
        months: list[date],
        liquidity_type: str | None = None,
        description: str = "",
    ) -> Asset:
        """Create a fixed income asset with buy transactions (NOT self-custody)."""
        # Set maturity_date for AT_MATURITY liquidity type (1-3 years from now)
        maturity_date = None
        if liquidity_type == LiquidityTypes.at_maturity:
            days_until_maturity = random.randint(365, 365 * 3)
            maturity_date = date.today() + timedelta(days=days_until_maturity)

        asset = Asset.objects.create(
            user=user,
            code=code,
            description=description,
            type=asset_type,
            currency=currency,
            objective=AssetObjectives.growth,
            liquidity_type=liquidity_type or "",
            maturity_date=maturity_date,
        )
        # Note: NOT linking metadata to asset to avoid self-custody

        available_months = months[:-1] if len(months) > 1 else months
        num_purchases = min(len(available_months), random.randint(1, 3))
        purchase_months = random.sample(available_months, num_purchases)

        # For fixed income: quantity = invested amount, price = 1.00 per unit
        # current_price in metadata represents appreciation (e.g., 1.15 = 15% gain)
        remaining = target_value
        for j, purchase_month in enumerate(purchase_months):
            if j == num_purchases - 1:
                purchase_value = remaining
            else:
                purchase_value = remaining * Decimal(str(random.uniform(0.2, 0.5)))
                remaining -= purchase_value

            purchase_date = self._random_date_in_month(purchase_month)
            if purchase_date > date.today():
                purchase_date = date.today() - timedelta(days=random.randint(1, 30))

            Transaction.objects.create(
                asset=asset,
                action=TransactionActions.buy,
                price=Decimal("1.00"),  # Price per unit at purchase
                quantity=purchase_value.quantize(Decimal("0.01")),  # Quantity = invested amount
                operation_date=purchase_date,
                current_currency_conversion_rate=Decimal("1.0"),
            )

        return asset

    def _create_variable_income_asset(
        self,
        user: CustomUser,
        code: str,
        asset_type: str,
        currency: str,
        current_price: Decimal,
        base_price: Decimal,
        target_value: Decimal,
        months: list[date],
        strategy: str,
        conversion_rate: Decimal,
    ) -> Asset | None:
        """Create a variable income asset with buy/sell transactions based on strategy."""
        # For partial_sell, we need to buy more than target to have some to sell
        # For fully_closed, the target represents what we bought (and sold)
        if strategy == "hold_only":
            buy_quantity = (target_value / current_price).quantize(Decimal("0.00000001"))
        elif strategy == "partial_sell":
            # Buy 30-50% more than target, so after selling we still have target value
            multiplier = Decimal(str(random.uniform(1.3, 1.5)))
            buy_quantity = ((target_value * multiplier) / current_price).quantize(
                Decimal("0.00000001")
            )
        else:  # fully_closed
            buy_quantity = (target_value / base_price).quantize(Decimal("0.00000001"))

        if buy_quantity <= 0:
            return None

        asset = Asset.objects.create(
            user=user,
            code=code,
            type=asset_type,
            currency=currency,
            objective=random.choice([AssetObjectives.growth, AssetObjectives.dividend]),
        )

        # Create buy transactions
        available_months = months[:-1] if len(months) > 1 else months
        num_purchases = min(len(available_months), random.randint(1, 6))
        purchase_months = sorted(random.sample(available_months, num_purchases))

        buy_transactions = []
        remaining_qty = buy_quantity
        total_bought_value = Decimal("0")

        for j, purchase_month in enumerate(purchase_months):
            if j == num_purchases - 1:
                qty = remaining_qty
            else:
                qty = remaining_qty * Decimal(str(random.uniform(0.1, 0.4)))
                remaining_qty -= qty

            price_variance = Decimal(str(random.uniform(0.85, 1.15)))
            purchase_price = (base_price * price_variance).quantize(Decimal("0.00000001"))

            purchase_date = self._random_date_in_month(purchase_month)
            if purchase_date > date.today():
                purchase_date = date.today() - timedelta(days=random.randint(1, 30))

            tx = Transaction.objects.create(
                asset=asset,
                action=TransactionActions.buy,
                price=purchase_price,
                quantity=qty.quantize(Decimal("0.00000001")),
                operation_date=purchase_date,
                current_currency_conversion_rate=conversion_rate,
            )
            buy_transactions.append(tx)
            total_bought_value += qty * purchase_price

        # Handle sell transactions based on strategy
        if strategy == "partial_sell":
            self._create_partial_sell(asset, buy_quantity, base_price, months, conversion_rate)
        elif strategy == "fully_closed":
            self._create_fully_closed(
                asset,
                buy_quantity,
                total_bought_value,
                base_price,
                buy_transactions[-1].operation_date,
                conversion_rate,
            )

        return asset

    def _create_partial_sell(
        self,
        asset: Asset,
        total_quantity: Decimal,
        base_price: Decimal,
        months: list[date],
        conversion_rate: Decimal,
    ) -> None:
        """Create partial sell transactions (selling 20-40% of position)."""
        sell_percentage = Decimal(str(random.uniform(0.2, 0.4)))
        sell_quantity = (total_quantity * sell_percentage).quantize(Decimal("0.00000001"))

        if sell_quantity <= 0:
            return

        # Sell at a profit (5-25% higher than base price)
        profit_margin = Decimal(str(random.uniform(1.05, 1.25)))
        sell_price = (base_price * profit_margin).quantize(Decimal("0.00000001"))

        # Find a date after the last buy
        last_buy = (
            Transaction.objects.filter(asset=asset, action=TransactionActions.buy)
            .order_by("-operation_date")
            .first()
        )

        if last_buy:
            # Sell 1-3 months after last buy
            sell_date = last_buy.operation_date + timedelta(days=random.randint(30, 90))
            if sell_date > date.today():
                sell_date = date.today() - timedelta(days=random.randint(1, 10))
        else:
            sell_date = date.today() - timedelta(days=random.randint(1, 30))

        Transaction.objects.create(
            asset=asset,
            action=TransactionActions.sell,
            price=sell_price,
            quantity=sell_quantity,
            operation_date=sell_date,
            current_currency_conversion_rate=conversion_rate,
        )

    def _create_fully_closed(
        self,
        asset: Asset,
        total_quantity: Decimal,
        total_bought_value: Decimal,
        base_price: Decimal,
        last_buy_date: date,
        conversion_rate: Decimal,
    ) -> None:
        """Create sell transaction for full position and AssetClosedOperation."""
        # Sell at a profit or loss (random -10% to +30%)
        profit_margin = Decimal(str(random.uniform(0.9, 1.3)))
        sell_price = (base_price * profit_margin).quantize(Decimal("0.00000001"))

        # Sell 1-6 months after last buy
        sell_date = last_buy_date + timedelta(days=random.randint(30, 180))
        if sell_date > date.today():
            sell_date = date.today() - timedelta(days=random.randint(1, 10))

        total_sold_value = total_quantity * sell_price

        Transaction.objects.create(
            asset=asset,
            action=TransactionActions.sell,
            price=sell_price,
            quantity=total_quantity,
            operation_date=sell_date,
            current_currency_conversion_rate=conversion_rate,
        )

        # Create AssetClosedOperation record
        AssetClosedOperation.objects.create(
            asset=asset,
            normalized_total_bought=(total_bought_value * conversion_rate).quantize(
                Decimal("0.0001")
            ),
            total_bought=total_bought_value.quantize(Decimal("0.0001")),
            quantity_bought=total_quantity.quantize(Decimal("0.0001")),
            normalized_total_sold=(total_sold_value * conversion_rate).quantize(Decimal("0.0001")),
            operation_datetime=timezone.make_aware(
                timezone.datetime.combine(sell_date, timezone.datetime.min.time())
            ),
        )

    def _ensure_asset_metadata(self) -> dict[tuple[str, str, str], AssetMetaData]:
        """Ensure all required AssetMetaData entries exist and return a mapping."""
        metadata_map = {}

        for asset_data in DUMMY_ASSETS:
            code, asset_type, currency, sector, base_price = asset_data[:5]
            # Only create if doesn't exist - NEVER modify existing metadata
            metadata, created = AssetMetaData.objects.get_or_create(
                code=code,
                type=asset_type,
                currency=currency,
                asset__isnull=True,
                defaults={
                    "sector": sector,
                    "current_price": base_price,
                    "current_price_updated_at": timezone.now(),
                },
            )

            metadata_map[(code, asset_type, currency)] = metadata

        return metadata_map

    def _generate_passive_incomes(self, user: CustomUser, months: list[date]) -> None:
        """Generate dividend and JCP payments for applicable assets."""
        incomes_to_create = []

        assets_with_dividends = Asset.objects.filter(
            user=user,
            type__in=[AssetTypes.stock, AssetTypes.stock_usa, AssetTypes.fii],
        ).select_related()

        for asset in assets_with_dividends:
            # Find dividend yield for this asset (index 5 in tuple)
            dividend_yield = Decimal("0.05")  # Default 5% annual
            for asset_data in DUMMY_ASSETS:
                if asset_data[0] == asset.code and asset_data[1] == asset.type:
                    dividend_yield = asset_data[5]
                    break

            if dividend_yield <= 0:
                continue

            # Get transactions to determine when asset was held
            first_transaction = (
                Transaction.objects.filter(asset=asset, action=TransactionActions.buy)
                .order_by("operation_date")
                .first()
            )
            if not first_transaction:
                continue

            # Calculate monthly dividend (annual yield / 12)
            # Use a rough estimate based on average holding
            monthly_yield = dividend_yield / 12

            # Get current quantity (approximate)
            total_qty = Transaction.objects.filter(
                asset=asset, action=TransactionActions.buy
            ).aggregate(total=models.Sum("quantity"))["total"] or Decimal("0")

            if total_qty <= 0:
                continue

            # Find the base price for this asset (index 4 in tuple)
            base_price = Decimal("100")
            for asset_data in DUMMY_ASSETS:
                if asset_data[0] == asset.code and asset_data[1] == asset.type:
                    base_price = asset_data[4]
                    break

            # Generate quarterly dividends (or monthly for FIIs)
            is_fii = asset.type == AssetTypes.fii
            income_months = months if is_fii else [m for i, m in enumerate(months) if i % 3 == 0]

            for income_month in income_months:
                if income_month < date(
                    first_transaction.operation_date.year, first_transaction.operation_date.month, 1
                ):
                    continue

                # Calculate dividend amount
                dividend_per_unit = base_price * monthly_yield * (3 if not is_fii else 1)
                dividend_amount = (total_qty * dividend_per_unit).quantize(Decimal("0.01"))

                if dividend_amount < Decimal("0.01"):
                    continue

                # Income date (usually mid-month for FIIs, random for stocks)
                income_date = date(
                    income_month.year, income_month.month, 15 if is_fii else random.randint(5, 25)
                )
                if income_date > date.today():
                    continue

                conversion_rate = (
                    USD_TO_BRL if asset.currency == Currencies.dollar else Decimal("1.0")
                )

                # Determine income type
                if asset.type == AssetTypes.fii:
                    income_type = PassiveIncomeTypes.income
                elif random.random() < 0.3:  # 30% chance of JCP for BR stocks
                    income_type = PassiveIncomeTypes.jcp
                else:
                    income_type = PassiveIncomeTypes.dividend

                incomes_to_create.append(
                    PassiveIncome(
                        asset=asset,
                        type=income_type,
                        event_type=PassiveIncomeEventTypes.credited,
                        amount=dividend_amount,
                        operation_date=income_date,
                        current_currency_conversion_rate=conversion_rate,
                    )
                )

        PassiveIncome.objects.bulk_create(incomes_to_create)

    def _generate_snapshots(
        self, user: CustomUser, bank_account: BankAccount, months: list[date], target_total: Decimal
    ) -> None:
        """
        Generate historical snapshots for bank accounts and investments
        based on actual transactions.
        """
        bank_snapshots = []
        investment_snapshots = []

        # Filter to only past/current months
        valid_months = [m for m in months if date(m.year, m.month, 1) <= date.today()]
        if not valid_months:
            return

        # Get all transactions for this user, ordered by date
        all_transactions = Transaction.objects.filter(asset__user=user).order_by("operation_date")

        # Build a map of month -> cumulative total invested
        # Total invested = sum of BUY - sum of SELL (normalized values)
        cumulative_invested = Decimal("0")
        monthly_totals = {}

        for tx in all_transactions:
            tx_month = date(tx.operation_date.year, tx.operation_date.month, 1)
            normalized_value = tx.price * tx.current_currency_conversion_rate
            if tx.quantity:
                normalized_value = normalized_value * tx.quantity

            if tx.action == TransactionActions.buy:
                cumulative_invested += normalized_value
            else:  # SELL
                cumulative_invested -= normalized_value

            # Store the cumulative total at end of each month
            monthly_totals[tx_month] = max(cumulative_invested, Decimal("0"))

        # Fill in gaps for months without transactions (carry forward previous value)
        running_total = Decimal("0")
        for month_date in valid_months:
            month_key = date(month_date.year, month_date.month, 1)
            if month_key in monthly_totals:
                running_total = monthly_totals[month_key]
            monthly_totals[month_key] = running_total

        base_bank_amount = Decimal("5000.00")

        for month_date in valid_months:
            # Use first day of month - required by insert_zeros_if_no_data_in_monthly_historic_data
            snapshot_date = date(month_date.year, month_date.month, 1)

            # Bank account grows/shrinks with some variance
            bank_growth = Decimal(str(random.uniform(-0.05, 0.15)))
            base_bank_amount = base_bank_amount * (1 + bank_growth)
            base_bank_amount = max(base_bank_amount, Decimal("1000.00"))

            bank_snapshots.append(
                BankAccountSnapshot(
                    user=user,
                    operation_date=snapshot_date,
                    total=base_bank_amount.quantize(Decimal("0.01")),
                )
            )

            # Use actual calculated total from transactions
            investment_total = monthly_totals.get(snapshot_date, Decimal("0"))
            investment_snapshots.append(
                AssetsTotalInvestedSnapshot(
                    user=user,
                    operation_date=snapshot_date,
                    total=investment_total.quantize(Decimal("0.01")),
                )
            )

        BankAccountSnapshot.objects.bulk_create(bank_snapshots)
        AssetsTotalInvestedSnapshot.objects.bulk_create(investment_snapshots)

    def _random_date_in_month(self, month_date: date) -> date:
        """Return a random date within the given month."""
        # Get the last day of the month
        if month_date.month == 12:
            last_day = date(month_date.year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(month_date.year, month_date.month + 1, 1) - timedelta(days=1)

        day = random.randint(1, last_day.day)
        return date(month_date.year, month_date.month, day)
