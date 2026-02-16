from django.conf import settings
from django.contrib.auth.models import User

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Team, Task, Notification, Milestone, Dependency
from .serializers import (
    TaskSerializer_TeamView, 
    TaskExpandedSerializer,
    ProjectSerializer_Deps,
    TeamSerializer_Deps,
    MilestoneSerializer_Deps,
    TaskSerializer_Deps,
    DependencySerializer_Deps
    )
from .helpers import user_has_project_access
from rest_framework import status
from django.db import transaction


# delete_task_by_id
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_task_by_id(request, project_id, task_id):
    """
    Delete a task by ID (only if user has access to the project).
    """
    print("Inside this function")
    if settings.DEBUG:
        print("Inside delete_task_by_id - DEBUG is True")

    if not settings.DEBUG:
        print("OK its false sucesfully")

    # 1) Try to load the task inside the given project
    try:
        task = Task.objects.select_related("project").get(
            id=task_id,
            project_id=project_id,
        )
    except Task.DoesNotExist:
        return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

    # 2) Check user access to this project
    if not user_has_project_access(request.user, task.project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    # 3) Delete
    task.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# project_tasks
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def project_tasks(request, project_id):
    # 1) Projekt prüfen
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response(
            {"detail": "Project not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # 1b) Zugriffsprüfung
    if not user_has_project_access(request.user, project):
        return Response(
            {"detail": "Project not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # 2) GET: alle Tasks dieses Projekts
    if request.method == "GET":
        tasks = (
            Task.objects
            .filter(project=project)
            .select_related("team")
        )

        serializer = TaskSerializer_TeamView(tasks, many=True)
        return Response({"tasks": serializer.data}, status=status.HTTP_200_OK)

    # 3) POST: neuen Task für dieses Projekt anlegen
    if request.method == "POST":
        payload = request.data

        name = (payload.get("name") or "").strip()
        if not name:
            return Response(
                {"detail": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        priority = payload.get("priority") or 0
        difficulty = payload.get("difficulty") or 0
        description = (payload.get("description") or "").strip()
        approval = bool(payload.get("approval", False))
        team_id = payload.get("team_id")
        assigned_member_ids = payload.get("assigned_members", [])

        team = None
        if team_id:
            try:
                team = Team.objects.get(pk=team_id, project=project)
            except Team.DoesNotExist:
                return Response(
                    {"detail": "Team does not belong to this project."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        task = Task.objects.create(
            project=project,
            team=team,
            name=name,
            description=description,
            priority=priority,
            difficulty=difficulty,
            asking=approval,
        )

        # Assign members to the task if provided
        if assigned_member_ids and isinstance(assigned_member_ids, list):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            users = []
            for user_id in assigned_member_ids:
                try:
                    member = User.objects.get(id=user_id)
                    if user_has_project_access(member, project):
                        users.append(member)
                except User.DoesNotExist:
                    pass

            if users:
                task.assigned_members.set(users)

        serializer = TaskSerializer_TeamView(task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# task_detail_view
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def task_detail_view(request, project_id, task_id):
    """
    GET: Retrieve a single task with details
    PATCH: Update task properties (name, team, priority, difficulty, etc.)
    """
    user = request.user

    try:
        task = (
            Task.objects
            .select_related("project", "team")
            .get(
                id=task_id,
                project_id=project_id,
            )
        )
    except Task.DoesNotExist:
        return Response({"detail": "Task not found."}, status=status.HTTP_404_NOT_FOUND)

    # Permission check
    if not user_has_project_access(user, task.project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        serializer = TaskExpandedSerializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # PATCH: Update task
    if request.method == "PATCH":
        data = request.data

        if "name" in data:
            name = data["name"].strip()
            if name:
                task.name = name

        if "team_id" in data:
            team_id = data["team_id"]
            if team_id is None:
                task.team = None
            else:
                try:
                    team = Team.objects.get(id=team_id, project_id=project_id)
                    task.team = team
                except Team.DoesNotExist:
                    return Response(
                        {"detail": "Team not found in this project."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if "priority" in data:
            task.priority = data["priority"]

        if "difficulty" in data:
            task.difficulty = data["difficulty"]

        if "description" in data:
            task.description = data["description"].strip() if data["description"] else ""

        if "assigned_members" in data:
            # Update assigned members
            member_ids = data["assigned_members"]
            if isinstance(member_ids, list):
                # Validate that all users exist and have access to the project
                from django.contrib.auth import get_user_model
                User = get_user_model()
                users = []
                for user_id in member_ids:
                    try:
                        member = User.objects.get(id=user_id)
                        if user_has_project_access(member, task.project):
                            users.append(member)
                    except User.DoesNotExist:
                        pass

                # Set the assigned members
                task.assigned_members.set(users)

        task.save()

        serializer = TaskExpandedSerializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Assign or unassign a member to/from a task
@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def assign_task_member(request, project_id, task_id):
    """
    POST: Assign a user to a task
    DELETE: Unassign a user from a task

    Body: { "user_id": <id> }
    """
    user = request.user

    try:
        task = Task.objects.select_related("project").get(id=task_id, project_id=project_id)
    except Task.DoesNotExist:
        return Response({"detail": "Task not found."}, status=status.HTTP_404_NOT_FOUND)

    # Permission check: user must have access to the project
    if not user_has_project_access(user, task.project):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    # Get the user to assign/unassign
    target_user_id = request.data.get("user_id")
    if not target_user_id:
        return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_user = User.objects.get(id=target_user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    # Check if target user has access to the project
    if not user_has_project_access(target_user, task.project):
        return Response(
            {"detail": "Target user does not have access to this project."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if request.method == "POST":
        # Assign user to task
        if task.assigned_members.filter(id=target_user.id).exists():
            return Response(
                {"detail": "User is already assigned to this task."},
                status=status.HTTP_400_BAD_REQUEST
            )

        task.assigned_members.add(target_user)
        message = f"User {target_user.username} assigned to task."

        # Create notification for the assigned user
        Notification.objects.create(
            user=target_user,
            action_type='task_assigned',
            title='Task Assigned',
            message=f"You have been assigned to task '{task.name}' by {user.username}",
            related_task=task,
            related_user=user
        )

    else:  # DELETE
        # Unassign user from task
        if not task.assigned_members.filter(id=target_user.id).exists():
            return Response(
                {"detail": "User is not assigned to this task."},
                status=status.HTTP_400_BAD_REQUEST
            )

        task.assigned_members.remove(target_user)
        message = f"User {target_user.username} unassigned from task."

        # Create notification for the unassigned user
        Notification.objects.create(
            user=target_user,
            action_type='task_unassigned',
            title='Task Unassigned',
            message=f"You have been unassigned from task '{task.name}' by {user.username}",
            related_task=task,
            related_user=user
        )

    # Return updated task with assigned members
    serializer = TaskExpandedSerializer(task)
    return Response({
        "message": message,
        "task": serializer.data
    }, status=status.HTTP_200_OK)


# user_tasks
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_tasks(request):
    user = request.user
    tasks = (
        Task.objects.filter(assigned_members=user)
        .select_related("project", "team")
        .order_by("name")
    )
    data = [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "project_id": t.project_id,
            "project_name": t.project.name if t.project else None,
            "team_id": t.team_id,
            "team_name": t.team.name if t.team else None,
        }
        for t in tasks
    ]
    return Response({"tasks": data}, status=status.HTTP_200_OK)








# _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
# _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
# _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
# What i changed: Added these view functions completely

# MilestoneSerializer_Deps
# TaskSerializer_Deps
# MilestoneSerializer



# PROJECT

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project_details(request, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    serialized = ProjectSerializer_Deps(project).data
    return Response({"project": serialized})



# TEAMS

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fetch_project_teams(request, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    all_teams = Team.objects.filter(project=project).order_by("order_index")
    serialized_teams = TeamSerializer_Deps(all_teams, many=True)

    return Response({"teams": serialized_teams.data})



@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def safe_team_order(request, project_id):
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

# TASKS

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fetch_project_tasks(request, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    all_tasks = (
        Task.objects
        .filter(project=project)
        .prefetch_related("milestones")  
        .order_by("team_id", "order_index")
    )

    serialized = TaskSerializer_Deps(all_tasks, many=True).data

    # tasks by id
    tasks_by_id = {}
    for task in serialized:
        tasks_by_id[task["id"]] = task

    # order per team
    order_per_team = {}
    for task in serialized:
        team_id = task["team"]

        if team_id not in order_per_team:
            order_per_team[team_id] = []

        order_per_team[team_id].append(task["id"])

    return Response({
        "health": "healthy",
        "tasks": tasks_by_id,
        "taskOrder": order_per_team
    })





# MILESTONES


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_milestones(request, project_id):
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
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    task_id = request.data.get("task_id")
    task = Task.objects.get(id=int(task_id), project=project)
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
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    new_index = request.data.get("index")
    milestone_id = request.data.get("milestone_id")
    milestone = Milestone.objects.get(id=milestone_id, project=project)
    milestone.start_index = new_index
    milestone.save()
    return Response({"updated": "true"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_milestones(request, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("id")
    milestone = Milestone.objects.get(id=milestone_id, project=project)
    milestone.delete()
    return Response({"deleted": True}, status=204)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def change_duration(request, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("id")
    milestone = Milestone.objects.get(id=milestone_id, project=project)
    change = request.data.get("change")
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



# DEPENDENCIES


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_dependencies(request, project_id):
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
    return Response({"dependency": serialized.data, "created": created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_dependency(request, project_id):
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
    return Response({"deleted": True}, status=status.HTTP_204_NO_CONTENT)


# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________






































