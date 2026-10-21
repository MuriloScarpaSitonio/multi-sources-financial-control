from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("expenses", "0021_bankaccountsnapshot_expenses_ba_user_id_25b238_idx"),
    ]

    operations = [
        migrations.RenameField(
            model_name="expensecategory",
            old_name="exclude_from_fire",
            new_name="exclude_from_planning",
        ),
    ]
