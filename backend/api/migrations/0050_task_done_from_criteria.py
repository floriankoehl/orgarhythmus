"""
Migration: derive Task.is_done from acceptance criteria.

1. Add a default "Task finished" AcceptanceCriterion to every Task that
   currently has zero criteria.  If the task had is_done=True, the
   criterion is created with done=True so the computed value stays correct.
2. Remove the Task.is_done column (no longer needed).
"""

from django.db import migrations


def add_default_criteria(apps, schema_editor):
    Task = apps.get_model("api", "Task")
    AcceptanceCriterion = apps.get_model("api", "AcceptanceCriterion")

    tasks_without_criteria = (
        Task.objects.filter(acceptance_criteria__isnull=True)
        .distinct()
    )

    bulk = []
    for task in tasks_without_criteria:
        bulk.append(
            AcceptanceCriterion(
                task=task,
                title="Task finished",
                description="",
                done=task.is_done,
                order=0,
            )
        )

    if bulk:
        AcceptanceCriterion.objects.bulk_create(bulk)


def remove_default_criteria(apps, schema_editor):
    """Reverse: delete auto-created 'Task finished' criteria that are the only
    criterion on their task."""
    AcceptanceCriterion = apps.get_model("api", "AcceptanceCriterion")
    from django.db.models import Count

    # Find tasks with exactly one criterion titled "Task finished"
    AcceptanceCriterion.objects.filter(
        title="Task finished",
        task__acceptance_criteria__count=1,
    ).delete()  # best-effort reverse


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0049_add_is_done_to_task_and_milestone"),
    ]

    operations = [
        # 1. Data migration — seed default criteria
        migrations.RunPython(add_default_criteria, remove_default_criteria),
        # 2. Remove the is_done column from Task
        migrations.RemoveField(
            model_name="task",
            name="is_done",
        ),
    ]
