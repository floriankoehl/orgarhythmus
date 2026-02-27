"""
IdeaBin JSON backup import / restore.

POST /api/ideabin/import/                  → global restore (all user data)
POST /api/ideabin/import/?context_id=<id>  → context-scoped restore
"""

import json

from django.db import transaction
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Category,
    CategoryContextPlacement,
    Context,
    Formation,
    Idea,
    IdeaComment,
    IdeaLegendType,
    IdeaPlacement,
    IdeaUpvote,
    Legend,
    LegendContextPlacement,
    LegendType,
    UserCategoryAdoption,
    UserContextAdoption,
    UserLegendAdoption,
    UserShortcuts,
)


CURRENT_SCHEMA_VERSION = 1

# Top-level keys expected per export_type
_CONTEXT_REQUIRED_KEYS = {
    "schema_version", "export_type", "exported_at", "user_id", "username",
    "context", "category_context_placements", "categories",
    "legend_context_placements", "legends", "ideas", "formations",
}

_GLOBAL_REQUIRED_KEYS = {
    "schema_version", "export_type", "exported_at", "user_id", "username",
    "contexts", "category_context_placements", "categories",
    "legend_context_placements", "legends", "ideas", "formations",
    "adoptions", "shortcuts", "filter_presets",
}


# ─── validation helpers ──────────────────────────────────

def _validate_common(data):
    """Validate schema_version and export_type. Returns error string or None."""
    if not isinstance(data, dict):
        return "Expected a JSON object at top level."

    if data.get("schema_version") != CURRENT_SCHEMA_VERSION:
        return (
            f"Unsupported schema_version: {data.get('schema_version')}. "
            f"Expected {CURRENT_SCHEMA_VERSION}."
        )

    export_type = data.get("export_type")
    if export_type not in ("context", "global"):
        return f"Unknown export_type: {export_type!r}. Expected 'context' or 'global'."

    return None


def _validate_keys(data, required_keys, label):
    missing = required_keys - set(data.keys())
    if missing:
        return f"Missing required top-level keys for {label} import: {sorted(missing)}"
    return None


def _validate_context_payload(data):
    err = _validate_common(data)
    if err:
        return err
    err = _validate_keys(data, _CONTEXT_REQUIRED_KEYS, "context")
    if err:
        return err
    # context must be a dict
    if not isinstance(data.get("context"), dict):
        return "'context' must be an object."
    for lst_key in ("categories", "legends", "ideas", "formations",
                    "category_context_placements", "legend_context_placements"):
        if not isinstance(data.get(lst_key), list):
            return f"'{lst_key}' must be a list."
    return None


def _validate_global_payload(data):
    err = _validate_common(data)
    if err:
        return err
    err = _validate_keys(data, _GLOBAL_REQUIRED_KEYS, "global")
    if err:
        return err
    for lst_key in ("contexts", "categories", "legends", "ideas", "formations",
                    "category_context_placements", "legend_context_placements"):
        if not isinstance(data.get(lst_key), list):
            return f"'{lst_key}' must be a list."
    if not isinstance(data.get("adoptions"), dict):
        return "'adoptions' must be an object."
    return None


# ─── main import view ────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_ideabin(request):
    user = request.user

    # Accept either multipart file upload or raw JSON body
    if request.FILES.get("file"):
        try:
            raw = request.FILES["file"].read().decode("utf-8")
            data = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            return JsonResponse({"error": f"Invalid JSON file: {exc}"}, status=400)
    else:
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            return JsonResponse({"error": f"Invalid JSON body: {exc}"}, status=400)

    # Basic validation
    err = _validate_common(data)
    if err:
        return JsonResponse({"error": err}, status=400)

    export_type = data["export_type"]
    context_id = request.query_params.get("context_id")

    if export_type == "context":
        err = _validate_context_payload(data)
        if err:
            return JsonResponse({"error": err}, status=400)
        return _import_context(user, data, context_id)

    elif export_type == "global":
        err = _validate_global_payload(data)
        if err:
            return JsonResponse({"error": err}, status=400)
        if context_id:
            return JsonResponse(
                {"error": "Cannot use context_id with a global export file. "
                          "Use a context-type export for single-context restore."},
                status=400,
            )
        return _import_global(user, data)

    return JsonResponse({"error": "Unknown export_type."}, status=400)


# ─── context-scoped import ───────────────────────────────

