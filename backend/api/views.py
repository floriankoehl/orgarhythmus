import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Comment, Team, Dependency, Attempt
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required  # ← ADD THIS
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
import json
from .models import Task
# ... rest of your code
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from rest_framework import serializers

from django.forms.models import model_to_dict


#____________________________________________________
#__________________AUTHENTICATION____________________
#____________________________________________________


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

def check_auth(request):
    """Check if user is authenticated"""
    if request.user.is_authenticated:
        return JsonResponse({
            "id": request.user.id,
            "username": request.user.username,
            "is_authenticated": True
        })
    return JsonResponse({"is_authenticated": False}, status=401)

def display_single_user(request, user_id):
    print("user id: ", user_id)

    if request.method != 'GET':
        return JsonResponse({"error": "Method must be GET"})
    try:
        user = User.objects.get(pk=user_id)
        return JsonResponse({"user": user.name, "id": user.id})

    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"})
















#____________________________________________________
#__________________TASKS & TEAMS_____________________
#____________________________________________________

#SERIALIZATION
def serialize_task(task):
    # Get all parent tasks (vortakte)
    vortakte = [
        {
            'id': dep.vortakt.id,
            'name': dep.vortakt.name,
            'dependency_id': dep.id,
            'type': dep.type
        }
        for dep in task.vortakte.all()
    ]

    # Get all child tasks (nachtakte)
    nachtakte = [
        {
            'id': dep.nachtakt.id,
            'name': dep.nachtakt.name,
            'dependency_id': dep.id,
            'type': dep.type
        }
        for dep in task.nachtakte.all()
    ]

    return {
        "id": task.id,
        "name": task.name,
        "difficulty": task.difficulty,
        "priority": task.priority,
        "asking": task.asking,
        "team": {
            "id": task.team.id,
            "name": task.team.name,
            "color": task.team.color,
        } if task.team else None,
        "vortakte": vortakte,  # ✅ Parent tasks
        "nachtakte": nachtakte,  # ✅ Child tasks
    }

def serialize_team(team):
    return {
        "id": team.id,
        "name": team.name,
        "color": team.color,
        "tasks": [serialize_task(task) for task in team.tasks.all()],  # 👈 only tasks with that team
    }


#TASKS
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def all_tasks(request):
    tasks = Task.objects.select_related("team").all()
    data = [serialize_task(task) for task in tasks]
    return JsonResponse({"tasks": data}, status=200)

@csrf_exempt
def delete_task_by_id(request):
    if request.method == "POST":
        body = json.loads(request.body)
        task_id = body.get("id")
        task_to_delete = Task.objects.get(id=task_id)
        task_to_delete.delete()

    return JsonResponse({"status": "success"}, status=200)

