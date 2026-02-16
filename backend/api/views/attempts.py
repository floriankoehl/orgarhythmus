import json
from datetime import timedelta

from django.http import JsonResponse

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    Project,
    Task,
    Attempt,
    AttemptTodo,
    AttemptDependency,
    Notification,
)
from .helpers import user_has_project_access


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

    # match the keys sent from frontend
    vortakt_attempt_id = body.get("vortakt_attempt_id")
    nachtakt_attempt_id = body.get("nachtakt_attempt_id")

    if not vortakt_attempt_id or not nachtakt_attempt_id:
        return JsonResponse({"error": "Missing vortakt_attempt_id or nachtakt_attempt_id"}, status=400)

    try:
        vortakt_attempt = Attempt.objects.get(id=vortakt_attempt_id)
        nachtakt_attempt = Attempt.objects.get(id=nachtakt_attempt_id)
    except Attempt.DoesNotExist:
        return JsonResponse({"error": "One of the attempts does not exist"}, status=404)

    # use the correct model: AttemptDependency
    vortakt_dependency, created = AttemptDependency.objects.get_or_create(
        vortakt_attempt=vortakt_attempt,
        nachtakt_attempt=nachtakt_attempt
    )

    print("Attempt Dependency added", vortakt_dependency)

    return JsonResponse({
        "id": vortakt_dependency.id,
        "vortakt": vortakt_attempt.id,
        "nachtakt": nachtakt_attempt.id,
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

    # Automatically create a "complete task" todo for the attempt
    AttemptTodo.objects.create(
        attempt=attempt,
        text="complete task",
        done=False,
    )

    return Response(
        {
            "id": attempt.id,
            "name": attempt.name,
            "description": attempt.description,
            "number": attempt.number,
            "slot_index": attempt.slot_index,
            "done": attempt.done,
            "todos": [
                {
                    "id": attempt.todos.first().id,
                    "text": "complete task",
                    "done": False,
                }
            ],
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


# attempt_detail_view
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
                Notification.objects.filter(related_attempt=attempt).delete()
        if "name" in data:
            attempt.name = data.get("name") or attempt.name
        if "description" in data:
            attempt.description = data.get("description")
        attempt.save()
        return Response({"id": attempt.id, "done": attempt.done, "name": attempt.name, "description": attempt.description}, status=status.HTTP_200_OK)


# attempt_todos_view
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