def _import_context(user, data, context_id):
    """
    Restore a single context from a context-type export.
    If context_id is given, replace that context. Otherwise create new.
    """
    ctx_data = data["context"]

    try:
        with transaction.atomic():
            # ── 1. Determine target context ──
            if context_id:
                target_ctx_id = int(context_id)
                try:
                    existing = Context.objects.get(id=target_ctx_id, owner=user)
                except Context.DoesNotExist:
                    return JsonResponse({"error": "Target context not found."}, status=404)
                # Wipe existing context data
                _delete_context_data(user, existing)
                existing.delete()

            # ── 2. Create context (new ID) ──
            old_ctx_id = ctx_data["id"]
            new_ctx = Context.objects.create(
                owner=user,
                name=ctx_data["name"],
                x=ctx_data.get("x", 0),
                y=ctx_data.get("y", 0),
                width=ctx_data.get("width", 200),
                height=ctx_data.get("height", 200),
                z_index=ctx_data.get("z_index", 0),
                is_public=ctx_data.get("is_public", False),
                is_default=ctx_data.get("is_default", False),
                color=ctx_data.get("color"),
                filter_state=ctx_data.get("filter_state"),
            )
            ctx_id_map = {old_ctx_id: new_ctx.id}

            # ── 3. Legends + legend types ──
            legend_id_map = {}
            legend_type_id_map = {}
            for leg in data["legends"]:
                new_legend = Legend.objects.create(
                    owner=user,
                    context=new_ctx,
                    name=leg["name"],
                )
                legend_id_map[leg["id"]] = new_legend.id

                for lt in leg.get("types", []):
                    new_lt = LegendType.objects.create(
                        legend=new_legend,
                        name=lt["name"],
                        color=lt.get("color", "#ffffff"),
                        icon=lt.get("icon"),
                        order_index=lt.get("order_index", 0),
                    )
                    legend_type_id_map[lt["id"]] = new_lt.id

            # ── 4. Legend-context placements ──
            for lcp in data["legend_context_placements"]:
                new_leg_id = legend_id_map.get(lcp["legend_id"])
                if new_leg_id:
                    LegendContextPlacement.objects.create(
                        legend_id=new_leg_id,
                        context=new_ctx,
                        order_index=lcp.get("order_index", 0),
                    )

            # ── 5. Categories ──
            cat_id_map = {}
            for cat in data["categories"]:
                new_cat = Category.objects.create(
                    owner=user,
                    name=cat["name"],
                    x=cat.get("x", 0),
                    y=cat.get("y", 0),
                    width=cat.get("width", 100),
                    height=cat.get("height", 100),
                    z_index=cat.get("z_index", 0),
                    archived=cat.get("archived", False),
                    is_public=cat.get("is_public", False),
                    filter_config=cat.get("filter_config"),
                )
                cat_id_map[cat["id"]] = new_cat.id

            # ── 6. Category-context placements ──
            for ccp in data["category_context_placements"]:
                new_cat_id = cat_id_map.get(ccp["category_id"])
                if new_cat_id:
                    CategoryContextPlacement.objects.create(
                        category_id=new_cat_id,
                        context=new_ctx,
                        order_index=ccp.get("order_index", 0),
                    )

            # ── 7. Ideas + placements + assignments ──
            idea_id_map = {}
            for idea_data in data["ideas"]:
                new_idea = Idea.objects.create(
                    owner=user,
                    title=idea_data.get("title", ""),
                    description=idea_data.get("description", ""),
                    archived=idea_data.get("archived", False),
                )
                idea_id_map[idea_data["id"]] = new_idea.id

                # placements
                for pl in idea_data.get("placements", []):
                    new_cat_id = cat_id_map.get(pl["category_id"]) if pl["category_id"] else None
                    IdeaPlacement.objects.create(
                        idea=new_idea,
                        category_id=new_cat_id,
                        order_index=pl.get("order_index", 0),
                    )

                # legend type assignments
                for lta in idea_data.get("legend_type_assignments", []):
                    new_leg_id = legend_id_map.get(lta["legend_id"])
                    new_lt_id = legend_type_id_map.get(lta["legend_type_id"])
                    if new_leg_id and new_lt_id:
                        IdeaLegendType.objects.create(
                            idea=new_idea,
                            legend_id=new_leg_id,
                            legend_type_id=new_lt_id,
                        )

                # upvotes (only for the importing user)
                for uv in idea_data.get("upvotes", []):
                    if uv.get("user_id") == user.id:
                        IdeaUpvote.objects.create(
                            user=user,
                            idea=new_idea,
                        )

                # comments (only from the importing user)
                for cmt in idea_data.get("comments", []):
                    if cmt.get("user_id") == user.id:
                        IdeaComment.objects.create(
                            user=user,
                            idea=new_idea,
                            text=cmt.get("text", ""),
                        )

            # ── 8. Formations ──
            for fm in data["formations"]:
                # Remap IDs inside formation state JSON
                state = _remap_formation_state(
                    fm.get("state", {}), cat_id_map, ctx_id_map,
                    legend_id_map, legend_type_id_map
                )
                Formation.objects.create(
                    owner=user,
                    context=new_ctx,
                    name=fm["name"],
                    state=state,
                    is_default=fm.get("is_default", False),
                )

        return JsonResponse({
            "status": "ok",
            "message": "Context restored successfully.",
            "context_id": new_ctx.id,
        })

    except Exception as exc:
        return JsonResponse({"error": f"Import failed: {exc}"}, status=500)


