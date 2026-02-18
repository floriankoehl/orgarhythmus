from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_add_phase_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='phase',
            name='team',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='phases',
                to='api.team',
            ),
        ),
    ]
