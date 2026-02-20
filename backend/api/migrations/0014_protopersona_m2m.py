# Transition ProtoPersona from milestone FK to M2M for milestones, teams, tasks.
# Works on fresh DB (after 0013) and on production (where old 0014_alter is stale).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_add_protopersona'),
    ]

    operations = [
        # Remove the old milestone FK
        migrations.RemoveField(
            model_name='protopersona',
            name='milestone',
        ),

        # Add M2M relationships
        migrations.AddField(
            model_name='protopersona',
            name='milestones',
            field=models.ManyToManyField(blank=True, related_name='protopersonas', to='api.milestone'),
        ),
        migrations.AddField(
            model_name='protopersona',
            name='teams',
            field=models.ManyToManyField(blank=True, related_name='protopersonas', to='api.team'),
        ),
        migrations.AddField(
            model_name='protopersona',
            name='tasks',
            field=models.ManyToManyField(blank=True, related_name='protopersonas', to='api.task'),
        ),
    ]