# ─── global import ───────────────────────────────────────

def _import_global(user, data):
    """
    Full restore: delete ALL user IdeaBin data, recreate from JSON.
    """
    try:
        with transaction.atomic():
            # ── 1. Delete everything ──
            _delete_all_ideabin_data(user)

            # ── 2. Contexts ──
            ctx_id_map = {}
            for ctx_data in data["contexts"]:
                new_ctx = Context.objects.create(
                    owner=user,
                    name=ctx_data["name"],
                    x=ctx_data.get("x", 0),
                    y=ctx_data.get("y", 0),
                    width=ctx_data.get("width", 200),
                    height=ctx_data.get("height", 200),
                    z_index=ctx_data.get("z_index", 0),
                    is_public=ctx_data.get("is_public", False),
                    is_default=ctx_data.get("is_default", False),
                    color=ctx_data.get("color"),
                    filter_state=ctx_data.get("filter_state"),
                )
                ctx_id_map[ctx_data["id"]] = new_ctx.id

            # ── 3. Legends + legend types ──
            legend_id_map = {}
            legend_type_id_map = {}
            for leg in data["legends"]:
                # Resolve context FK
                new_ctx_id = ctx_id_map.get(leg.get("context_id"))
                new_legend = Legend.objects.create(
                    owner=user,
                    context_id=new_ctx_id,
                    name=leg["name"],
                )
                legend_id_map[leg["id"]] = new_legend.id

                for lt in leg.get("types", []):
                    new_lt = LegendType.objects.create(
                        legend=new_legend,
                        name=lt["name"],
                        color=lt.get("color", "#ffffff"),
                        icon=lt.get("icon"),
                        order_index=lt.get("order_index", 0),
                    )
                    legend_type_id_map[lt["id"]] = new_lt.id

            # ── 4. Legend-context placements ──
            for lcp in data["legend_context_placements"]:
                new_leg_id = legend_id_map.get(lcp["legend_id"])
                new_ctx_id = ctx_id_map.get(lcp["context_id"])
                if new_leg_id and new_ctx_id:
                    LegendContextPlacement.objects.create(
                        legend_id=new_leg_id,
                        context_id=new_ctx_id,
                        order_index=lcp.get("order_index", 0),
                    )

            # ── 5. Categories ──
            cat_id_map = {}
            for cat in data["categories"]:
                new_cat = Category.objects.create(
                    owner=user,
                    name=cat["name"],
                    x=cat.get("x", 0),
                    y=cat.get("y", 0),
                    width=cat.get("width", 100),
                    height=cat.get("height", 100),
                    z_index=cat.get("z_index", 0),
                    archived=cat.get("archived", False),
                    is_public=cat.get("is_public", False),
                    filter_config=cat.get("filter_config"),
                )
                cat_id_map[cat["id"]] = new_cat.id

            # ── 6. Category-context placements ──
            for ccp in data["category_context_placements"]:
                new_cat_id = cat_id_map.get(ccp["category_id"])
                new_ctx_id = ctx_id_map.get(ccp["context_id"])
                if new_cat_id and new_ctx_id:
                    CategoryContextPlacement.objects.create(
                        category_id=new_cat_id,
                        context_id=new_ctx_id,
                        order_index=ccp.get("order_index", 0),
                    )

            # ── 7. Ideas + placements + assignments ──
            idea_id_map = {}
            for idea_data in data["ideas"]:
                new_idea = Idea.objects.create(
                    owner=user,
                    title=idea_data.get("title", ""),
                    description=idea_data.get("description", ""),
                    archived=idea_data.get("archived", False),
                )
                idea_id_map[idea_data["id"]] = new_idea.id

                # placements
                for pl in idea_data.get("placements", []):
                    new_cat_id = cat_id_map.get(pl["category_id"]) if pl["category_id"] else None
                    IdeaPlacement.objects.create(
                        idea=new_idea,
                        category_id=new_cat_id,
                        order_index=pl.get("order_index", 0),
                    )

                # legend type assignments
                for lta in idea_data.get("legend_type_assignments", []):
                    new_leg_id = legend_id_map.get(lta["legend_id"])
                    new_lt_id = legend_type_id_map.get(lta["legend_type_id"])
                    if new_leg_id and new_lt_id:
                        IdeaLegendType.objects.create(
                            idea=new_idea,
                            legend_id=new_leg_id,
                            legend_type_id=new_lt_id,
                        )

                # upvotes (only for this user)
                for uv in idea_data.get("upvotes", []):
                    if uv.get("user_id") == user.id:
                        IdeaUpvote.objects.create(user=user, idea=new_idea)

                # comments (only from this user)
                for cmt in idea_data.get("comments", []):
                    if cmt.get("user_id") == user.id:
                        IdeaComment.objects.create(
                            user=user, idea=new_idea, text=cmt.get("text", ""),
                        )

            # ── 8. Formations ──
            for fm in data["formations"]:
                new_ctx_id = ctx_id_map.get(fm.get("context_id"))
                state = _remap_formation_state(
                    fm.get("state", {}), cat_id_map, ctx_id_map,
                    legend_id_map, legend_type_id_map
                )
                Formation.objects.create(
                    owner=user,
                    context_id=new_ctx_id,
                    name=fm["name"],
                    state=state,
                    is_default=fm.get("is_default", False),
                )

            # ── 9. Shortcuts ──
            shortcuts_data = data.get("shortcuts", {})
            obj, _ = UserShortcuts.objects.get_or_create(user=user)
            obj.shortcuts = shortcuts_data
            obj.save()

            # ── 9b. Migrate legacy top-level filter_presets into the default context ──
            legacy_presets = data.get("filter_presets", [])
            if legacy_presets:
                # Find the default context (or first context) and inject presets into its filter_state
                default_ctx = Context.objects.filter(owner=user, is_default=True).first()
                if not default_ctx:
                    default_ctx = Context.objects.filter(owner=user).first()
                if default_ctx:
                    fs = default_ctx.filter_state or {}
                    if not fs.get("filter_presets"):
                        fs["filter_presets"] = legacy_presets
                        default_ctx.filter_state = fs
                        default_ctx.save()

        return JsonResponse({
            "status": "ok",
            "message": "Full IdeaBin restore completed successfully.",
        })

    except Exception as exc:
        return JsonResponse({"error": f"Import failed: {exc}"}, status=500)


