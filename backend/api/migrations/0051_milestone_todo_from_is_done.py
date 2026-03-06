"""
Migration: derive Milestone.is_done from MilestoneTodo items.

1. Create the MilestoneTodo model.
2. Add a default "Milestone finished" MilestoneTodo to every existing
   Milestone. If the milestone had is_done=True, the todo is created
   with done=True so the computed value stays correct.
3. Remove the Milestone.is_done column.
"""

from django.db import migrations, models
import django.db.models.deletion


def add_default_todos(apps, schema_editor):
    Milestone = apps.get_model("api", "Milestone")
    MilestoneTodo = apps.get_model("api", "MilestoneTodo")

    bulk = []
    for ms in Milestone.objects.all():
        bulk.append(
            MilestoneTodo(
                milestone=ms,
                title="Milestone finished",
                description="",
                done=ms.is_done,
                order=0,
            )
        )
    if bulk:
        MilestoneTodo.objects.bulk_create(bulk)


def reverse_todos(apps, schema_editor):
    """Best-effort reverse: set is_done based on whether all todos are done."""
    Milestone = apps.get_model("api", "Milestone")
    MilestoneTodo = apps.get_model("api", "MilestoneTodo")
    for ms in Milestone.objects.all():
        todos = MilestoneTodo.objects.filter(milestone=ms)
        ms.is_done = todos.exists() and all(t.done for t in todos)
        ms.save(update_fields=["is_done"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0050_task_done_from_criteria"),
    ]

    operations = [
        # 1. Create MilestoneTodo model
        migrations.CreateModel(
            name="MilestoneTodo",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=500)),
                ("description", models.TextField(blank=True, default="")),
                ("done", models.BooleanField(default=False)),
                ("order", models.IntegerField(default=0)),
                ("milestone", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="todos",
                    to="api.milestone",
                )),
            ],
            options={
                "ordering": ["order"],
            },
        ),
        # 2. Populate default todos (before dropping is_done)
        migrations.RunPython(add_default_todos, reverse_todos),
        # 3. Remove is_done from Milestone
        migrations.RemoveField(
            model_name="milestone",
            name="is_done",
        ),
    ]
