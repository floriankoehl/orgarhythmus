import json

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
)






#____________________________________________________
#__________________AUTHENTICATION____________________
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


# display_single_user
#TODO maybe outdated
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





#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#__________________SERIALIZER____________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________


# __________________Project
#ProjectSerializer (APPROVED)
class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "description", "created_at", "owner", "owner_username"]
        read_only_fields = ["id", "created_at", "owner", "owner_username"]




# __________________Task

# TaskSerializer_TeamView
class TaskSerializer_TeamView(serializers.ModelSerializer):
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


# __________________Team

# TeamExpandedSerializer
class TeamExpandedSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer_TeamView(many=True, read_only=True)  # uses related_name="tasks"

    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "color",
            "tasks",
        ]


#(OVERWORKED COMPLETELY)
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












#Team (APPROVED)
# def serialize_team(team):
#     return {
#         "id": team.id,
#         "name": team.name,
#         "color": team.color,
#         "tasks": [serialize_task(task) for task in team.tasks.all()],  # only tasks with that team
#     }






# __________________Attempt


#Tasks
# def serialize_task(task):
#     # Get all parent tasks (vortakte)
#     vortakte = [
#         {
#             'id': dep.vortakt.id,
#             'name': dep.vortakt.name,
#             'dependency_id': dep.id,
#             'type': dep.type
#         }
#         for dep in task.vortakte.all()
#     ]

#     # Get all child tasks (nachtakte)
#     nachtakte = [
#         {
#             'id': dep.nachtakt.id,
#             'name': dep.nachtakt.name,
#             'dependency_id': dep.id,
#             'type': dep.type
#         }
#         for dep in task.nachtakte.all()
#     ]

#     return {
#         "id": task.id,
#         "name": task.name,
#         "difficulty": task.difficulty,
#         "priority": task.priority,
#         "asking": task.asking,
#         "team": {
#             "id": task.team.id,
#             "name": task.team.name,
#             "color": task.team.color,
#         } if task.team else None,
#         "vortakte": vortakte,  # ✅ Parent tasks
#         "nachtakte": nachtakte,  # ✅ Child tasks
#     }



#Dependency
class DependencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Dependency
        fields = ['id', 'vortakt', 'nachtakt', 'type']


# #Task Again
# class TaskSerializer(serializers.ModelSerializer):
#     # Get all dependencies where this task is the "vortakt" (parent)
#     nachtakte = DependencySerializer(many=True, read_only=True)
#     # Get all dependencies where this task is the "nachtakt" (child)
#     vortakte = DependencySerializer(many=True, read_only=True)

#     class Meta:
#         model = Task
#         fields = ['id', 'name', 'difficulty', 'priority', 'asking', 'team', 'nachtakte', 'vortakte']


# #Attempt
# class AttemptSerializer(serializers.ModelSerializer):
#     task = TaskSerializer(read_only=True)  # Nest the full task with dependencies
#     team_name = serializers.CharField(source='task.team.name', read_only=True)


#     class Meta:
#         model = Attempt
#         fields = ['id', 'name', 'number', 'task', 'team_name']




#ProjectTeamSerializer
class ProjectTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "color"]


#ProjectTaskMiniSerializer
class ProjectTaskMiniSerializer(serializers.ModelSerializer):
    team = ProjectTeamSerializer(read_only=True)

    class Meta:
        model = Task
        fields = ["id", "name", "team"]


#ProjectTaskMiniSerializer
class ProjectAttemptSerializer(serializers.ModelSerializer):
    task = ProjectTaskMiniSerializer(read_only=True)

    class Meta:
        model = Attempt
        fields = [
            "id",
            "slot_index",
            "task",
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
    return (
        project.owner_id == user.id
        or project.members.filter(id=user.id).exists()
    )

# ----------------------------------------------------------------------------------------------


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


#create_project
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


#get_project
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






#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________TEAMS________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________



# (OVERWORKED COMPLETELY)
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


# (OVERWORKED COMPLETELY)
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





# project_team_detail
#TODO Old Function
@csrf_exempt
def project_team_detail(request, project_id, team_id):
    """Handles DELETE for a single team."""

    try:
        team = Team.objects.get(id=team_id, project_id=project_id)
    except Team.DoesNotExist:
        return JsonResponse({"error": "Team not found"}, status=404)

    # DELETE
    if request.method == "DELETE":
        team.delete()
        return JsonResponse({"success": True}, status=204)

    return JsonResponse({"error": "Method not allowed"}, status=405)






#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________TASKS________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________

# task_to_dict (helper)
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


#TODO Old Function
# delete_task_by_id
@csrf_exempt
def delete_task_by_id(request):
    if request.method == "POST":
        body = json.loads(request.body)
        task_id = body.get("id")
        task_to_delete = Task.objects.get(id=task_id)
        task_to_delete.delete()

    return JsonResponse({"status": "success"}, status=200)


# project_tasks_view
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






#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_____________________ATTEMPTS________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________
#_______________________________________________________________________________________________

# add_attempt_dependency
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


# list_attempt_dependencies
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


# update_attempt_slot_index
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


# delete_attempt_dependency
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


# all_attempts_for_this_project
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def all_attempts_for_this_project(request, project_id):
    # 1) All attempts whose task belongs to this project
    all_attempts = (
        Attempt.objects
        .select_related("task")        # so we don't hit the DB again per attempt
        .filter(task__project_id=project_id)
    )

    # 2) Manually build the structure you showed:
    #    0: {id: 93, name: "c_0", number: 1, slot_index: 2,
    #        task: {id: 10, name: "c"}}
    data = []
    for a in all_attempts:
        task_obj = a.task  # thanks to select_related
        data.append({
            "id": a.id,
            "name": getattr(a, "name", None),
            "number": getattr(a, "number", None),
            "slot_index": getattr(a, "slot_index", None),
            "task": {
                "id": task_obj.id if task_obj else None,
                "name": task_obj.name if task_obj else None,
            } if task_obj else None,
        })

    # 3) Wrap in {"attempts": ...} so your frontend can keep doing
    #    const all_attempts2 = await fetch_all_attempts();
    #    all_attempts2.attempts.map(...)
    return JsonResponse({"attempts": data}, status=200)

































































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























