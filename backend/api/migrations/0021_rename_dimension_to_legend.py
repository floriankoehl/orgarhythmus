from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0020_category_is_public"),
    ]

    operations = [
        # 1. Rename the Dimension model → Legend
        migrations.RenameModel(
            old_name="Dimension",
            new_name="Legend",
        ),
        # 2. Rename the IdeaDimensionType model → IdeaLegendType
        migrations.RenameModel(
            old_name="IdeaDimensionType",
            new_name="IdeaLegendType",
        ),
        # 3. Rename the UserDimensionAdoption model → UserLegendAdoption
        migrations.RenameModel(
            old_name="UserDimensionAdoption",
            new_name="UserLegendAdoption",
        ),
        # 4. Rename FK fields: dimension → legend
        migrations.RenameField(
            model_name="legendtype",
            old_name="dimension",
            new_name="legend",
        ),
        migrations.RenameField(
            model_name="userlegendadoption",
            old_name="dimension",
            new_name="legend",
        ),
        migrations.RenameField(
            model_name="idealegendtype",
            old_name="dimension",
            new_name="legend",
        ),
    ]