@csrf_exempt
def create_task(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    body = json.loads(request.body)
    name = body.get("name")
    difficulty = body.get("difficulty")
    priority = body.get("priority")
    asking = body.get("approval")
    team_id = body.get("team_id")

    team = None
    if team_id not in (None, "", "null"):
        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return JsonResponse({"error": "Invalid team_id"}, status=400)

    task = Task.objects.create(
        name=name,
        difficulty=difficulty,
        priority=priority,
        asking=asking,
        team=team,
    )

    return JsonResponse(
        {
            "status": "success",
            "task": serialize_task(task),   # 👈 same shape as all_tasks
        },
        status=201,
    )



#TEAMS
from django.http import JsonResponse

def all_teams(request):
    all_teams = (
        Team.objects
        .prefetch_related(
            "tasks",           # Team → Task
            "tasks__attempts", # Task → Attempt
            "tasks__vortakte", # Task → Dependency (where this task is child)
            "tasks__nachtakte" # Task → Dependency (where this task is parent)
        )
        .all()
    )

    data = [serialize_team(team) for team in all_teams]
    return JsonResponse({"teams": data}, status=200)


@csrf_exempt
def delete_team(request):
    if request.method == "POST":
        body = json.loads(request.body)
        team_id = body.get("id")
        team_to_delete = Team.objects.get(id=team_id)
        team_to_delete.delete()
        return JsonResponse({"status": "success"}, status=200)

@csrf_exempt
def create_team(request):
    if request.method == "POST":
        body = json.loads(request.body)
        name = body.get("name")
        color = body.get("color")
        Team.objects.create(name=name, color=color)
        return JsonResponse({"status": "success"}, status=200)









#____________________________________________________
#__________________Dependencies_____________________
#____________________________________________________

#DEPENDENCIES


@api_view(["POST"])
@permission_classes([AllowAny])
def add_dependency(request):
    print("Pipeline works")
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    body = json.loads(request.body)
    vortakt_id = body.get("vortakt_id")
    nachtakt_id = body.get("nachtakt_id")

    vortakt_task = Task.objects.get(id=vortakt_id)
    nachtakt_task = Task.objects.get(id=nachtakt_id)

    dependency, created = Dependency.objects.get_or_create(
        vortakt=vortakt_task,
        nachtakt=nachtakt_task
    )

    if created:
        return JsonResponse({
            "id": dependency.id,
            "vortakt": vortakt_task.id,
            "nachtakt": nachtakt_task.id,
            "status": "success",
            "created": True,
        }, status=201)
    else:
        return JsonResponse({
            "id": dependency.id,
            "vortakt": vortakt_task.id,
            "nachtakt": nachtakt_task.id,
            "status": "already_exists",
            "created": False,
        }, status=200)

# Create a serializer
class DependencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Dependency
        fields = ['id', 'vortakt', 'nachtakt', 'type']

@api_view(["GET"])
@permission_classes([AllowAny])
def all_dependencies(request):
    all_deps = Dependency.objects.all()
    serializer = DependencySerializer(all_deps, many=True)
    return Response(serializer.data, status=200)

@api_view(["POST"])
@permission_classes([AllowAny])
def delete_dependency(request):
    # request.data automatically parses JSON with @api_view
    dep_id = request.data.get("dep_id")

    if not dep_id:
        return Response({"error": "dep_id is required"}, status=400)

    try:
        dependency = Dependency.objects.get(id=dep_id)
        dependency.delete()
        print(f"Successfully deleted dependency {dep_id}")
        return Response({"status": "success"}, status=200)
    except Dependency.DoesNotExist:
        return Response({"error": "Dependency not found"}, status=404)











#____________________________________________________
#__________________ATTEMPTS_____________________
#____________________________________________________


class TaskSerializer(serializers.ModelSerializer):
    # Get all dependencies where this task is the "vortakt" (parent)
    nachtakte = DependencySerializer(many=True, read_only=True)
    # Get all dependencies where this task is the "nachtakt" (child)
    vortakte = DependencySerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = ['id', 'name', 'difficulty', 'priority', 'asking', 'team', 'nachtakte', 'vortakte']


class AttemptSerializer(serializers.ModelSerializer):
    task = TaskSerializer(read_only=True)  # Nest the full task with dependencies
    team_name = serializers.CharField(source='task.team.name', read_only=True)


    class Meta:
        model = Attempt
        fields = ['id', 'name', 'number', 'task', 'team_name']





#Attempts

from rest_framework.response import Response

# @api_view(["GET"])
# @permission_classes([AllowAny])
# def all_attempts(request):
#     attempts = Attempt.objects.all()
#     serializer = AttemptSerializer(attempts, many=True)  # Use the AttemptSerializer we created
#     return Response(serializer.data, status=200)
#


@api_view(["GET"])
@permission_classes([AllowAny])
def all_attempts(request):
    attempts = Attempt.objects.all().select_related("task")

    data = [
        {
            "id": a.id,
            "task": {"id": a.task.id, "name": a.task.name},  # or just a.task.id
            "name": a.name,
            "number": a.number,
            "slot_index": a.slot_index,  # 👈 IMPORTANT
        }
        for a in attempts
    ]

    return JsonResponse(data, safe=False, status=200)




#Attempts dependecies:

# def add_dependency(request):
#     print("Pipeline works")
#     if request.method != "POST":
#         return JsonResponse({"error": "Only POST allowed"}, status=405)
#
#     body = json.loads(request.body)
#     vortakt_id = body.get("vortakt_id")
#     nachtakt_id = body.get("nachtakt_id")
#
#     vortakt_task = Task.objects.get(id=vortakt_id)
#     nachtakt_task = Task.objects.get(id=nachtakt_id)
#
#     dependency, created = Dependency.objects.get_or_create(
#         vortakt=vortakt_task,
#         nachtakt=nachtakt_task
#     )
#
#     if created:
#         return JsonResponse({
#             "id": dependency.id,
#             "vortakt": vortakt_task.id,
#             "nachtakt": nachtakt_task.id,
#             "status": "success",
#             "created": True,
#         }, status=201)
#     else:
#         return JsonResponse({
#             "id": dependency.id,
#             "vortakt": vortakt_task.id,
#             "nachtakt": nachtakt_task.id,
#             "status": "already_exists",
#             "created": False,
#         }, status=200)

from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
import json

from .models import Attempt, AttemptDependency


@api_view(["POST"])
@permission_classes([AllowAny])
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




from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import AttemptDependency


@api_view(["GET"])
@permission_classes([AllowAny])
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





import json
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import Attempt

# @api_view(["POST"])
# @permission_classes([AllowAny])
# def update_attempt_slot_index(request):
#     """
#     Update the slot_index of a single Attempt.
#     Body: { "attempt_id": <int>, "slot_index": <int> }
#     """
#     try:
#         body = json.loads(request.body)
#     except json.JSONDecodeError:
#         return JsonResponse({"error": "Invalid JSON"}, status=400)
#
#     attempt_id = body.get("attempt_id")
#     slot_index = body.get("slot_index")
#
#     if attempt_id is None or slot_index is None:
#         return JsonResponse({"error": "attempt_id and slot_index are required"}, status=400)
#
#     try:
#         attempt = Attempt.objects.get(id=attempt_id)
#     except Attempt.DoesNotExist:
#         return JsonResponse({"error": "Attempt not found"}, status=404)
#
#     # you can clamp here if you want (1..ENTRIES)
#     attempt.slot_index = int(slot_index)
#     attempt.save()
#
#     return JsonResponse({
#         "id": attempt.id,
#         "slot_index": attempt.slot_index,
#         "status": "updated",
#     }, status=200)
#









@api_view(["POST"])
@permission_classes([AllowAny])
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












import json
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import AttemptDependency

@api_view(["POST"])
@permission_classes([AllowAny])
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
























#__________________________________________________________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________
#______________________________________PROJECTS_____________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________
#__________________________________________________________________________________________




#____________________________________________________
#_____________________SERIALIZER________________________
#____________________________________________________

from .models import Comment, Team, Dependency, Attempt, Project
from django.db.models import Q
from rest_framework import serializers
from .models import Project, Team




class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "description", "created_at", "owner", "owner_username"]
        read_only_fields = ["id", "created_at", "owner", "owner_username"]



