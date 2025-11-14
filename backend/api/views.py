import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import User, Comment
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required  # ← ADD THIS
from django.views.decorators.csrf import csrf_exempt
import json

# ... rest of your code

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