# ─── deletion helpers ────────────────────────────────────

def _delete_context_data(user, ctx):
    """Delete all data attached to a single context (without deleting the context itself)."""
    # Categories in this context
    cat_ids = list(
        CategoryContextPlacement.objects.filter(context=ctx)
        .values_list("category_id", flat=True)
    )
    # Ideas placed in those categories
    idea_ids = set(
        IdeaPlacement.objects.filter(category_id__in=cat_ids)
        .values_list("idea_id", flat=True)
    )
    # Also include unassigned ideas owned by user
    unassigned_idea_ids = set(
        IdeaPlacement.objects.filter(idea__owner=user, category__isnull=True)
        .values_list("idea_id", flat=True)
    )
    all_idea_ids = idea_ids | unassigned_idea_ids

    # Delete in correct order
    IdeaLegendType.objects.filter(idea_id__in=all_idea_ids).delete()
    IdeaUpvote.objects.filter(idea_id__in=all_idea_ids).delete()
    IdeaComment.objects.filter(idea_id__in=all_idea_ids).delete()
    IdeaPlacement.objects.filter(idea_id__in=all_idea_ids).delete()
    Idea.objects.filter(id__in=all_idea_ids).delete()

    # Legend placements + legends
    legend_ids = list(
        LegendContextPlacement.objects.filter(context=ctx)
        .values_list("legend_id", flat=True)
    )
    LegendContextPlacement.objects.filter(context=ctx).delete()
    LegendType.objects.filter(legend_id__in=legend_ids).delete()
    Legend.objects.filter(id__in=legend_ids, owner=user).delete()

    # Category placements + categories
    CategoryContextPlacement.objects.filter(context=ctx).delete()
    Category.objects.filter(id__in=cat_ids, owner=user).delete()

    # Formations
    Formation.objects.filter(owner=user, context=ctx).delete()


