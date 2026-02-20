from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, ProtoPersona, Milestone, Team, Task
from .serializers import ProtoPersonaSerializer
from .helpers import user_has_project_access


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_protopersonas(request, project_id):
    """Get all protopersonas for a project."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    personas = ProtoPersona.objects.filter(project=project).prefetch_related("milestones", "teams", "tasks")
    serialized = ProtoPersonaSerializer(personas, many=True)
    return Response({"personas": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_protopersona(request, project_id):
    """
    Create a new protopersona.
    Body: { "name": str, "color": str, "x": float, "z": float,
            "milestones": [int], "teams": [int], "tasks": [int] }
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

    color = request.data.get("color", "#f87171")
    x = float(request.data.get("x", 0))
    z = float(request.data.get("z", 0))

    persona = ProtoPersona.objects.create(
        project=project,
        name=name,
        color=color,
        x=x,
        z=z,
        created_by=request.user,
    )

    # Set M2M relationships
    milestone_ids = request.data.get("milestones", [])
    if milestone_ids:
        valid_milestones = Milestone.objects.filter(pk__in=milestone_ids, project=project)
        persona.milestones.set(valid_milestones)

    team_ids = request.data.get("teams", [])
    if team_ids:
        valid_teams = Team.objects.filter(pk__in=team_ids, project=project)
        persona.teams.set(valid_teams)

    task_ids = request.data.get("tasks", [])
    if task_ids:
        valid_tasks = Task.objects.filter(pk__in=task_ids)
        persona.tasks.set(valid_tasks)

    serialized = ProtoPersonaSerializer(persona)
    return Response({"persona": serialized.data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_protopersona(request, project_id, persona_id):
    """
    Update a protopersona's position, M2M assignments, name, or color.
    Body: any of { "name", "color", "x", "z", "milestones": [int], "teams": [int], "tasks": [int] }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        persona = ProtoPersona.objects.get(pk=persona_id, project=project)
    except ProtoPersona.DoesNotExist:
        return Response({"detail": "Persona not found"}, status=status.HTTP_404_NOT_FOUND)

    if "name" in request.data:
        persona.name = str(request.data["name"]).strip() or persona.name
    if "color" in request.data:
        persona.color = request.data["color"]
    if "x" in request.data:
        persona.x = float(request.data["x"])
    if "z" in request.data:
        persona.z = float(request.data["z"])

    persona.save()

    # Update M2M relationships (use .set() to replace all)
    if "milestones" in request.data:
        milestone_ids = request.data["milestones"]
        if milestone_ids is None or milestone_ids == []:
            persona.milestones.clear()
        else:
            valid_milestones = Milestone.objects.filter(pk__in=milestone_ids, project=project)
            persona.milestones.set(valid_milestones)

    if "teams" in request.data:
        team_ids = request.data["teams"]
        if team_ids is None or team_ids == []:
            persona.teams.clear()
        else:
            valid_teams = Team.objects.filter(pk__in=team_ids, project=project)
            persona.teams.set(valid_teams)

    if "tasks" in request.data:
        task_ids = request.data["tasks"]
        if task_ids is None or task_ids == []:
            persona.tasks.clear()
        else:
            valid_tasks = Task.objects.filter(pk__in=task_ids)
            persona.tasks.set(valid_tasks)

    serialized = ProtoPersonaSerializer(persona)
    return Response({"persona": serialized.data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_protopersona(request, project_id, persona_id):
    """Delete a protopersona."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        persona = ProtoPersona.objects.get(pk=persona_id, project=project)
    except ProtoPersona.DoesNotExist:
        return Response({"detail": "Persona not found"}, status=status.HTTP_404_NOT_FOUND)

    persona.delete()
    return Response({"detail": "Persona deleted"})
