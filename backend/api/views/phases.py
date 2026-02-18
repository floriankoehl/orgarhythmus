from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Phase
from .serializers import PhaseSerializer
from .helpers import user_has_project_access


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_phases(request, project_id):
    """Get all phases for a project."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    phases = Phase.objects.filter(project=project)
    serialized = PhaseSerializer(phases, many=True)
    return Response({"phases": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_phase(request, project_id):
    """
    Create a new phase.
    Body: { "name": str, "start_index": int, "duration": int, "color"?: str }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = request.data.get("name", "New Phase")
    start_index = request.data.get("start_index", 0)
    duration = request.data.get("duration", 1)
    color = request.data.get("color", "#3b82f6")

    if int(start_index) < 0:
        return Response({"detail": "start_index must be >= 0"}, status=status.HTTP_400_BAD_REQUEST)
    if int(duration) < 1:
        return Response({"detail": "duration must be >= 1"}, status=status.HTTP_400_BAD_REQUEST)

    # Auto order_index
    max_order = Phase.objects.filter(project=project).count()

    phase = Phase.objects.create(
        project=project,
        name=name,
        start_index=int(start_index),
        duration=int(duration),
        color=color,
        order_index=max_order,
    )

    serialized = PhaseSerializer(phase)
    return Response({"phase": serialized.data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_phase(request, project_id, phase_id):
    """
    Update a phase's fields.
    Body: any of { "name", "start_index", "duration", "color", "order_index" }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        phase = Phase.objects.get(pk=phase_id, project=project)
    except Phase.DoesNotExist:
        return Response({"detail": "Phase not found"}, status=status.HTTP_404_NOT_FOUND)

    if "name" in request.data:
        phase.name = request.data["name"]
    if "start_index" in request.data:
        si = int(request.data["start_index"])
        if si < 0:
            return Response({"detail": "start_index must be >= 0"}, status=status.HTTP_400_BAD_REQUEST)
        phase.start_index = si
    if "duration" in request.data:
        d = int(request.data["duration"])
        if d < 1:
            return Response({"detail": "duration must be >= 1"}, status=status.HTTP_400_BAD_REQUEST)
        phase.duration = d
    if "color" in request.data:
        phase.color = request.data["color"]
    if "order_index" in request.data:
        phase.order_index = int(request.data["order_index"])

    phase.save()
    serialized = PhaseSerializer(phase)
    return Response({"phase": serialized.data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_phase(request, project_id, phase_id):
    """Delete a phase."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        phase = Phase.objects.get(pk=phase_id, project=project)
    except Phase.DoesNotExist:
        return Response({"detail": "Phase not found"}, status=status.HTTP_404_NOT_FOUND)

    phase.delete()
    return Response({"deleted": True}, status=status.HTTP_200_OK)
