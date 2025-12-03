import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import User, Comment, Team
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required  # ← ADD THIS
from django.views.decorators.csrf import csrf_exempt
import json
from .models import Task
# ... rest of your code
from django.forms.models import model_to_dict

from django.forms.models import model_to_dict



def serialize_task(task):
    return {
        "id": task.id,
        "name": task.name,
        "difficulty": task.difficulty,
        "priority": task.priority,
        "asking": task.asking,
        "team": (
            {
                "id": task.team.id,
                "name": task.team.name,
                "color": task.team.color,
            }
            if task.team
            else None
        ),
    }








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


# @csrf_exempt
# def create_task(request):
#     if request.method != "POST":
#         return JsonResponse({"error": "Only POST allowed"}, status=405)
#
#     body = json.loads(request.body)
#     name = body.get("name")
#     difficulty = body.get("difficulty")
#     priority = body.get("priority")
#     asking = body.get("approval")
#     team_id = body.get("team_id")
#     team = Team.objects.get(id=team_id)
#
#
#     task = Task.objects.create(name=name, priority=priority, difficulty=difficulty, asking=asking, team=team)
#     return JsonResponse(
#         {
#             "status": "success",
#             "task": {"id": task.id, "name": task.name, "difficulty": task.difficulty, "priority": task.priority, "asking": task.asking, "team_id": task.team.name},
#         },
#         status=201,
#     )



# @csrf_exempt
# def create_task(request):
#     if request.method != "POST":
#         return JsonResponse({"error": "Only POST allowed"}, status=405)
#
#     body = json.loads(request.body)
#     name = body.get("name")
#     difficulty = body.get("difficulty")
#     priority = body.get("priority")
#     asking = body.get("approval")
#     team_id = body.get("team_id")  # 👈 comes from React
#
#     team = None
#     if team_id not in (None, "", "null"):
#         try:
#             team = Team.objects.get(id=team_id)
#         except Team.DoesNotExist:
#             return JsonResponse({"error": "Invalid team_id"}, status=400)
#
#     task = Task.objects.create(
#         name=name,
#         priority=priority,
#         difficulty=difficulty,
#         asking=asking,
#         team=team,   # 👈 attach team (or None)
#     )
#
#     return JsonResponse(
#         {
#             "status": "success",
#             "task": {
#                 "id": task.id,
#                 "name": task.name,
#                 "difficulty": task.difficulty,
#                 "priority": task.priority,
#                 "asking": task.asking,
#                 "team": task.team,
#             },
#         },
#         status=201,
#     )
#


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

def serialize_team(team):
    return {
        "id": team.id,
        "name": team.name,
        "color": team.color,
        "tasks": [serialize_task(task) for task in team.tasks.all()],  # 👈 only tasks with that team
    }


# def all_teams(request):
#     all_teams = Team.objects.all()
#     data = [model_to_dict(team) for team in all_teams]
#
#     return JsonResponse({"status": "test", "teams": data}, status=200)

def all_teams(request):
    # prefetch tasks so it doesn’t query DB in a loop
    all_teams = Team.objects.prefetch_related("tasks").all()
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


























def echo_view(request, text):
    times = request.GET.get('times')
    if times is not None:
        try:
            n = max(1, int(times))
        except ValueError:
            n = 1
        return JsonResponse({"echo": [text] * n})
    return JsonResponse({"echo": text})


from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login

@csrf_exempt
def create_user(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method must be POST"})

    request_json = json.loads(request.body)
    username = request_json.get('username')
    password_1 = request_json.get('password_first')
    password_2 = request_json.get('password_second')

    if password_1 != password_2:
        return JsonResponse({"error": "Passwords must match"}, status=400)

    # WICHTIG: create_user hasht das Passwort automatisch!
    created_user = User.objects.create_user(
        username=username,
        password=password_1
    )

    return JsonResponse({"user_id": created_user.id, "ok": True}, status=201)





from .models import User

def all_users(request):
    users = list(User.objects.values())  # returns list of dicts
    return JsonResponse({"users": users})





def display_single_user(request, user_id):
    print("user id: ", user_id)

    if request.method != 'GET':
        return JsonResponse({"error": "Method must be GET"})
    try:
        user = User.objects.get(pk=user_id)
        return JsonResponse({"user": user.name, "id": user.id})

    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"})




@csrf_exempt
def delete_user(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method must be POST"})
    try:
        data = json.loads(request.body)  # <-- this decodes the JSON
        user_id = int(data.get("id"))
        print(user_id, type(user_id))


        user_to_delete = User.objects.get(pk=user_id)
        user_to_delete.delete()
        return JsonResponse({"ok": True})
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=400)



@csrf_exempt
def change_name_user(request):
    print("SUccesfully in this function ")
    print("\n"*5)

    if request.method != "POST":
        print("Method must be POST")
        return JsonResponse({"error": "Method must be POST"})

    try:

        data = json.loads(request.body)
        user_id = int(data.get("id"))
        user = User.objects.get(pk=user_id)
        print(f"data: {data}, user_id: {user_id}")
        user.name = data.get("newName")
        print(data.get("newName"))
        user.save()
        print("User sucesfully saved")
        return JsonResponse({"ok": True})
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=400)




@csrf_exempt
def write_comment(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method must be POST"})

    try:
        data = json.loads(request.body)
        comment = data.get("comment")
        if data.get("author"):
            author = data.get("author")
            Comment.objects.create(text=comment, author=author)
            return JsonResponse({"ok": True})
        else:
            Comment.objects.create(text=comment)
            return JsonResponse({"ok": True})


    except json.decoder.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)



def all_comments(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method can only be GET"}, status=405)

    comments = Comment.objects.values()  # ← converts into list of dicts
    data = list(comments)

    return JsonResponse({"comments": data}, safe=False)




from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required

# In backend/api/views.py
@csrf_exempt
def api_login(request):
    print("=" * 50)
    print("LOGIN REQUEST")

    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    data = json.loads(request.body)
    user = authenticate(username=data["username"], password=data["password"])  # ← This line defines 'user'

    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=400)

    login(request, user)  # ← Now 'user' exists

    # Debug prints:
    print("SESSION KEY:", request.session.session_key)
    print("USER AUTHENTICATED:", request.user.is_authenticated)
    print("=" * 50)

    return JsonResponse({"message": "Logged in"})


# And in get_current_user:

def get_current_user(request):
    print("=" * 50)
    print("CHECK AUTH REQUEST")
    print("SESSION KEY:", request.session.session_key)
    print("USER:", request.user)
    print("IS AUTHENTICATED:", request.user.is_authenticated)
    print("COOKIES:", request.COOKIES)
    print("=" * 50)

    # THIS MUST COME BEFORE accessing user.email!
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated"}, status=401)

    # Now it's safe to access user properties
    user = request.user
    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "is_authenticated": True
    })

# Optional: Für nicht-eingeloggte User
def check_auth(request):
    """Check if user is authenticated"""
    if request.user.is_authenticated:
        return JsonResponse({
            "id": request.user.id,
            "username": request.user.username,
            "is_authenticated": True
        })
    return JsonResponse({"is_authenticated": False}, status=401)




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





from django.http import JsonResponse
from django.views.decorators.http import require_GET


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
