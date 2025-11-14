import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import User

def echo_view(request, text):
    times = request.GET.get('times')
    if times is not None:
        try:
            n = max(1, int(times))
        except ValueError:
            n = 1
        return JsonResponse({"echo": [text] * n})
    return JsonResponse({"echo": text})


@csrf_exempt
def create_user(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method must be POST"})

    request_json = json.loads(request.body)
    name = request_json.get('username')
    password_1 = request_json.get('password_first')
    password_2 = request_json.get('password_second')

    if password_1 != password_2:
        print("It returns this password proiblem")
        return JsonResponse({"error": "Passwords must match"}, status=400)


    created_user = User.objects.create(name=name, password=password_1)

    return JsonResponse({"user_id": created_user.id, "ok": True}, status=201)





from django.http import JsonResponse
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
