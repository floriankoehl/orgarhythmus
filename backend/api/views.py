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

@api_view(["GET"])
@permission_classes([AllowAny])
def all_attempts(request):
    attempts = Attempt.objects.all()
    serializer = AttemptSerializer(attempts, many=True)  # Use the AttemptSerializer we created
    return Response(serializer.data, status=200)























































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