def _delete_all_ideabin_data(user):
    """Delete ALL IdeaBin-related data for a user."""
    # Ideas
    idea_ids = set(Idea.objects.filter(owner=user).values_list("id", flat=True))
    IdeaLegendType.objects.filter(idea_id__in=idea_ids).delete()
    IdeaUpvote.objects.filter(idea_id__in=idea_ids).delete()
    IdeaComment.objects.filter(idea_id__in=idea_ids).delete()
    IdeaPlacement.objects.filter(idea_id__in=idea_ids).delete()
    Idea.objects.filter(owner=user).delete()

    # Legends + types
    legend_ids = set(Legend.objects.filter(owner=user).values_list("id", flat=True))
    LegendType.objects.filter(legend_id__in=legend_ids).delete()
    LegendContextPlacement.objects.filter(legend_id__in=legend_ids).delete()
    Legend.objects.filter(owner=user).delete()

    # Categories
    cat_ids = set(Category.objects.filter(owner=user).values_list("id", flat=True))
    CategoryContextPlacement.objects.filter(category_id__in=cat_ids).delete()
    Category.objects.filter(owner=user).delete()

    # Contexts
    Context.objects.filter(owner=user).delete()

    # Formations
    Formation.objects.filter(owner=user).delete()

    # Adoptions
    UserCategoryAdoption.objects.filter(user=user).delete()
    UserLegendAdoption.objects.filter(user=user).delete()
    UserContextAdoption.objects.filter(user=user).delete()


# ─── formation state remapping ───────────────────────────

def _remap_formation_state(state, cat_map, ctx_map, legend_map, lt_map):
    """
    Remap old IDs inside a formation's state JSON to the newly created IDs.
    Handles:
      - category_positions: { "<old_cat_id>": {...} } → { "<new_cat_id>": {...} }
      - context_positions: { "<old_ctx_id>": {...} } → { "<new_ctx_id>": {...} }
      - minimized_categories: { "<old_cat_id>": true } → { "<new_cat_id>": true }
      - minimized_contexts: same pattern
      - selected_category_id
      - active_legend_id
      - list_filter (if numeric = category id)
    """
    if not isinstance(state, dict):
        return state

    new_state = dict(state)

    # Remap dict-keyed fields
    for key, id_map in [
        ("category_positions", cat_map),
        ("minimized_categories", cat_map),
        ("collapsed_ideas", {}),  # placement IDs change, can't reliably remap — clear
        ("context_positions", ctx_map),
        ("minimized_contexts", ctx_map),
    ]:
        old_dict = new_state.get(key)
        if isinstance(old_dict, dict) and id_map:
            new_state[key] = {
                str(id_map.get(int(k), k)): v
                for k, v in old_dict.items()
            }
        elif isinstance(old_dict, dict) and not id_map:
            new_state[key] = {}  # clear unmappable

    # Remap scalar ID fields
    sel_cat = new_state.get("selected_category_id")
    if sel_cat and isinstance(sel_cat, int):
        new_state["selected_category_id"] = cat_map.get(sel_cat)

    active_leg = new_state.get("active_legend_id")
    if active_leg and isinstance(active_leg, int):
        new_state["active_legend_id"] = legend_map.get(active_leg)

    # list_filter can be "all", "unassigned", or a category id (int)
    lf = new_state.get("list_filter")
    if isinstance(lf, int):
        new_state["list_filter"] = cat_map.get(lf, lf)
    elif isinstance(lf, str):
        try:
            lf_int = int(lf)
            new_state["list_filter"] = str(cat_map.get(lf_int, lf_int))
        except (ValueError, TypeError):
            pass  # keep as-is ("all", "unassigned")

    return new_state