class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "color",
            "project",
        ]
        read_only_fields = ["id", "project"]



#____________________________________________________
#_____________________PROJECT________________________
#____________________________________________________

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project(request):
    """
    Create a new project for the current user.
    Body: { "name": "...", "description": "..." }
    """
    data = request.data
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()

    if not name:
        return Response(
            {"detail": "Name is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    project = Project.objects.create(
        owner=request.user,
        name=name,
        description=description or "",
    )
    # Optional: Owner auch gleich als Mitglied hinzufügen
    project.members.add(request.user)

    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_201_CREATED)




from django.shortcuts import get_object_or_404
from django.db.models import Q

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project(request, pk):
    """
    Return one project if the user is owner or member.
    """
    user = request.user
    project = get_object_or_404(
        Project,
        Q(id=pk) & (Q(owner=user) | Q(members=user))
    )
    serializer = ProjectSerializer(project)
    return Response(serializer.data, status=status.HTTP_200_OK)




#____________________________________________________
#_____________________TEAMS__________________________
#____________________________________________________

from django.db import models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Project, Team



def user_has_project_access(user, project: Project) -> bool:
    return (
        project.owner_id == user.id
        or project.members.filter(id=user.id).exists()
    )


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
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # POST → Team erstellen
    serializer = TeamSerializer(data=request.data)
    if serializer.is_valid():
        team = serializer.save(project=project)
        out = TeamSerializer(team).data
        return Response(out, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)











# views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Project, Task, Team


def task_to_dict(task):
    """Formatiert Task so, wie dein Frontend ihn braucht."""
    return {
        "id": task.id,
        "name": task.name,
        "priority": task.priority,
        "difficulty": task.difficulty,
        "approval": task.asking,
        "team": {
            "id": task.team.id,
            "name": task.team.name,
            "color": task.team.color,
        } if task.team else None,
        # Wenn du vortakte / nachtakte brauchst, kannst du hier später erweitern
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def project_tasks_view(request, project_id):
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
        data = [task_to_dict(t) for t in tasks]
        # dein Frontend erwartet `data.tasks` → also:
        return Response({"tasks": data}, status=status.HTTP_200_OK)

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
                # wichtig: Team MUSS zum selben Project gehören
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

        return Response(
            task_to_dict(task),
            status=status.HTTP_201_CREATED,
        )




























































































def echo_view(request, text):
    times = request.GET.get('times')
    if times is not None:
        try:
            n = max(1, int(times))
        except ValueError:
            n = 1
        return JsonResponse({"echo": [text] * n})
    return JsonResponse({"echo": text})




from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Comment

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



# @csrf_exempt
# def write_comment(request):
#     if request.method != "POST":
#         return JsonResponse({"error": "Method must be POST"})
#
#     try:
#         data = json.loads(request.body)
#         comment = data.get("comment")
#         if data.get("author"):
#             author = data.get("author")
#             Comment.objects.create(text=comment, author=author)
#             return JsonResponse({"ok": True})
#         else:
#             Comment.objects.create(text=comment)
#             return JsonResponse({"ok": True})
#
#
#     except json.decoder.JSONDecodeError:
#         return JsonResponse({"error": "Invalid JSON"}, status=400)
#
#
#
# def all_comments(request):
#     if request.method != "GET":
#         return JsonResponse({"error": "Method can only be GET"}, status=405)
#
#     comments = Comment.objects.values()  # ← converts into list of dicts
#     data = list(comments)
#
#     return JsonResponse({"comments": data}, safe=False)
#





# In backend/api/views.py
# @csrf_exempt
# def api_login(request):
#     print("=" * 50)
#     print("LOGIN REQUEST")
#
#     if request.method != "POST":
#         return JsonResponse({"error": "Only POST allowed"}, status=405)
#
#     data = json.loads(request.body)
#     user = authenticate(username=data["username"], password=data["password"])  # ← This line defines 'user'
#
#     if user is None:
#         return JsonResponse({"error": "Invalid credentials"}, status=400)
#
#     login(request, user)  # ← Now 'user' exists
#
#     # Debug prints:
#     print("SESSION KEY:", request.session.session_key)
#     print("USER AUTHENTICATED:", request.user.is_authenticated)
#     print("=" * 50)
#
#     return JsonResponse({"message": "Logged in"})
#

# And in get_current_user:



# Optional: Für nicht-eingeloggte User




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
