from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0030_legendtype_icon'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='filter_config',
            field=models.JSONField(blank=True, default=None, null=True),
        ),
    ]
