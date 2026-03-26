from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Phase, Team
from .serializers import PhaseSerializer
from .helpers import user_has_project_access, resolve_branch


def _check_phase_overlap(project, start_index, duration, team_id, exclude_phase_id=None, branch=None):
    """
    Check if a phase would overlap with existing phases.
    Rules:
      - Global phases (team=null) cannot overlap other global phases.
      - Team-specific phases cannot overlap other phases for the SAME team.
      - Team-specific phases CAN overlap global phases and phases for different teams.
    Returns list of overlapping phase names, or empty list if no overlap.
    """
    end_index = start_index + duration
    candidates = Phase.objects.filter(project=project)
    if branch is not None:
        candidates = candidates.filter(branch=branch)
    if exclude_phase_id:
        candidates = candidates.exclude(pk=exclude_phase_id)

    if team_id is None:
        # Global phase: only conflicts with other global phases
        candidates = candidates.filter(team__isnull=True)
    else:
        # Team phase: only conflicts with other phases for the same team
        candidates = candidates.filter(team_id=team_id)

    overlapping = []
    for other in candidates:
        if start_index < other.start_index + other.duration and other.start_index < end_index:
            overlapping.append(other.name)
    return overlapping


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

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    phases = Phase.objects.filter(project=project, branch=branch)
    serialized = PhaseSerializer(phases, many=True)
    return Response({"phases": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_phase(request, project_id):
    """
    Create a new phase.
    Body: { "name": str, "start_index": int, "duration": int, "color"?: str, "team"?: int|null }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    name = request.data.get("name", "New Phase")
    start_index = int(request.data.get("start_index", 0))
    duration = int(request.data.get("duration", 1))
    color = request.data.get("color", "#3b82f6")
    team_id = request.data.get("team", None)

    if start_index < 0:
        return Response({"detail": "start_index must be >= 0"}, status=status.HTTP_400_BAD_REQUEST)
    if duration < 1:
        return Response({"detail": "duration must be >= 1"}, status=status.HTTP_400_BAD_REQUEST)

    # Validate team exists if provided
    team = None
    if team_id is not None:
        try:
            team = Team.objects.get(pk=int(team_id), project=project, branch=branch)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found"}, status=status.HTTP_404_NOT_FOUND)

    # Check overlap
    overlapping = _check_phase_overlap(project, start_index, duration, team.id if team else None, branch=branch)
    if overlapping:
        return Response({
            "detail": f"Phase overlaps with: {', '.join(overlapping)}",
            "overlapping_phases": overlapping,
        }, status=status.HTTP_409_CONFLICT)

    # Auto order_index
    max_order = Phase.objects.filter(project=project, branch=branch).count()

    phase = Phase.objects.create(
        project=project,
        branch=branch,
        team=team,
        name=name,
        start_index=start_index,
        duration=duration,
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
    Body: any of { "name", "start_index", "duration", "color", "order_index", "team" }
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
    if "team" in request.data:
        team_id = request.data["team"]
        if team_id is None:
            phase.team = None
        else:
            try:
                phase.team = Team.objects.get(pk=int(team_id), project=project)
            except Team.DoesNotExist:
                return Response({"detail": "Team not found"}, status=status.HTTP_404_NOT_FOUND)

    # Check overlap with new values
    overlapping = _check_phase_overlap(
        project, phase.start_index, phase.duration,
        phase.team_id, exclude_phase_id=phase.id, branch=phase.branch
    )
    if overlapping:
        return Response({
            "detail": f"Phase overlaps with: {', '.join(overlapping)}",
            "overlapping_phases": overlapping,
        }, status=status.HTTP_409_CONFLICT)

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
