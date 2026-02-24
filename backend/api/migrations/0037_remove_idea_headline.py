"""
Data + schema migration: consolidate headline into title, drop headline column.

For each Idea:
  - If headline is non-empty:
      new title  = headline  (the short display name)
      prepend old title to description  (the body text moves to description)
  - If headline is empty:
      title stays as-is, description stays as-is

Then remove the headline column.
"""

from django.db import migrations


def merge_headline_into_title(apps, schema_editor):
    Idea = apps.get_model("api", "Idea")
    for idea in Idea.objects.all():
        headline = getattr(idea, "headline", "") or ""
        if headline.strip():
            old_title = idea.title or ""
            # Old title becomes part of description
            desc = idea.description or ""
            parts = [p for p in [old_title.strip(), desc.strip()] if p]
            idea.description = "\n\n".join(parts) if parts else ""
            # Headline becomes the new title
            idea.title = headline.strip()
            idea.save(update_fields=["title", "description"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0036_legend_context_fk"),
    ]

    operations = [
        # 1. Data migration: move headline → title, old title → description
        migrations.RunPython(
            merge_headline_into_title,
            migrations.RunPython.noop,  # no reverse
        ),
        # 2. Schema migration: drop the headline column
        migrations.RemoveField(
            model_name="idea",
            name="headline",
        ),
    ]
