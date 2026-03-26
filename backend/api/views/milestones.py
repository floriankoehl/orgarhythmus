from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Task, Milestone, MilestoneTodo, Dependency
from .serializers import MilestoneSerializer_Deps, MilestoneTodoSerializer, DependencySerializer_Deps
from .helpers import user_has_project_access, resolve_branch


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

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    all_milestones = Milestone.objects.filter(project=project, branch=branch).prefetch_related("todos", "task__acceptance_criteria")
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
    Body: { "task_id": <id>, "name": <optional>, "description": <optional> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    task_id = request.data.get("task_id")
    if not task_id:
        return Response({"detail": "task_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        task = Task.objects.get(id=int(task_id), project=project, branch=branch)
    except Task.DoesNotExist:
        return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

    name = request.data.get("name") or f"{task.name}_0"
    description = request.data.get("description") or ""
    start_index = request.data.get("start_index", 0)
    if int(start_index) < 0:
        return Response({"detail": "Milestone cannot be placed before day 0"}, status=status.HTTP_400_BAD_REQUEST)
    duration = 1
    milestone = Milestone.objects.create(
        project=project,
        branch=branch,
        name=name,
        description=description,
        task=task,
        start_index=start_index,
        duration=duration,
    )

    # Auto-create default todo so is_done can be derived
    MilestoneTodo.objects.create(
        milestone=milestone,
        title="Milestone finished",
        order=0,
    )

    serialized = MilestoneSerializer_Deps(milestone)

    return Response({"added_milestone": serialized.data, "created": True})


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

    # Prevent moving before project start (day 0)
    if int(new_index) < 0:
        return Response({"detail": "Milestone cannot be placed before day 0"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.select_related('task').get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    # Hard deadline check
    if milestone.task and milestone.task.hard_deadline is not None:
        new_end = new_index + (milestone.duration or 1) - 1
        if new_end > milestone.task.hard_deadline:
            return Response(
                {"detail": "Move blocked: milestone would exceed task hard deadline"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    milestone.start_index = new_index
    milestone.save()
    return Response({"updated": "true"})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def bulk_update_start_index(request, project_id):
    """
    Move multiple milestones at once (single atomic operation).
    Body: { "moves": [ { "milestone_id": <id>, "index": <new_index> }, ... ] }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    moves = request.data.get("moves")
    if not moves or not isinstance(moves, list):
        return Response({"detail": "moves array is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Validate all moves first before persisting any
    milestone_ids = [int(m["milestone_id"]) for m in moves]
    milestones = {
        ms.id: ms
        for ms in Milestone.objects.select_related("task").filter(id__in=milestone_ids, project=project, branch=branch)
    }

    for m in moves:
        ms_id = int(m["milestone_id"])
        new_index = int(m["index"])

        if new_index < 0:
            return Response({"detail": f"Milestone {ms_id} cannot be placed before day 0"}, status=status.HTTP_400_BAD_REQUEST)

        ms = milestones.get(ms_id)
        if not ms:
            return Response({"detail": f"Milestone {ms_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        if ms.task and ms.task.hard_deadline is not None:
            new_end = new_index + (ms.duration or 1) - 1
            if new_end > ms.task.hard_deadline:
                return Response(
                    {"detail": f"Move blocked: milestone {ms_id} would exceed task hard deadline"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    # All validated — persist
    for m in moves:
        ms = milestones[int(m["milestone_id"])]
        ms.start_index = int(m["index"])
        ms.save(update_fields=["start_index"])

    return Response({"updated": len(moves)})


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
def toggle_milestone_done(request, project_id):
    """
    Toggle the done state of a milestone by toggling its todos.
    is_done is computed: all todos must be done.
    If force_complete=true, marks all todos as done.
    Otherwise, returns an error listing incomplete todos.
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("milestone_id")
    if not milestone_id:
        return Response({"detail": "milestone_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.prefetch_related("todos", "task__acceptance_criteria").get(
            id=milestone_id, project=project
        )
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    todos = milestone.todos.all()
    all_done = todos.exists() and all(t.done for t in todos)

    if all_done:
        # Currently done → mark all todos as not done
        todos.update(done=False)
    else:
        # Currently not done → try to mark all as done
        incomplete = [t for t in todos if not t.done]
        if incomplete:
            force = request.data.get("force_complete", False)
            if force:
                todos.filter(done=False).update(done=True)
            else:
                return Response({
                    "detail": "Cannot mark milestone as done: not all TODOs are completed.",
                    "incomplete_todos": [{"id": t.id, "title": t.title} for t in incomplete],
                }, status=status.HTTP_400_BAD_REQUEST)

    # Re-fetch to get updated state
    milestone = Milestone.objects.prefetch_related("todos", "task__acceptance_criteria").get(pk=milestone.pk)
    serialized = MilestoneSerializer_Deps(milestone)
    return Response(serialized.data, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def toggle_milestone_todo(request, project_id):
    """
    Toggle an individual MilestoneTodo's done state.
    Body: { "milestone_id": <id>, "todo_id": <id> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("milestone_id")
    todo_id = request.data.get("todo_id")
    if not milestone_id or not todo_id:
        return Response({"detail": "milestone_id and todo_id are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        todo = MilestoneTodo.objects.get(id=todo_id, milestone=milestone)
    except MilestoneTodo.DoesNotExist:
        return Response({"detail": "Todo not found"}, status=status.HTTP_404_NOT_FOUND)

    todo.done = not todo.done
    todo.save(update_fields=["done"])

    # Return full milestone with updated computed fields
    milestone = Milestone.objects.prefetch_related("todos", "task__acceptance_criteria").get(pk=milestone.pk)
    serialized = MilestoneSerializer_Deps(milestone)
    return Response(serialized.data, status=status.HTTP_200_OK)


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
        milestone = Milestone.objects.select_related('task').get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    duration = milestone.duration + change

    if duration < 1: 
        duration = 1

    # Hard deadline check
    if milestone.task and milestone.task.hard_deadline is not None:
        new_end = milestone.start_index + duration - 1
        if new_end > milestone.task.hard_deadline:
            return Response(
                {"detail": "Resize blocked: milestone would exceed task hard deadline"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_milestone(request, project_id):
    """
    Update a milestone's name and/or description.
    Body: { "id": <milestone_id>, "name": <optional>, "description": <optional> }
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

    if "name" in request.data:
        name = request.data["name"].strip()
        if name:
            milestone.name = name
    if "description" in request.data:
        milestone.description = request.data["description"]
    milestone.save()

    milestone = Milestone.objects.prefetch_related("todos", "task__acceptance_criteria").get(pk=milestone.pk)
    return Response(MilestoneSerializer_Deps(milestone).data, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_milestone_todo(request, project_id):
    """
    Add a new todo to a milestone.
    Body: { "milestone_id": <id>, "title": <str> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("milestone_id")
    title = (request.data.get("title") or "").strip()
    if not milestone_id or not title:
        return Response({"detail": "milestone_id and title are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    order = milestone.todos.count()
    MilestoneTodo.objects.create(milestone=milestone, title=title, order=order)

    milestone = Milestone.objects.prefetch_related("todos", "task__acceptance_criteria").get(pk=milestone.pk)
    return Response(MilestoneSerializer_Deps(milestone).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_milestone_todo(request, project_id):
    """
    Delete a todo from a milestone.
    Body: { "milestone_id": <id>, "todo_id": <id> }
    Cannot delete the auto-created 'Milestone finished' default todo.
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("milestone_id")
    todo_id = request.data.get("todo_id")
    if not milestone_id or not todo_id:
        return Response({"detail": "milestone_id and todo_id are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        todo = MilestoneTodo.objects.get(id=todo_id, milestone=milestone)
    except MilestoneTodo.DoesNotExist:
        return Response({"detail": "Todo not found"}, status=status.HTTP_404_NOT_FOUND)

    if todo.title == "Milestone finished":
        return Response({"detail": "Cannot delete the default milestone todo"}, status=status.HTTP_400_BAD_REQUEST)

    todo.delete()

    milestone = Milestone.objects.prefetch_related("todos", "task__acceptance_criteria").get(pk=milestone.pk)
    return Response(MilestoneSerializer_Deps(milestone).data, status=200)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def move_milestone_task(request, project_id):
    """
    Move a milestone to a different task within the same project.
    Body: { "milestone_id": <id>, "new_task_id": <id> }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    milestone_id = request.data.get("milestone_id")
    new_task_id = request.data.get("new_task_id")

    if not milestone_id or not new_task_id:
        return Response({"detail": "milestone_id and new_task_id are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        milestone = Milestone.objects.get(id=milestone_id, project=project)
    except Milestone.DoesNotExist:
        return Response({"detail": "Milestone not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        new_task = Task.objects.get(id=int(new_task_id), project=project)
    except Task.DoesNotExist:
        return Response({"detail": "Target task not found"}, status=status.HTTP_404_NOT_FOUND)

    milestone.task = new_task
    milestone.save()

    serializer = MilestoneSerializer_Deps(milestone)
    return Response({"success": True, "data": serializer.data}, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_import_dependencies(request, project_id):
    """
    Create milestones for selected tasks and wire up dependencies from an AI-generated JSON.

    Body: {
      "dependencies": [
        { "task_id": 10, "depends_on": [20, 30], "descriptions": { "20": "reason text", "30": null } },
        { "task_id": 20, "depends_on": [] },
        { "task_id": 30, "depends_on": [20], "descriptions": { "20": "blocks until auth is done" } },
      ]
    }

    Each entry can optionally include a "descriptions" mapping from dep task_id
    to a description string (or null) for that dependency edge.

    Algorithm:
    1. Create one milestone per task (named <task_name>_0).
    2. Topological sort the DAG to assign layers (longest-path / level scheduling).
    3. Tasks with no incoming → start_index = 0.
       Tasks depending on others → start_index = max(dep.start_index + dep.duration) for all deps.
       (duration defaults to 1, so the minimum gap is 1 day.)
    4. Create Dependency records between the corresponding milestones.
    """
    from collections import defaultdict, deque
    import json

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    branch = resolve_branch(request, project)
    if branch is None:
        return Response({"detail": "Branch not found."}, status=status.HTTP_404_NOT_FOUND)

    deps_list = request.data.get("dependencies")
    if not deps_list or not isinstance(deps_list, list):
        return Response({"detail": '"dependencies" array is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Collect all referenced task IDs
    task_ids = set()
    adj = defaultdict(list)       # task_id -> [task_ids it depends on]
    in_degree = defaultdict(int)

    for entry in deps_list:
        tid = entry.get("task_id")
        if tid is None:
            return Response({"detail": 'Each entry needs "task_id"'}, status=status.HTTP_400_BAD_REQUEST)
        tid = int(tid)
        task_ids.add(tid)
        depends_on = entry.get("depends_on", [])
        if not isinstance(depends_on, list):
            depends_on = []
        for dep_id in depends_on:
            dep_id = int(dep_id)
            task_ids.add(dep_id)
            adj[tid].append(dep_id)      # tid depends on dep_id  →  dep_id -> tid (edge)

    # Verify all tasks belong to this project and branch
    existing_tasks = {t.id: t for t in Task.objects.filter(id__in=task_ids, project=project, branch=branch)}
    missing = task_ids - set(existing_tasks.keys())
    if missing:
        return Response(
            {"detail": f"Tasks not found in project: {sorted(missing)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Build the DAG (edges go from dependency → dependent, i.e. prerequisite → task)
    # For topological sort with "level" scheduling:
    # forward_adj: dep_id -> [tasks that depend on dep_id]
    forward_adj = defaultdict(list)
    reverse_adj = defaultdict(list)   # task_id -> [task_ids it depends on]  (same as adj)
    in_deg = defaultdict(int)

    for entry in deps_list:
        tid = int(entry["task_id"])
        depends_on = entry.get("depends_on", [])
        if not isinstance(depends_on, list):
            depends_on = []
        for dep_id in depends_on:
            dep_id = int(dep_id)
            forward_adj[dep_id].append(tid)
            reverse_adj[tid].append(dep_id)
            in_deg[tid] += 1

    # Ensure every task_id is in in_deg (even roots)
    for tid in task_ids:
        if tid not in in_deg:
            in_deg[tid] = 0

    # Kahn's algorithm (topological sort) — also computes start_index per task
    queue = deque()
    start_indices = {}

    for tid in task_ids:
        if in_deg[tid] == 0:
            queue.append(tid)
            start_indices[tid] = 0

    processed = 0
    while queue:
        tid = queue.popleft()
        processed += 1
        for dependent in forward_adj[tid]:
            # The dependent's start must be at least (this task's start + 1)
            candidate = start_indices[tid] + 1  # duration=1, so end = start+1-1 = start, next day = start+1
            if dependent not in start_indices or candidate > start_indices[dependent]:
                start_indices[dependent] = candidate
            in_deg[dependent] -= 1
            if in_deg[dependent] == 0:
                queue.append(dependent)

    if processed != len(task_ids):
        return Response(
            {"detail": "Cycle detected in dependency graph — cannot schedule"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create milestones
    task_to_milestone = {}
    created_milestones = []
    for tid in task_ids:
        task_obj = existing_tasks[tid]
        ms = Milestone.objects.create(
            project=project,
            branch=branch,
            task=task_obj,
            name=f"{task_obj.name}_0",
            description="",
            start_index=start_indices[tid],
            duration=1,
        )
        task_to_milestone[tid] = ms
        created_milestones.append(ms)

    # Create dependencies between milestones
    created_deps = []
    for entry in deps_list:
        tid = int(entry["task_id"])
        depends_on = entry.get("depends_on", [])
        descriptions = entry.get("descriptions", {})
        if not isinstance(depends_on, list):
            depends_on = []
        if not isinstance(descriptions, dict):
            descriptions = {}
        for dep_id in depends_on:
            dep_id = int(dep_id)
            source_ms = task_to_milestone[dep_id]    # prerequisite
            target_ms = task_to_milestone[tid]        # dependent
            dep_desc = descriptions.get(str(dep_id)) or descriptions.get(dep_id)
            dep_obj = Dependency.objects.create(
                source=source_ms,
                target=target_ms,
                weight='strong',
                description=dep_desc if dep_desc else None,
            )
            created_deps.append(dep_obj)

    milestones_data = MilestoneSerializer_Deps(created_milestones, many=True).data
    deps_data = DependencySerializer_Deps(created_deps, many=True).data

    return Response({
        "milestones": milestones_data,
        "dependencies": deps_data,
        "count": {
            "milestones": len(created_milestones),
            "dependencies": len(created_deps),
        },
    }, status=status.HTTP_201_CREATED)