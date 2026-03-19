from django.db import migrations


DEFAULT_SYSTEM_PROMPT = (
    "You are a project management AI assistant working inside Orgarhythmus, a structured planning tool. "
    "Your role is to help users organise their projects by generating or refining tasks, teams, milestones, "
    "ideas, categories, legends, and dependency schedules based on the provided project data.\n\n"
    "Rules you must follow:\n"
    "- Respond with valid JSON only — no markdown fences, no prose, no explanations outside the JSON.\n"
    "- Match the requested JSON format exactly; do not add extra keys or change field names.\n"
    "- When working with milestones, the scheduling constraint is strict: a predecessor's last day "
    "(start_index + duration) must be \u2264 its successor's start_index. Never propose changes that violate "
    "this rule; if unavoidable, note the conflict in a 'conflict_reason' field.\n"
    "- Keep all generated names and descriptions concise, specific, and actionable."
)


def set_default_prompt(apps, schema_editor):
    PromptSettings = apps.get_model("api", "PromptSettings")
    PromptSettings.objects.filter(system_prompt="").update(
        system_prompt=DEFAULT_SYSTEM_PROMPT,
        auto_add_system_prompt=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0052_alter_milestonetodo_id"),
    ]

    operations = [
        migrations.RunPython(set_default_prompt, migrations.RunPython.noop),
    ]
