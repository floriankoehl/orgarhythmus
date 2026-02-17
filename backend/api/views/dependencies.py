from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Milestone, Dependency
from .serializers import DependencySerializer_Deps
from .helpers import user_has_project_access


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_dependencies(request, project_id):
    """
    Get all dependencies (connections between milestones) for a project.
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    dependencies = Dependency.objects.filter(source__project=project)
    serialized = DependencySerializer_Deps(dependencies, many=True)
    return Response({"dependencies": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_dependency(request, project_id):
    """
    Create a dependency between two milestones.
    Body: { "source": <milestone_id>, "target": <milestone_id> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    source_id = request.data.get("source")
    target_id = request.data.get("target")

    if not source_id or not target_id:
        return Response({"detail": "source and target are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        source = Milestone.objects.get(id=source_id, project=project)
        target = Milestone.objects.get(id=target_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found in this project"}, status=status.HTTP_404_NOT_FOUND)

    dependency, created = Dependency.objects.get_or_create(source=source, target=target)
    serialized = DependencySerializer_Deps(dependency)
    return Response(
        {"dependency": serialized.data, "created": created}, 
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_dependency(request, project_id):
    """
    Delete a dependency between two milestones.
    Body: { "source": <milestone_id>, "target": <milestone_id> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    source_id = request.data.get("source")
    target_id = request.data.get("target")

    if not source_id or not target_id:
        return Response({"detail": "source and target are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        dependency = Dependency.objects.get(
            source_id=source_id,
            target_id=target_id,
            source__project=project
        )
    except Dependency.DoesNotExist:
        return Response({"detail": "Dependency not found"}, status=status.HTTP_404_NOT_FOUND)

    dependency.delete()
    return Response({"deleted": True}, status=status.HTTP_200_OK)
