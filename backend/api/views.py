import json
from datetime import date, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.http import require_GET
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status, serializers
from django.forms.models import model_to_dict
from .models import (
    Comment,
    Team,
    Dependency,
    Attempt,
    AttemptDependency,
    Task,
    Project,
    AttemptTodo,
    Notification,
)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from .models import Team
from django.conf import settings





#____________________________________________________
#__________________AUTHENTICATION & USER____________________
#____________________________________________________

# check_auth (HELPER)
def check_auth(request):
    """Check if user is authenticated"""
    if request.user.is_authenticated:
        return JsonResponse({
            "id": request.user.id,
            "username": request.user.username,
            "is_authenticated": True
        })
    return JsonResponse({"is_authenticated": False}, status=401)


# register_user
@api_view(["POST"])
@permission_classes([AllowAny])  # register should be open
def register_user(request):
    """
    Simple user registration endpoint.

    Expects JSON:
    {
      "username": "...",
      "password1": "...",
      "password2": "...",
      "email": "..."  (optional)
    }
    """

    data = request.data  # DRF already parsed JSON
    username = data.get("username")
    password1 = data.get("password1")
    password2 = data.get("password2")
    email = data.get("email", "")

    # 1) Basic required fields
    if not username or not password1 or not password2:
        return Response(
            {"detail": "username, password1 and password2 are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 2) Passwords must match
    if password1 != password2:
        return Response(
            {"detail": "Passwords must match"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 3) Username must be unique
    if User.objects.filter(username=username).exists():
        return Response(
            {"detail": "Username already taken"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 4) Create the user (password is hashed automatically)
    user = User.objects.create_user(
        username=username,
        password=password1,
        email=email,
    )

    # 5) Return minimal info (no token here, just confirmation)
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
        status=status.HTTP_201_CREATED,
    )


#TODO maybe outdated
# display_single_user
def display_single_user(request, user_id):
    print("user id: ", user_id)

    if request.method != 'GET':
        return JsonResponse({"error": "Method must be GET"})
    try:
        user = User.objects.get(pk=user_id)
        return JsonResponse({"user": user.name, "id": user.id})

    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"})


# get_current_user
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    Return info about the currently authenticated user.

    Authentication comes from the JWT in the Authorization header:
    Authorization: Bearer <access_token>
    """
    user = request.user

    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "is_authenticated": True,
    })



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


#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#__________________SERIALIZER____________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________


#ProjectSerializer
class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    members_data = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "description", "created_at", "owner", "owner_username", "members_data", "start_date", "end_date"]
        read_only_fields = ["id", "created_at", "owner", "owner_username", "members_data"]

    def get_members_data(self, obj):
        """Return list of member usernames"""
        return [{"id": member.id, "username": member.username} for member in obj.members.all()]


# TaskSerializer_TeamView
class TaskSerializer(serializers.ModelSerializer):
    # nested team summary, like your manual "team": {...}
    # team = BasicTeamSerializer(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "name",
            "difficulty",
            "priority",
            "asking",
            "team",
        ]


# TeamExpandedSerializer
class TeamExpandedSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(many=True, read_only=True)  # uses related_name="tasks"
    members_data = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "color",
            "line_index",
            "tasks",
            "members_data",
        ]

    def get_members_data(self, obj):
        return [{"id": u.id, "username": u.username, "email": u.email} for u in obj.members.all()]


# BasicTeamSerializer
class BasicTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "color",
            "project",
        ]
        read_only_fields = ["id", "project"]


# TaskSerializer_TeamView
class TaskSerializer_TeamView(serializers.ModelSerializer):
    # nested team summary, like your manual "team": {...}
    team = BasicTeamSerializer(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "name",
            "difficulty",
            "priority",
            "asking",
            "team",
        ]



# TODO ADDED TASKS 
# TODO Maybe a mismatch (task expanded is something different then team expandend)
# TaskExpandedSerializer
class TaskExpandedSerializer(serializers.ModelSerializer):
    team = BasicTeamSerializer(read_only=True)
    project_id = serializers.IntegerField(source='project.id', read_only=True)
    attempts = serializers.SerializerMethodField()
    assigned_members_data = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id',
            'name',
            'priority',
            'difficulty',
            'team',
            'project_id',
            'attempts',
            'assigned_members',
            'assigned_members_data',
        ]

    def get_assigned_members_data(self, obj):
        return [{"id": u.id, "username": u.username, "email": u.email} for u in obj.assigned_members.all()]

    def get_attempts(self, obj):
        attempts_qs = getattr(obj, "attempts", None)
        if attempts_qs is None:
            return []

        # order attempts by slot_index then id to keep a consistent timeline
        ordered = attempts_qs.all().order_by('slot_index', 'id').prefetch_related('todos')
        start_date = getattr(getattr(obj, 'project', None), 'start_date', None)
        return [
            {
                "id": a.id,
                "name": getattr(a, "name", None),
                "description": getattr(a, "description", None),
                "number": getattr(a, "number", None),
                "slot_index": getattr(a, "slot_index", None),
                "done": getattr(a, "done", False),
                "scheduled_date": (
                    (
                        (start_date + timedelta(days=(a.slot_index - 1))).isoformat()
                    ) if (start_date and (a.slot_index is not None)) else None
                ),
                "todos": [
                    {
                        "id": t.id,
                        "text": t.text,
                        "done": t.done,
                        "created_at": t.created_at,
                    }
                    for t in (a.todos.all().order_by('-created_at') if hasattr(a, 'todos') else [])
                ],
            }
            for a in ordered
        ]






#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________PROJECT________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________


# user_has_project_access (HELPER)
def user_has_project_access(user, project: Project) -> bool:
    return project.owner == user or user in project.members.all()

#List Projects
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


#get_project
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

# TODO ADDDEEEDD
#delete_project
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

#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________TEAMS________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________


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

    if request.method == "GET":
        teams = project.teams.all().order_by("name")
        serializer = BasicTeamSerializer(teams, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # POST → Team erstellen
    serializer = BasicTeamSerializer(data=request.data)
    if serializer.is_valid():
        team = serializer.save(project=project)
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


    all_teams = (
        Team.objects
        .prefetch_related(
            "tasks",           # Team → Task
            "tasks__attempts", # Task → Attempt
        )
        .filter(project_id=project_id)
    )

    # data = [serialize_team(team) for team in all_teams]
    # return JsonResponse({"teams": data}, status=200)
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


# TODO ADDED Teams
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










#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________TASKS________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________




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


#project_tasks
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
        approval = bool(payload.get("approval", False))
        team_id = payload.get("team_id")

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
            priority=priority,
            difficulty=difficulty,
            asking=approval,
        )

        serializer = TaskSerializer_TeamView(task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)




#TODO ADDED TASKS
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
            .prefetch_related("attempts", "attempts__todos")
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





#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________ATTEMPTS________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________

# add_attempt_dependency
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_attempt_dependency(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    # ✅ match the keys sent from frontend
    vortakt_attempt_id = body.get("vortakt_attempt_id")
    nachtakt_attempt_id = body.get("nachtakt_attempt_id")

    if not vortakt_attempt_id or not nachtakt_attempt_id:
        return JsonResponse({"error": "Missing vortakt_attempt_id or nachtakt_attempt_id"}, status=400)

    try:
        vortakt_attempt = Attempt.objects.get(id=vortakt_attempt_id)
        nachakt_attempt = Attempt.objects.get(id=nachtakt_attempt_id)
    except Attempt.DoesNotExist:
        return JsonResponse({"error": "One of the attempts does not exist"}, status=404)

    # ✅ use the correct model: AttemptDependency
    vortakt_dependency, created = AttemptDependency.objects.get_or_create(
        vortakt_attempt=vortakt_attempt,
        nachtakt_attempt=nachakt_attempt
    )

    print("Attempt Dependency added", vortakt_dependency)

    return JsonResponse({
        "id": vortakt_dependency.id,
        "vortakt": vortakt_attempt.id,
        "nachtakt": nachakt_attempt.id,
        "status": "success" if created else "already_exists",
        "created": created,
    })


# list_attempt_dependencies
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_attempt_dependencies(request):
    """
    Return all AttemptDependency objects as a simple JSON list.
    """
    deps = AttemptDependency.objects.all().select_related("vortakt_attempt", "nachtakt_attempt")

    data = [
        {
            "id": dep.id,
            "vortakt_attempt_id": dep.vortakt_attempt_id,
            "nachtakt_attempt_id": dep.nachtakt_attempt_id,
            "type": dep.type
        }
        for dep in deps
    ]

    return JsonResponse(data, safe=False, status=200)


# update_attempt_slot_index
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_attempt_slot_index(request):
    import json
    from .models import Attempt

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    attempt_id = body.get("attempt_id")
    slot_index = body.get("slot_index")

    if attempt_id is None or slot_index is None:
        return JsonResponse({"error": "attempt_id and slot_index are required"}, status=400)

    try:
        attempt = Attempt.objects.get(id=attempt_id)
    except Attempt.DoesNotExist:
        return JsonResponse({"error": "Attempt not found"}, status=404)

    attempt.slot_index = int(slot_index)
    attempt.save()

    return JsonResponse({
        "id": attempt.id,
        "slot_index": attempt.slot_index,
        "status": "updated",
    }, status=200)


# delete_attempt_dependency
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def delete_attempt_dependency(request):
    """
    Delete a single AttemptDependency by id.
    Body: { "dependency_id": <int> }
    """
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    dep_id = body.get("dependency_id")
    if dep_id is None:
        return JsonResponse({"error": "dependency_id is required"}, status=400)

    try:
        dep = AttemptDependency.objects.get(id=dep_id)
    except AttemptDependency.DoesNotExist:
        return JsonResponse({"error": "AttemptDependency not found"}, status=404)

    dep.delete()

    return JsonResponse({"id": dep_id, "status": "deleted"}, status=200)


# # all_attempts_for_this_project
# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def all_attempts_for_this_project(request, project_id):
#     # 1) All attempts whose task belongs to this project
#     all_attempts = (
#         Attempt.objects
#         .select_related("task", "task__team")  # fetch both task and its team to avoid N+1
#         .filter(task__project_id=project_id)
#     )

#     # 2) Manually build the structure you showed:
#     #    0: {id: 93, name: "c_0", number: 1, slot_index: 2,
#     #        task: {id: 10, name: "c", team: {id: 5, name: "...", color: "..."}}}
#     data = []
#     for a in all_attempts:
#         task_obj = a.task  # thanks to select_related
#         data.append({
#             "id": a.id,
#             "name": getattr(a, "name", None),
#             "number": getattr(a, "number", None),
#             "slot_index": getattr(a, "slot_index", None),
#             "task": {
#                 "id": task_obj.id if task_obj else None,
#                 "name": task_obj.name if task_obj else None,
#                 "team": {
#                     "id": task_obj.team.id,
#                     "name": task_obj.team.name,
#                     "color": task_obj.team.color,
#                 } if task_obj and task_obj.team else None,
#             } if task_obj else None,
#         })

#     # 3) Wrap in {"attempts": ...} so your frontend can keep doing
#     #    const all_attempts2 = await fetch_all_attempts();
#     #    all_attempts2.attempts.map(...)
#     return JsonResponse({"attempts": data}, status=200)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def all_attempts_for_this_project(request, project_id):
    all_attempts = (
        Attempt.objects
        .select_related("task", "task__team")
        .prefetch_related("task__assigned_members", "todos")
        .filter(task__project_id=project_id)
    )

    data = []
    for a in all_attempts:
        task_obj = a.task
        data.append({
            "id": a.id,
            "name": getattr(a, "name", None),
            "number": getattr(a, "number", None),
            "slot_index": getattr(a, "slot_index", None),
            "done": getattr(a, "done", False),
            "todos": [
                {
                    "id": todo.id,
                    "text": todo.text,
                    "done": todo.done,
                }
                for todo in a.todos.all()
            ],
            "task": {
                "id": task_obj.id if task_obj else None,
                "name": task_obj.name if task_obj else None,
                "team": {
                    "id": task_obj.team.id,
                    "name": task_obj.team.name,
                    "color": task_obj.team.color,
                } if task_obj and task_obj.team else None,
                "assigned_members": [u.id for u in task_obj.assigned_members.all()] if task_obj else [],
                "assigned_members_data": [
                    {"id": u.id, "username": u.username, "email": u.email}
                    for u in task_obj.assigned_members.all()
                ] if task_obj else [],
            } if task_obj else None,
        })

    return JsonResponse({"attempts": data}, status=200)


# create_attempt_view - POST to create new attempt for a task
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_attempt_view(request, project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    task_id = data.get("task_id")
    name = data.get("name", "").strip()
    description = data.get("description", "")

    if not task_id:
        return Response({"detail": "task_id required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        task = Task.objects.get(id=task_id, project_id=project_id)
    except Task.DoesNotExist:
        return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

    # Create new attempt
    attempt = Attempt.objects.create(
        task=task,
        name=name or f"Attempt {task.attempts.count() + 1}",
        description=description,
    )
    
    return Response(
        {
            "id": attempt.id,
            "name": attempt.name,
            "description": attempt.description,
            "number": attempt.number,
            "slot_index": attempt.slot_index,
            "done": attempt.done,
            "todos": [],
        },
        status=status.HTTP_201_CREATED,
    )


# delete_attempt_view - DELETE to remove an attempt
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_attempt_view(request, project_id, attempt_id):
    try:
        attempt = Attempt.objects.select_related("task__project").get(
            id=attempt_id, task__project_id=project_id
        )
    except Attempt.DoesNotExist:
        return Response({"detail": "Attempt not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, attempt.task.project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    attempt_id_copy = attempt.id
    attempt.delete()
    
    return Response(
        {"id": attempt_id_copy, "status": "deleted"},
        status=status.HTTP_200_OK,
    )


#attempt_detail_view
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def attempt_detail_view(request, project_id, attempt_id):
    try:
        attempt = Attempt.objects.select_related("task", "task__team", "task__project").get(
            id=attempt_id, task__project_id=project_id
        )
    except Attempt.DoesNotExist:
        return Response({"detail": "Attempt not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, attempt.task.project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        proj = getattr(attempt.task, 'project', None)
        start_date = getattr(proj, 'start_date', None)
        scheduled_date = (
            (start_date + timedelta(days=(attempt.slot_index - 1))).isoformat()
        ) if (start_date and (attempt.slot_index is not None)) else None

        # Dependencies: incoming (parents) and outgoing (children)
        incoming_qs = attempt.vortakt_attempts.select_related(
            "vortakt_attempt",
            "vortakt_attempt__task",
            "vortakt_attempt__task__team",
        )
        outgoing_qs = attempt.nachtakt_attempts.select_related(
            "nachtakt_attempt",
            "nachtakt_attempt__task",
            "nachtakt_attempt__task__team",
        )

        def serialize_other_attempt(other):
            other_proj = getattr(other.task, 'project', None)
            other_start = getattr(other_proj, 'start_date', None)
            other_scheduled = (
                (other_start + timedelta(days=(other.slot_index - 1))).isoformat()
            ) if (other_start and (other.slot_index is not None)) else None
            return {
                "id": other.id,
                "name": getattr(other, "name", None),
                "number": getattr(other, "number", None),
                "slot_index": getattr(other, "slot_index", None),
                "done": getattr(other, "done", False),
                "scheduled_date": other_scheduled,
                "task": {
                    "id": other.task.id if other.task else None,
                    "name": other.task.name if other.task else None,
                    "team": (
                        {
                            "id": other.task.team.id,
                            "name": other.task.team.name,
                            "color": other.task.team.color,
                        }
                        if (other.task and other.task.team)
                        else None
                    ),
                },
            }
        return Response(
            {
                "id": attempt.id,
                "name": attempt.name,
                "description": attempt.description,
                "number": attempt.number,
                "slot_index": attempt.slot_index,
                "done": attempt.done,
                "scheduled_date": scheduled_date,
                "task": {
                    "id": attempt.task.id,
                    "name": attempt.task.name,
                    "team": {
                        "id": attempt.task.team.id,
                        "name": attempt.task.team.name,
                        "color": attempt.task.team.color,
                    } if attempt.task.team else None,
                },
                "todos": [
                    {"id": t.id, "text": t.text, "done": t.done, "created_at": t.created_at}
                    for t in attempt.todos.all().order_by("-created_at")
                ],
                "incoming_dependencies": [
                    {
                        "type": dep.type,
                        "attempt": serialize_other_attempt(dep.vortakt_attempt),
                    }
                    for dep in incoming_qs
                ],
                "outgoing_dependencies": [
                    {
                        "type": dep.type,
                        "attempt": serialize_other_attempt(dep.nachtakt_attempt),
                    }
                    for dep in outgoing_qs
                ],
            },
            status=status.HTTP_200_OK,
        )

    if request.method == "PATCH":
        data = request.data
        if "done" in data:
            attempt.done = bool(data.get("done"))
            # If marking as done, delete all notifications for this attempt
            if attempt.done:
                from .models import Notification
                Notification.objects.filter(related_attempt=attempt).delete()
        if "name" in data:
            attempt.name = data.get("name") or attempt.name
        if "description" in data:
            attempt.description = data.get("description")
        attempt.save()
        return Response({"id": attempt.id, "done": attempt.done, "name": attempt.name, "description": attempt.description}, status=status.HTTP_200_OK)


#attempt_todos_view
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attempt_todos_view(request, project_id, attempt_id):
    try:
        attempt = Attempt.objects.select_related("task__project").get(id=attempt_id, task__project_id=project_id)
    except Attempt.DoesNotExist:
        return Response({"detail": "Attempt not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, attempt.task.project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return Response({"detail": "Invalid JSON"}, status=status.HTTP_400_BAD_REQUEST)

    action = body.get("action")
    todo_id = body.get("todo_id")
    text = body.get("text")

    if action == "create":
        if not text:
          return Response({"detail": "text required"}, status=status.HTTP_400_BAD_REQUEST)
        todo = AttemptTodo.objects.create(attempt=attempt, text=text)
        
        # Auto-update attempt.done based on todos completion
        all_todos = attempt.todos.all()
        if all_todos.exists():
            all_done = all_todos.filter(done=True).count() == all_todos.count()
            attempt.done = all_done
            attempt.save()
        
        return Response({"id": todo.id, "text": todo.text, "done": todo.done, "attempt_done": attempt.done}, status=status.HTTP_201_CREATED)

    if action == "toggle":
        if not todo_id:
            return Response({"detail": "todo_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            todo = AttemptTodo.objects.get(id=todo_id, attempt=attempt)
        except AttemptTodo.DoesNotExist:
            return Response({"detail": "Todo not found"}, status=status.HTTP_404_NOT_FOUND)
        todo.done = not todo.done
        todo.save()
        
        # Auto-update attempt.done based on todos completion
        all_todos = attempt.todos.all()
        if all_todos.exists():
            all_done = all_todos.filter(done=True).count() == all_todos.count()
            attempt.done = all_done
            attempt.save()
        
        return Response({"id": todo.id, "done": todo.done, "attempt_done": attempt.done}, status=status.HTTP_200_OK)

    if action == "delete":
        if not todo_id:
            return Response({"detail": "todo_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            todo = AttemptTodo.objects.get(id=todo_id, attempt=attempt)
        except AttemptTodo.DoesNotExist:
            return Response({"detail": "Todo not found"}, status=status.HTTP_404_NOT_FOUND)
        todo.delete()
        
        # Auto-update attempt.done based on remaining todos completion
        all_todos = attempt.todos.all()
        if all_todos.exists():
            all_done = all_todos.filter(done=True).count() == all_todos.count()
            attempt.done = all_done
        else:
            attempt.done = False
        attempt.save()
        
        return Response({"id": todo_id, "status": "deleted", "attempt_done": attempt.done}, status=status.HTTP_200_OK)

    return Response({"detail": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)




































# ________________________________________________________________________________________________________________________________
# ________________________________________________________________________________________________________________________________
# ________________________________________________________________________________________________________________________________
# _______________________________________________________OTHER WEBSITE STUFF____________________________________________________
# ________________________________________________________________________________________________________________________________
# ________________________________________________________________________________________________________________________________




def echo_view(request, text):
    times = request.GET.get('times')
    if times is not None:
        try:
            n = max(1, int(times))
        except ValueError:
            n = 1
        return JsonResponse({"echo": [text] * n})
    return JsonResponse({"echo": text})


# GET /api/comments/all_comments/
@api_view(["GET"])
@permission_classes([AllowAny])  # everyone can read, adjust if needed
def all_comments(request):
    comments = (
        Comment.objects
        .select_related("author")
        .order_by("timestamp")  # or "-timestamp" for newest first
    )

    data = [
        {
            "id": c.id,
            "author": c.author.username if c.author else None,
            "text": c.text,
            "timestamp": c.timestamp.isoformat(),
        }
        for c in comments
    ]

    return Response({"comments": data}, status=status.HTTP_200_OK)


# POST /api/comments/write/
@api_view(["POST"])
@permission_classes([IsAuthenticated])  # 🔐 only logged-in users can post
def write_comment(request):
    text = request.data.get("text") or request.data.get("comment")

    if not text or not text.strip():
        return Response(
            {"error": "Text is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ✅ Use request.user from JWT, ignore any 'author' from client
    comment = Comment.objects.create(
        author=request.user,
        text=text.strip(),
    )

    data = {
        "id": comment.id,
        "author": comment.author.username,
        "text": comment.text,
        "timestamp": comment.timestamp.isoformat(),
    }

    return Response({"comment": data}, status=status.HTTP_201_CREATED)


def network_connection(request, comp_id):
    print("Sucesfully called this")

    if comp_id == 1:
        dummy_data = {
      "firmenbuchnummer": "661613k",
      "nodes": [
        {
          "id": "661613k",
          "type": "company",
          "label": "Körpermanufaktur KG",
        },
        {
          "id": "7402id",
          "type": "person",
          "label": "Richard Thomas Kranabetter",
        },
        # {
        #   "id": "765478k",
        #   "type": "company",
        #   "label": "Example Company",
        # },
        {
          "id": "8534lo",
          "type": "location",
          "label": "AUT, 6850 Dornbirn, Marktstraße 36",
        },
      ],
      "edges": [
        {
          "source": "661613k",
          "target": "7402id",
          "label": "Person",
        },
        {
          "source": "7402id",
          "target": "765478k",
          "label": "Person",
        },
        {
          "source": "661613k",
          "target": "8534lo",
          "label": "Location",
        },
      ],
    }
    else:
        dummy_data = {
  "firmenbuchnummer": "765478k",
  "nodes": [
    {
      "id": "765478k",
      "type": "company",
      "label": "Example Company"
    },
    {
      "id": "7402id",
      "type": "person",
      "label": "Richard Thomas Kranabetter"
    },
    {
      "id": "661613k",
      "type": "company",
      "label": "Körpermanufaktur KG"
    },
    {
      "id": "9922xy",
      "type": "location",
      "label": "AUT, 6020 Innsbruck, Museumstraße 10"
    }
  ],
  "edges": [
    {
      "source": "7402id",
      "target": "765478k",
      "label": "Person"
    },
    {
      "source": "7402id",
      "target": "661613k",
      "label": "Person"
    },
    {
      "source": "765478k",
      "target": "9922xy",
      "label": "Location"
    }
  ]
}


    return JsonResponse({"ok": True, "dummy_data": dummy_data})


@require_GET
def dummy_data(request):
    """
    Dummy skills API based on Florian's CV.
    Categories: IT, Soft Skills, Health, Sales.
    """
    data = {
        "IT": [
            {
                "id": "it_python",
                "name": "Python",
                "details": ["Django", "Pytest", "Pygame", "NumPy", "Pandas"],
            },
            {
                "id": "it_js",
                "name": "JavaScript",
                "details": ["React", "Node.js", "Fetch API", "DOM manipulation"],
            },
            {
                "id": "it_r",
                "name": "R",
                "details": ["ggplot2", "data analysis", "statistics", "inferential eval"],
            },
            {
                "id": "it_webdev",
                "name": "Web Development",
                "details": ["HTML", "CSS", "Bootstrap", "WordPress"],
            },
            {
                "id": "it_devops",
                "name": "DevOps & Databases",
                "details": [
                    "Docker",
                    "Git/GitHub",
                    "SQLite",
                    "PostgreSQL",
                    "Neo4j",
                    "CI/CD",
                    "Scrum",
                ],
            },
        ],
        "Soft Skills": [
            {
                "id": "soft_teaching",
                "name": "Teaching & Tutoring",
                "details": [
                    "Informatics tutor (IMC)",
                    "Programming instructor (children & teens)",
                ],
            },
            {
                "id": "soft_communication",
                "name": "Communication",
                "details": [
                    "Direct client contact (web design)",
                    "Fundraising for NGOs",
                ],
            },
            {
                "id": "soft_leadership",
                "name": "Leadership & Teamwork",
                "details": ["Team leader in fundraising", "Cooperation with lecturers"],
            },
        ],
        "Health": [
            {
                "id": "health_massage",
                "name": "Medical & Commercial Massage",
                "details": [
                    "Medical masseur training",
                    "Commercial & medical massage training",
                    "Internships (VAMED, La Pura, Sanatorium Hera)",
                ],
            }
        ],
        "Sales": [
            {
                "id": "sales_fundraising",
                "name": "Fundraising & Sales",
                "details": [
                    "Fundraiser & team leader (Amnesty, WWF)",
                    "Direct customer contact",
                ],
            },
            {
                "id": "sales_logistics",
                "name": "Logistics & Operations",
                "details": ["Tech-based food startup logistics (Schrankerl GmbH)"],
            },
        ],
    }

    return JsonResponse({"ok": True, "data": data})


# Get all teams for the current user (across all projects)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_teams(request):
    """
    Get all teams that the current user is a member of, across all projects.
    """
    user = request.user
    teams = Team.objects.filter(members=user).select_related('project').order_by('project__name', 'name')
    
    result = []
    for team in teams:
        result.append({
            'id': team.id,
            'name': team.name,
            'color': team.color,
            'line_index': team.line_index,
            'project': {
                'id': team.project.id,
                'name': team.project.name,
            } if team.project else None,
            'member_count': team.members.count(),
        })
    
    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_tasks(request):
    """
    Get all tasks that the current user is assigned to, across all projects.
    """
    user = request.user
    tasks = Task.objects.filter(assigned_members=user).select_related('project', 'team').order_by('project__name', 'name')
    
    result = []
    for task in tasks:
        result.append({
            'id': task.id,
            'name': task.name,
            'difficulty': task.difficulty,
            'priority': task.priority,
            'asking': task.asking,
            'project': {
                'id': task.project.id,
                'name': task.project.name,
            } if task.project else None,
            'team': {
                'id': task.team.id,
                'name': task.team.name,
                'color': task.team.color,
            } if task.team else None,
            'assigned_members_count': task.assigned_members.count(),
        })
    
    return Response(result, status=status.HTTP_200_OK)


#____________________NOTIFICATIONS______________________
#_______________________________________________
#_______________________________________________


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_notifications(request):
    """
    Get all notifications for the current user, optionally filtered by read status.
    Query params: ?read=true/false to filter by read status
    """
    user = request.user
    read_param = request.query_params.get('read')
    
    notifications = Notification.objects.filter(user=user)
    
    # Filter by read status if provided
    if read_param is not None:
        if read_param.lower() == 'true':
            notifications = notifications.filter(read=True)
        elif read_param.lower() == 'false':
            notifications = notifications.filter(read=False)
    
    result = []
    for notif in notifications:
        result.append({
            'id': notif.id,
            'action_type': notif.action_type,
            'title': notif.title,
            'message': notif.message,
            'read': notif.read,
            'created_at': notif.created_at,
            'related_task': {
                'id': notif.related_task.id,
                'name': notif.related_task.name,
            } if notif.related_task else None,
            'related_user': {
                'id': notif.related_user.id,
                'username': notif.related_user.username,
            } if notif.related_user else None,
        })
    
    return Response(result, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_as_read(request, notification_id):
    """
    Mark a notification as read.
    """
    user = request.user
    
    try:
        notif = Notification.objects.get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response(
            {"detail": "Notification not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    notif.read = True
    notif.save()
    
    return Response({"status": "Notification marked as read"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_as_read(request):
    """
    Mark all unread notifications as read for current user.
    """
    user = request.user
    updated = Notification.objects.filter(user=user, read=False).update(read=True)
    
    return Response(
        {"status": f"Marked {updated} notifications as read"},
        status=status.HTTP_200_OK
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_notification(request, notification_id):
    """
    Delete a notification.
    """
    user = request.user
    
    try:
        notif = Notification.objects.get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response(
            {"detail": "Notification not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    notif.delete()
    
    return Response({"status": "Notification deleted"}, status=status.HTTP_204_NO_CONTENT)


def check_and_create_attempt_notifications(current_date):
    """
    Check for attempts that are:
    1. Overdue (calculated_date before today and not done)
    2. Today (calculated_date is today)
    3. Upcoming (calculated_date is tomorrow or day after tomorrow)
    
    Create notifications for assigned members and project owner.
    """
    from .models import Attempt, Notification
    
    # Subtract 1 day to send notifications one day early
    current_date = current_date - timedelta(days=-1)
    
    today = current_date
    tomorrow = current_date + timedelta(days=1)
    day_after_tomorrow = current_date + timedelta(days=2)
    
    # Find all attempts with calculated dates
    all_attempts = Attempt.objects.filter(
        task__isnull=False,
        task__project__isnull=False,
        done=False
    ).select_related('task__project', 'task__team').prefetch_related('task__assigned_members')
    
    # Separate attempts by their calculated dates
    overdue_attempts = [
        attempt for attempt in all_attempts 
        if attempt.calculated_date and attempt.calculated_date < today
    ]
    
    today_attempts = [
        attempt for attempt in all_attempts 
        if attempt.calculated_date == today
    ]
    
    upcoming_attempts = [
        attempt for attempt in all_attempts 
        if attempt.calculated_date in [tomorrow, day_after_tomorrow]
    ]
    
    # Create notifications for overdue attempts
    for attempt in overdue_attempts:
        assigned_members = list(attempt.task.assigned_members.all())
        project_owner = attempt.task.project.owner
        
        # Notify assigned members
        for member in assigned_members:
            Notification.objects.create(
                user=member,
                action_type='attempt_overdue',
                title=f"Attempt Overdue: {attempt.task.name}",
                message=f"The attempt '{attempt.name}' for task '{attempt.task.name}' was due yesterday and is not yet marked as done.",
                related_task=attempt.task,
                related_attempt=attempt
            )
        
        # Always notify project owner
        if project_owner and project_owner not in assigned_members:
            Notification.objects.create(
                user=project_owner,
                action_type='attempt_overdue',
                title=f"Attempt Overdue: {attempt.task.name}",
                message=f"The attempt '{attempt.name}' for task '{attempt.task.name}' was due yesterday and is not yet marked as done.",
                related_task=attempt.task,
                related_attempt=attempt
            )
    
    # Create notifications for today's attempts
    for attempt in today_attempts:
        assigned_members = list(attempt.task.assigned_members.all())
        project_owner = attempt.task.project.owner
        
        # Notify assigned members
        for member in assigned_members:
            Notification.objects.create(
                user=member,
                action_type='attempt_today',
                title=f"Attempt Today: {attempt.task.name}",
                message=f"The attempt '{attempt.name}' for task '{attempt.task.name}' is due today.",
                related_task=attempt.task,
                related_attempt=attempt
            )
        
        # Always notify project owner
        if project_owner and project_owner not in assigned_members:
            Notification.objects.create(
                user=project_owner,
                action_type='attempt_today',
                title=f"Attempt Today: {attempt.task.name}",
                message=f"The attempt '{attempt.name}' for task '{attempt.task.name}' is due today.",
                related_task=attempt.task,
                related_attempt=attempt
            )
    
    # Create notifications for upcoming attempts
    for attempt in upcoming_attempts:
        assigned_members = list(attempt.task.assigned_members.all())
        project_owner = attempt.task.project.owner
        
        # Notify assigned members
        for member in assigned_members:
            display_date = (attempt.calculated_date - timedelta(days=1)).strftime('%Y-%m-%d')
            Notification.objects.create(
                user=member,
                action_type='attempt_upcoming',
                title=f"Upcoming Attempt: {attempt.task.name}",
                message=f"The attempt '{attempt.name}' for task '{attempt.task.name}' is coming up on {display_date}.",
                related_task=attempt.task,
                related_attempt=attempt
            )
        
        # Always notify project owner
        if project_owner and project_owner not in assigned_members:
            display_date = (attempt.calculated_date - timedelta(days=1)).strftime('%Y-%m-%d')
            Notification.objects.create(
                user=project_owner,
                action_type='attempt_upcoming',
                title=f"Upcoming Attempt: {attempt.task.name}",
                message=f"The attempt '{attempt.name}' for task '{attempt.task.name}' is coming up on {display_date}.",
                related_task=attempt.task,
                related_attempt=attempt
            )


# Demo Date endpoints
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def demo_date_view(request):
    """
    GET: Retrieve current demo date
    POST: Update demo date and check for attempt notifications
    """
    from .models import DemoDate
    from datetime import datetime
    
    if request.method == "GET":
        demo_date = DemoDate.objects.first()
        if not demo_date:
            demo_date = DemoDate.objects.create()
        return Response({"date": demo_date.date}, status=status.HTTP_200_OK)
    
    elif request.method == "POST":
        data = request.data
        date_str = data.get("date")
        
        if not date_str:
            return Response({"detail": "date required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Parse the date string (YYYY-MM-DD format)
            from datetime import datetime as dt
            new_date = dt.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        
        demo_date = DemoDate.objects.first()
        if not demo_date:
            demo_date = DemoDate.objects.create(date=new_date)
        else:
            demo_date.date = new_date
            demo_date.save()
        
        # Check for and create attempt notifications using the saved date
        check_and_create_attempt_notifications(demo_date.date)
        
        return Response({"date": demo_date.date}, status=status.HTTP_200_OK)

















