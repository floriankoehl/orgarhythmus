from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import TaskStructureView, Project


# ═══════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════

def _ensure_project_access(user, project_id):
    """Return the project if the user is owner or member; 404 otherwise."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        from django.http import Http404
        raise Http404
    if project.owner == user or project.members.filter(pk=user.pk).exists():
        return project
    from django.http import Http404
    raise Http404


def _serialize_view(v, include_state=False):
    d = {
        "id": v.id,
        "name": v.name,
        "is_default": v.is_default,
        "updated_at": v.updated_at.isoformat(),
        "created_at": v.created_at.isoformat(),
    }
    if include_state:
        d["state"] = v.state
    return d


# ═══════════════════════════════════════════════════════
#  CRUD
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_ts_views(request, project_id):
    """List all saved task-structure views for a project (no state blob)."""
    project = _ensure_project_access(request.user, project_id)
    qs = TaskStructureView.objects.filter(project=project, owner=request.user)
    return Response({"views": [_serialize_view(v) for v in qs]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_ts_view(request, project_id):
    """Create a new task-structure view."""
    project = _ensure_project_access(request.user, project_id)
    name = (request.data.get("name") or "").strip() or "Unnamed View"
    state = request.data.get("state", {})
    v = TaskStructureView.objects.create(
        owner=request.user, project=project, name=name, state=state
    )
    return Response(_serialize_view(v, include_state=True), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_ts_view(request, view_id):
    """Get a single view with full state."""
    v = TaskStructureView.objects.filter(pk=view_id, owner=request.user).first()
    if not v:
        return Response({"error": "Not found"}, status=404)
    return Response(_serialize_view(v, include_state=True))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_ts_view(request, view_id):
    """Update a view's name and/or state."""
    v = TaskStructureView.objects.filter(pk=view_id, owner=request.user).first()
    if not v:
        return Response({"error": "Not found"}, status=404)
    name = request.data.get("name")
    state = request.data.get("state")
    if name is not None:
        v.name = name.strip() or v.name
    if state is not None:
        v.state = state
    v.save()
    return Response(_serialize_view(v, include_state=True))


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_ts_view(request, view_id):
    """Delete a task-structure view."""
    v = TaskStructureView.objects.filter(pk=view_id, owner=request.user).first()
    if not v:
        return Response({"error": "Not found"}, status=404)
    v.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_default_ts_view(request, view_id):
    """Toggle a view as default for its project. Only one default per project+user."""
    v = TaskStructureView.objects.filter(pk=view_id, owner=request.user).first()
    if not v:
        return Response({"error": "Not found"}, status=404)
    if v.is_default:
        v.is_default = False
        v.save()
    else:
        TaskStructureView.objects.filter(
            project=v.project, owner=request.user, is_default=True
        ).update(is_default=False)
        v.is_default = True
        v.save()
    return Response({"id": v.id, "name": v.name, "is_default": v.is_default})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_default_ts_view(request, project_id):
    """Get the default view for a project (if any) with full state."""
    project = _ensure_project_access(request.user, project_id)
    v = TaskStructureView.objects.filter(
        project=project, owner=request.user, is_default=True
    ).first()
    if not v:
        return Response({"view": None})
    return Response({"view": _serialize_view(v, include_state=True)})
