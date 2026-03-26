from django.db import transaction

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Team
from .serializers import (
    TeamExpandedSerializer,
    BasicTeamSerializer,
    TeamSerializer_Deps,
)
from .helpers import user_has_project_access, resolve_branch

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def join_team(request, project_id, team_id):
    try:
        team = Team.objects.select_related("project").get(id=team_id, project_id=project_id)
    except Team.DoesNotExist:
        return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, team.project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    if team.members.filter(id=request.user.id).exists():
        return Response({"detail": "Already a member of this team."}, status=status.HTTP_400_BAD_REQUEST)

    team.members.add(request.user)
    serializer = TeamExpandedSerializer(team)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_team(request, project_id, team_id):
    try:
        team = Team.objects.select_related("project").get(id=team_id, project_id=project_id)
    except Team.DoesNotExist:
        return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, team.project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    if not team.members.filter(id=request.user.id).exists():
        return Response({"detail": "You are not a member of this team."}, status=status.HTTP_400_BAD_REQUEST)

    team.members.remove(request.user)
    serializer = TeamExpandedSerializer(team)
    return Response(serializer.data, status=status.HTTP_200_OK)


# project_teams
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def project_teams(request, project_id):
    """
    GET  -> alle Teams eines Projekts
    POST -> neues Team im Projekt anlegen
    """
    user = request.user

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(user, project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        teams = project.teams.filter(branch=branch).order_by("name")
        serializer = BasicTeamSerializer(teams, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # POST → Team erstellen
    serializer = BasicTeamSerializer(data=request.data)
    if serializer.is_valid():
        team = serializer.save(project=project, branch=branch)
        out = BasicTeamSerializer(team).data
        return Response(out, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# project_teams_expanded
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def project_teams_expanded(request, project_id):
    user = request.user

    try:
        project = Project.objects.get(id=project_id)
    except:
        return Response({"detail": "Project not found"}, status=404)

    if not user_has_project_access(user, project):
        return Response({"detail": "Not allowed"}, status=403)

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    all_teams = (
        Team.objects
        .prefetch_related(
            "tasks",
            "tasks__milestones",  # was "tasks__attempts"
        )
        .filter(project_id=project_id, branch=branch)
    )

    serializer = TeamExpandedSerializer(all_teams, many=True)
    return Response({"teams": serializer.data}, status=status.HTTP_200_OK)


# project_team_detail (for now only delete)
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def project_team_detail(request, project_id, team_id):
    """DELETE a single team in a project."""

    user = request.user

    # Find team within this project
    try:
        team = Team.objects.select_related("project").get(
            id=team_id,
            project_id=project_id,
        )
    except Team.DoesNotExist:
        return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

    # Permission check based on project
    if not user_has_project_access(user, team.project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    # Delete team
    team.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# reorder_project_teams
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def reorder_project_teams(request, project_id):
    """
    Body:
      { "order": [26, 28, 40, 41] }   # team ids (ints), in desired order
    """
    order = request.data.get("order", None)

    if not isinstance(order, list) or not all(isinstance(x, int) for x in order):
        return Response(
            {"detail": "Expected body {order: [int, int, ...]}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # only teams of this project
    qs = Team.objects.filter(project_id=project_id, id__in=order)

    existing_ids = set(qs.values_list("id", flat=True))
    missing = [tid for tid in order if tid not in existing_ids]
    if missing:
        return Response(
            {"detail": "Some team ids not found in this project", "missing": missing},
            status=status.HTTP_400_BAD_REQUEST
        )

    with transaction.atomic():
        for idx, team_id in enumerate(order):
            Team.objects.filter(project_id=project_id, id=team_id).update(line_index=idx)

    return Response({"ok": True, "saved_order": order}, status=status.HTTP_200_OK)


# team_detail_view
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def team_detail_view(request, project_id, team_id):
    """
    GET: Retrieve a single team with its tasks
    PATCH: Update team properties (name, color, etc.)
    """
    user = request.user

    try:
        team = Team.objects.select_related("project").prefetch_related("tasks").get(
            id=team_id,
            project_id=project_id,
        )
    except Team.DoesNotExist:
        return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

    # Permission check
    if not user_has_project_access(user, team.project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        serializer = TeamExpandedSerializer(team)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # PATCH: Update team
    if request.method == "PATCH":
        data = request.data

        if "name" in data:
            name = data["name"].strip()
            if name:
                team.name = name

        if "color" in data:
            team.color = data["color"]

        team.save()

        serializer = TeamExpandedSerializer(team)
        return Response(serializer.data, status=status.HTTP_200_OK)


# user_teams
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_teams(request):
    user = request.user
    teams = Team.objects.filter(members=user).select_related("project").order_by("name")
    data = [
        {
            "id": t.id,
            "name": t.name,
            "color": t.color,
            "project_id": t.project_id,
            "project_name": t.project.name if t.project else None,
        }
        for t in teams
    ]
    return Response({"teams": data}, status=status.HTTP_200_OK)


# _____________________________ DEPENDENCY VIEW TEAM FUNCTIONS ______________________________

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fetch_project_teams(request, project_id):
    """
    Fetch all teams for a project ordered by order_index.
    Used by the Dependencies view.
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

    all_teams = Team.objects.filter(project=project, branch=branch).order_by("order_index")
    serialized_teams = TeamSerializer_Deps(all_teams, many=True)

    return Response({"teams": serialized_teams.data})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def safe_team_order(request, project_id):
    """
    Save the team order for a project.
    Body: { "order": [team_id, team_id, ...] }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    order = request.data.get("order")

    if not isinstance(order, list):
        return Response({"error": "order must be a list"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        for index, team_id in enumerate(order):
            Team.objects.filter(id=team_id, project=project).update(order_index=index)

    return Response({"status": "ok"})