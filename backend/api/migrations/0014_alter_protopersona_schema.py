# Generated manually — align ProtoPersona table with current model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0013_add_protopersona'),
    ]

    operations = [
        # Remove old fields
        migrations.RemoveField(model_name='protopersona', name='hair_color'),
        migrations.RemoveField(model_name='protopersona', name='day_index'),
        migrations.RemoveField(model_name='protopersona', name='order_index'),
        migrations.RemoveField(model_name='protopersona', name='task'),

        # Add new fields
        migrations.AddField(
            model_name='protopersona',
            name='x',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='protopersona',
            name='z',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='protopersona',
            name='milestone',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='protopersonas',
                to='api.milestone',
            ),
        ),
        migrations.AddField(
            model_name='protopersona',
            name='created_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_protopersonas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='protopersona',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default='2026-01-01T00:00:00Z'),
            preserve_default=False,
        ),

        # Fix altered fields
        migrations.AlterField(
            model_name='protopersona',
            name='name',
            field=models.CharField(max_length=200),
        ),
        migrations.AlterField(
            model_name='protopersona',
            name='color',
            field=models.CharField(default='#f87171', max_length=20),
        ),

        # Update Meta ordering
        migrations.AlterModelOptions(
            name='protopersona',
            options={'ordering': ['created_at']},
        ),
    ]
