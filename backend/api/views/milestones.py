from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Task, Milestone
from .serializers import MilestoneSerializer_Deps
from .helpers import user_has_project_access


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_milestones(request, project_id):
    """
    Get all milestones for a project.
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    all_milestones = Milestone.objects.filter(project=project)
    if all_milestones.exists():
        serialized = MilestoneSerializer_Deps(all_milestones, many=True)
        return Response({"milestones": serialized.data})
    else: 
        return Response({"milestones": []})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_milestone(request, project_id):
    """
    Add a new milestone to a task.
    Body: { "task_id": <id> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    task_id = request.data.get("task_id")
    if not task_id:
        return Response({"detail": "task_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        task = Task.objects.get(id=int(task_id), project=project)
    except Task.DoesNotExist:
        return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

    name = f"{task.name}_0"
    start_index = 0
    duration = 1
    milestone, created = Milestone.objects.get_or_create(
        project=project,
        name=name,
        task=task,
        start_index=start_index,
        duration=duration
    )

    serialized = MilestoneSerializer_Deps(milestone)

    return Response({"added_milestone": serialized.data, "created": created})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_start_index(request, project_id):
    """
    Update a milestone's start index.
    Body: { "milestone_id": <id>, "index": <new_index> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    new_index = request.data.get("index")
    milestone_id = request.data.get("milestone_id")

    if new_index is None or milestone_id is None:
        return Response({"detail": "milestone_id and index are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    milestone.start_index = new_index
    milestone.save()
    return Response({"updated": "true"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_milestones(request, project_id):
    """
    Delete a milestone.
    Body: { "id": <milestone_id> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("id")
    if not milestone_id:
        return Response({"detail": "id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    milestone.delete()
    return Response({"deleted": True}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def change_duration(request, project_id):
    """
    Change a milestone's duration.
    Body: { "id": <milestone_id>, "change": <delta> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("id")
    change = request.data.get("change")

    if milestone_id is None or change is None:
        return Response({"detail": "id and change are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    duration = milestone.duration + change

    if duration < 1: 
        duration = 1

    data = {
        "duration": duration
    }
    serializer = MilestoneSerializer_Deps(milestone, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"succesfull": True, "data": serializer.data}, status=200)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def rename_milestone(request, project_id):
    """
    Rename a milestone.
    Body: { "id": <milestone_id>, "name": <new_name> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("id")
    new_name = request.data.get("name")

    if not milestone_id or not new_name:
        return Response({"detail": "Missing id or name"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    milestone.name = new_name.strip()
    milestone.save()

    serializer = MilestoneSerializer_Deps(milestone)
    return Response({"success": True, "data": serializer.data}, status=200)