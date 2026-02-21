# Migration: Add Dimensions, Category/Idea ownership, and adoption models.
# Handles both fresh databases and databases that had older branch migrations
# (0015_unified_idea_system / 0016_dimension_and_idea_reference).

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models, connection


def forwards(apps, schema_editor):
    """
    Idempotent forward migration that works on:
    1. Fresh DB (after 0014): creates everything from scratch
    2. DB with stale old-branch schema: renames columns, drops extras
    """
    cursor = connection.cursor()

    def table_exists(name):
        cursor.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=%s",
            [name],
        )
        return cursor.fetchone()[0] > 0

    def column_exists(table, column):
        cursor.execute(f"PRAGMA table_info({table})")
        return any(row[1] == column for row in cursor.fetchall())

    # ── 1. Dimension table ──
    if not table_exists("api_dimension"):
        cursor.execute("""
            CREATE TABLE "api_dimension" (
                "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                "name" varchar(200) NOT NULL DEFAULT 'General',
                "created_at" datetime NOT NULL,
                "owner_id" integer NOT NULL REFERENCES "auth_user" ("id")
                    DEFERRABLE INITIALLY DEFERRED
            )
        """)
        cursor.execute(
            'CREATE INDEX "api_dimension_owner_id" ON "api_dimension" ("owner_id")'
        )
    else:
        # Table exists from old branch — rename created_by_id -> owner_id if needed
        if column_exists("api_dimension", "created_by_id") and not column_exists(
            "api_dimension", "owner_id"
        ):
            cursor.execute(
                'ALTER TABLE "api_dimension" RENAME COLUMN "created_by_id" TO "owner_id"'
            )

    # ── 2. Category.owner ──
    if not column_exists("api_category", "owner_id"):
        if column_exists("api_category", "created_by_id"):
            cursor.execute(
                'ALTER TABLE "api_category" RENAME COLUMN "created_by_id" TO "owner_id"'
            )
        else:
            cursor.execute(
                'ALTER TABLE "api_category" ADD COLUMN "owner_id" integer NULL '
                'REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED'
            )

    # ── 3. Idea.owner ──
    if not column_exists("api_idea", "owner_id"):
        cursor.execute(
            'ALTER TABLE "api_idea" ADD COLUMN "owner_id" integer NULL '
            'REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED'
        )

    # ── 4. LegendType.dimension ──
    if not column_exists("api_legendtype", "dimension_id"):
        cursor.execute(
            'ALTER TABLE "api_legendtype" ADD COLUMN "dimension_id" bigint NULL '
            'REFERENCES "api_dimension" ("id") DEFERRABLE INITIALLY DEFERRED'
        )

    # ── 5. UserCategoryAdoption ──
    if not table_exists("api_usercategoryadoption"):
        cursor.execute("""
            CREATE TABLE "api_usercategoryadoption" (
                "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                "adopted_at" datetime NOT NULL,
                "category_id" bigint NOT NULL REFERENCES "api_category" ("id")
                    DEFERRABLE INITIALLY DEFERRED,
                "user_id" integer NOT NULL REFERENCES "auth_user" ("id")
                    DEFERRABLE INITIALLY DEFERRED,
                UNIQUE ("user_id", "category_id")
            )
        """)

    # ── 6. UserDimensionAdoption ──
    if not table_exists("api_userdimensionadoption"):
        cursor.execute("""
            CREATE TABLE "api_userdimensionadoption" (
                "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                "adopted_at" datetime NOT NULL,
                "dimension_id" bigint NOT NULL REFERENCES "api_dimension" ("id")
                    DEFERRABLE INITIALLY DEFERRED,
                "user_id" integer NOT NULL REFERENCES "auth_user" ("id")
                    DEFERRABLE INITIALLY DEFERRED,
                UNIQUE ("user_id", "dimension_id")
            )
        """)

    # ── 7. Clean up stale migration records from the old branch ──
    cursor.execute(
        "DELETE FROM django_migrations WHERE app='api' AND name IN "
        "('0015_unified_idea_system', '0016_dimension_and_idea_reference')"
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_protopersona_m2m'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # RunPython does the actual idempotent DB work
        migrations.RunPython(forwards, migrations.RunPython.noop),

        # SeparateDatabaseAndState: tell Django's state tracker about the schema
        # without running the DB operations again (RunPython already did them).
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='category',
                    name='owner',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='owned_categories',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                migrations.AddField(
                    model_name='idea',
                    name='owner',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='owned_ideas',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                migrations.CreateModel(
                    name='Dimension',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(default='General', max_length=200)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dimensions', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'ordering': ['created_at'],
                    },
                ),
                migrations.AddField(
                    model_name='legendtype',
                    name='dimension',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='types',
                        to='api.dimension',
                    ),
                ),
                migrations.CreateModel(
                    name='UserCategoryAdoption',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('adopted_at', models.DateTimeField(auto_now_add=True)),
                        ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='adopters', to='api.category')),
                        ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='adopted_categories', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'unique_together': {('user', 'category')},
                    },
                ),
                migrations.CreateModel(
                    name='UserDimensionAdoption',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('adopted_at', models.DateTimeField(auto_now_add=True)),
                        ('dimension', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='adopters', to='api.dimension')),
                        ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='adopted_dimensions', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'unique_together': {('user', 'dimension')},
                    },
                ),
            ],
            database_operations=[],  # Already handled by RunPython above
        ),
    ]
