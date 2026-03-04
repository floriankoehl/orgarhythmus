from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Workspace, Project


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


def _serialize_workspace(w, include_state=False):
    d = {
        "id": w.id,
        "name": w.name,
        "is_default": w.is_default,
        "created_by": w.created_by_id,
        "updated_at": w.updated_at.isoformat(),
        "created_at": w.created_at.isoformat(),
    }
    if include_state:
        d["state"] = w.state
    return d


# ═══════════════════════════════════════════════════════
#  CRUD
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_workspaces(request, project_id):
    """List all workspaces for a project (no state blob — lightweight)."""
    project = _ensure_project_access(request.user, project_id)
    qs = Workspace.objects.filter(project=project)
    return Response({"workspaces": [_serialize_workspace(w) for w in qs]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_workspace(request, project_id):
    """Create a new workspace."""
    project = _ensure_project_access(request.user, project_id)
    name = (request.data.get("name") or "").strip() or "Unnamed Workspace"
    state = request.data.get("state", {})
    w = Workspace.objects.create(
        project=project, name=name, state=state, created_by=request.user
    )
    return Response(_serialize_workspace(w, include_state=True), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_workspace(request, workspace_id):
    """Get a single workspace with full state."""
    w = Workspace.objects.filter(pk=workspace_id).first()
    if not w:
        return Response({"error": "Not found"}, status=404)
    _ensure_project_access(request.user, w.project_id)
    return Response(_serialize_workspace(w, include_state=True))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_workspace(request, workspace_id):
    """Update a workspace's name and/or state."""
    w = Workspace.objects.filter(pk=workspace_id).first()
    if not w:
        return Response({"error": "Not found"}, status=404)
    _ensure_project_access(request.user, w.project_id)
    name = request.data.get("name")
    state = request.data.get("state")
    if name is not None:
        w.name = name.strip() or w.name
    if state is not None:
        w.state = state
    w.save()
    return Response(_serialize_workspace(w, include_state=True))


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_workspace(request, workspace_id):
    """Delete a workspace."""
    w = Workspace.objects.filter(pk=workspace_id).first()
    if not w:
        return Response({"error": "Not found"}, status=404)
    _ensure_project_access(request.user, w.project_id)
    w.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_default_workspace(request, workspace_id):
    """Toggle a workspace as default for its project. Only one default per project."""
    w = Workspace.objects.filter(pk=workspace_id).first()
    if not w:
        return Response({"error": "Not found"}, status=404)
    _ensure_project_access(request.user, w.project_id)
    if w.is_default:
        w.is_default = False
        w.save()
    else:
        Workspace.objects.filter(project=w.project, is_default=True).update(is_default=False)
        w.is_default = True
        w.save()
    return Response({"id": w.id, "name": w.name, "is_default": w.is_default})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_default_workspace(request, project_id):
    """Get the default workspace for a project (if any) with full state."""
    project = _ensure_project_access(request.user, project_id)
    w = Workspace.objects.filter(project=project, is_default=True).first()
    if not w:
        return Response({"workspace": None})
    return Response({"workspace": _serialize_workspace(w, include_state=True)})
