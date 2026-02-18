from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, DependencyView
from .serializers import DependencyViewSerializer
from .helpers import user_has_project_access


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_views(request, project_id):
    """Get all saved dependency views for a project."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    views = DependencyView.objects.filter(project=project)
    serialized = DependencyViewSerializer(views, many=True)
    return Response({"views": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_view(request, project_id):
    """
    Create a new dependency view.
    Body: { "name": str, "state": {...} }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = str(request.data.get("name", "")).strip()
    if not name:
        return Response({"detail": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

    state = request.data.get("state", {})

    # Check unique name per project
    if DependencyView.objects.filter(project=project, name=name).exists():
        return Response({"detail": f"A view named '{name}' already exists"}, status=status.HTTP_409_CONFLICT)

    view = DependencyView.objects.create(
        project=project,
        name=name,
        state=state,
        created_by=request.user,
    )

    serialized = DependencyViewSerializer(view)
    return Response({"view": serialized.data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_view(request, project_id, view_id):
    """
    Update a view's name and/or state.
    Body: any of { "name", "state" }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        view = DependencyView.objects.get(pk=view_id, project=project)
    except DependencyView.DoesNotExist:
        return Response({"detail": "View not found"}, status=status.HTTP_404_NOT_FOUND)

    if "name" in request.data:
        new_name = str(request.data["name"]).strip()
        if not new_name:
            return Response({"detail": "Name cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
        # Check uniqueness if name changed
        if new_name != view.name and DependencyView.objects.filter(project=project, name=new_name).exists():
            return Response({"detail": f"A view named '{new_name}' already exists"}, status=status.HTTP_409_CONFLICT)
        view.name = new_name

    if "state" in request.data:
        view.state = request.data["state"]

    view.save()
    serialized = DependencyViewSerializer(view)
    return Response({"view": serialized.data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_view(request, project_id, view_id):
    """Delete a dependency view."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        view = DependencyView.objects.get(pk=view_id, project=project)
    except DependencyView.DoesNotExist:
        return Response({"detail": "View not found"}, status=status.HTTP_404_NOT_FOUND)

    view.delete()
    return Response({"detail": "View deleted"})
