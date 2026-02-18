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

    # Prevent self-dependency
    if source_id == target_id:
        return Response({"detail": "A milestone cannot depend on itself"}, status=status.HTTP_400_BAD_REQUEST)

    # Prevent reverse/circular dependency
    if Dependency.objects.filter(source=target, target=source).exists():
        return Response({"detail": "Reverse dependency already exists — would create a cycle"}, status=status.HTTP_400_BAD_REQUEST)

    # Validate scheduling: source must finish before target starts
    source_end_index = source.start_index + (source.duration or 1) - 1
    if source_end_index >= target.start_index:
        return Response(
            {"detail": "Cannot create dependency: source milestone must finish before target milestone starts"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    dependency, created = Dependency.objects.get_or_create(source=source, target=target)

    # Apply optional weight and reason
    weight = request.data.get("weight")
    reason = request.data.get("reason")
    updated = False
    if weight and weight in dict(Dependency.WEIGHT_CHOICES):
        dependency.weight = weight
        updated = True
    if reason is not None:
        dependency.reason = reason if reason != "" else None
        updated = True
    if updated:
        dependency.save()

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


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_dependency(request, project_id):
    """
    Update a dependency's weight and/or reason.
    Body: { "source": <id>, "target": <id>, "weight"?: str, "reason"?: str|null }
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
            source__project=project,
        )
    except Dependency.DoesNotExist:
        return Response({"detail": "Dependency not found"}, status=status.HTTP_404_NOT_FOUND)

    weight = request.data.get("weight")
    reason = request.data.get("reason")

    if weight is not None:
        if weight not in dict(Dependency.WEIGHT_CHOICES):
            return Response({"detail": f"Invalid weight: {weight}"}, status=status.HTTP_400_BAD_REQUEST)
        dependency.weight = weight

    if "reason" in request.data:
        dependency.reason = reason if reason else None

    dependency.save()

    serialized = DependencySerializer_Deps(dependency)
    return Response({"dependency": serialized.data}, status=status.HTTP_200_OK)
