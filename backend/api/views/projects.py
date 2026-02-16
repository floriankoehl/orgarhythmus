from datetime import date

from django.db.models import Q

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project
from .serializers import ProjectSerializer
from .helpers import user_has_project_access


# List Projects
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_projects(request):
    """
    List all projects the current user is involved in
    (owner or member).
    """
    user = request.user
    projects = (
        Project.objects
        .filter(Q(owner=user) | Q(members=user))
        .distinct()
        .order_by("-created_at")
    )
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# NEW: list_all_projects
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_all_projects(request):
    """
    List ALL projects in the system, with info about user's relationship to each.
    """
    user = request.user
    all_projects = Project.objects.all().order_by("-created_at")

    serializer = ProjectSerializer(all_projects, many=True)
    data = serializer.data

    # Add membership info for each project
    for project_data in data:
        project = Project.objects.get(id=project_data['id'])
        project_data['is_owner'] = project.owner == user
        project_data['is_member'] = user in project.members.all()

    return Response(data, status=status.HTTP_200_OK)


# NEW: join_project
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def join_project(request, pk):
    """
    Join a project as a member.
    """
    user = request.user

    try:
        project = Project.objects.get(id=pk)
    except Project.DoesNotExist:
        return Response(
            {"detail": "Project not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Check if already a member or owner
    if project.owner == user or user in project.members.all():
        return Response(
            {"detail": "Already a member or owner of this project."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Add user as member
    project.members.add(user)

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_200_OK)


# NEW: leave_project
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_project(request, pk):
    """
    Leave a project (remove self from members).
    """
    user = request.user

    try:
        project = Project.objects.get(id=pk)
    except Project.DoesNotExist:
        return Response(
            {"detail": "Project not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Check if owner (can't leave own project)
    if project.owner == user:
        return Response(
            {"detail": "Project owner cannot leave their own project."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Remove from members
    if user in project.members.all():
        project.members.remove(user)

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_200_OK)


# create_project
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project(request):
    """
    Create a new project for the current user.
    Body: { "name": "...", "description": "...", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }
    """
    data = request.data
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    if not name:
        return Response(
            {"detail": "Name is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    project = Project.objects.create(
        owner=request.user,
        name=name,
        description=description or "",
        start_date=start_date or None,
        end_date=end_date or None,
    )
    # Optional: Owner auch gleich als Mitglied hinzufügen
    project.members.add(request.user)

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# get_project
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project(request, pk):
    """
    Return one project if the user is owner or member.
    """
    user = request.user

    try:
        project = (
            Project.objects
            .filter(Q(id=pk) & (Q(owner=user) | Q(members=user)))
            .distinct()
            .first()
        )

        if not project:
            return Response(
                {"detail": "Project not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ProjectSerializer(project)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"detail": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# delete_project
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_project(request, pk):
    """
    Delete a project (only owner can delete).
    """
    user = request.user

    try:
        project = Project.objects.get(id=pk)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    # Only owner can delete
    if project.owner_id != user.id:
        return Response({"detail": "Only project owner can delete"}, status=status.HTTP_403_FORBIDDEN)

    project.delete()
    return Response({"detail": "Project deleted successfully"}, status=status.HTTP_204_NO_CONTENT)


# update_project
@api_view(["PATCH", "PUT"])
@permission_classes([IsAuthenticated])
def update_project(request, pk):
    """
    Update a project (name, description, dates, etc.)
    Only owner can update.
    """
    user = request.user

    try:
        project = Project.objects.get(id=pk)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(user, project):
        return Response({"detail": "You don't have access to this project"}, status=status.HTTP_403_FORBIDDEN)

    if project.owner_id != user.id:
        return Response({"detail": "Only project owner can update project"}, status=status.HTTP_403_FORBIDDEN)

    data = request.data

    # existing fields
    if "name" in data:
        project.name = data["name"]
    if "description" in data:
        project.description = data["description"]

    # NEW: dates
    if "start_date" in data:
        sd = data.get("start_date")
        project.start_date = date.fromisoformat(sd) if sd else None

    if "end_date" in data:
        ed = data.get("end_date")
        project.end_date = date.fromisoformat(ed) if ed else None

    project.save()

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_200_OK)