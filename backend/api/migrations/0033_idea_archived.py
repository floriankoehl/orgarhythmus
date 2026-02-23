from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0032_merge_20260223_1654"),
    ]

    operations = [
        migrations.AddField(
            model_name="idea",
            name="archived",
            field=models.BooleanField(default=False),
        ),
    ]
