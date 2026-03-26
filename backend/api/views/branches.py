"""
Branch CRUD views.

Endpoints:
  GET    /api/projects/<id>/branches/                    — list branches
  POST   /api/projects/<id>/branches/create/             — create branch (fork from source)
  GET    /api/projects/<id>/branches/<bid>/              — branch detail
  PATCH  /api/projects/<id>/branches/<bid>/update/       — update branch (demo_index)
  DELETE /api/projects/<id>/branches/<bid>/delete/       — delete branch (not main)
  POST   /api/projects/<id>/branches/enter-demo/         — fork into a demo branch
"""
from datetime import date as date_class, timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    Branch, Day, Milestone, Phase, Project,
    Task, TaskLegend, TaskLegendAssignment, TaskLegendType,
    Team, AcceptanceCriterion, MilestoneTodo, Dependency,
)
from .helpers import user_has_project_access
from .serializers import BranchSerializer


# ─── helpers ──────────────────────────────────────────────────────────────────

def _get_project_or_403(user, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return None
    if not user_has_project_access(user, project):
        return None
    return project


# ═══════════════════════════════════════════════════════════════════════════════
#  BRANCH LIST / CREATE
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_branches(request, project_id):
    """Return all branches for a project."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    branches = project.branches.all()
    return Response({"branches": BranchSerializer(branches, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_branch(request, project_id):
    """
    Fork an existing branch into a new one.

    Body:
        name          (str, required)
        description   (str, optional)
        source_branch_id  (int, required) — the branch to fork from
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"error": "name is required"}, status=400)

    source_id = request.data.get("source_branch_id")
    if not source_id:
        return Response({"error": "source_branch_id is required"}, status=400)

    try:
        source = Branch.objects.get(pk=source_id, project=project)
    except Branch.DoesNotExist:
        return Response({"error": "Source branch not found"}, status=404)

    if Branch.objects.filter(project=project, name=name).exists():
        return Response({"error": f"Branch '{name}' already exists"}, status=400)

    description = (request.data.get("description") or "").strip()

    with transaction.atomic():
        new_branch = Branch.objects.create(
            project=project,
            name=name,
            description=description,
            is_main=False,
            source_branch=source,
            created_by=request.user,
        )
        _copy_branch_data(source, new_branch)

    return Response(
        {"created": True, "branch": BranchSerializer(new_branch).data},
        status=201,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  BRANCH DETAIL / DELETE
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def branch_detail(request, project_id, branch_id):
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    try:
        branch = Branch.objects.get(pk=branch_id, project=project)
    except Branch.DoesNotExist:
        return Response({"error": "Branch not found"}, status=404)
    return Response({"branch": BranchSerializer(branch).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_branch(request, project_id, branch_id):
    """Delete a branch. The main branch cannot be deleted."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    try:
        branch = Branch.objects.get(pk=branch_id, project=project)
    except Branch.DoesNotExist:
        return Response({"error": "Branch not found"}, status=404)
    if branch.is_main:
        return Response({"error": "Cannot delete the main branch"}, status=400)
    branch.delete()
    return Response({"deleted": True})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def patch_branch(request, project_id, branch_id):
    """
    Update mutable fields on a branch.
    Currently only `demo_index` (int) is patchable this way.
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    try:
        branch = Branch.objects.get(pk=branch_id, project=project)
    except Branch.DoesNotExist:
        return Response({"error": "Branch not found"}, status=404)

    if "demo_index" in request.data:
        val = request.data["demo_index"]
        if val is not None and not isinstance(val, int):
            return Response({"error": "demo_index must be an integer or null"}, status=400)
        branch.demo_index = val
        branch.save(update_fields=["demo_index"])

    return Response({"branch": BranchSerializer(branch).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enter_demo(request, project_id):
    """
    Fork the given source branch into a new demo branch.

    Body:
        source_branch_id  (int, required) — branch to fork from

    The new branch gets:
        is_demo    = True
        demo_index = today's position relative to project.start_date
                     (0 if start_date is not set, or today is before start_date)
        name       = auto-generated "demo-YYYY-MM-DD-HHmm" (unique)
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)

    source_id = request.data.get("source_branch_id")
    if not source_id:
        return Response({"error": "source_branch_id is required"}, status=400)

    try:
        source = Branch.objects.get(pk=source_id, project=project)
    except Branch.DoesNotExist:
        return Response({"error": "Source branch not found"}, status=404)

    # Compute initial demo_index = days from project.start_date to today
    today = date_class.today()
    if project.start_date:
        delta = (today - project.start_date).days
        initial_index = max(delta, 0)
    else:
        initial_index = 0

    # Generate a unique demo branch name
    from datetime import datetime
    base_name = f"demo-{datetime.now().strftime('%Y-%m-%d-%H%M')}"
    name = base_name
    suffix = 1
    while Branch.objects.filter(project=project, name=name).exists():
        name = f"{base_name}-{suffix}"
        suffix += 1

    with transaction.atomic():
        new_branch = Branch.objects.create(
            project=project,
            name=name,
            description="",
            is_main=False,
            is_demo=True,
            demo_index=initial_index,
            source_branch=source,
            created_by=request.user,
        )
        _copy_branch_data(source, new_branch)

    return Response(
        {"created": True, "branch": BranchSerializer(new_branch).data},
        status=201,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  DEEP-COPY HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _copy_branch_data(source: Branch, dest: Branch):
    """
    Deep-copy all branch-aware data from `source` to `dest`.

    Copies (in dependency order):
      Team → Task (+ AcceptanceCriterion) →
      Milestone (+ MilestoneTodo) → Dependency →
      Phase → TaskLegend (+ TaskLegendType) → TaskLegendAssignment → Day

    Uses id-maps to correctly remap all FK references between copied rows.
    """
    project = dest.project

    # ── Teams ──────────────────────────────────────────────────────────────────
    team_map = {}  # old_id → new Team
    for old_team in Team.objects.filter(branch=source):
        new_team = Team.objects.create(
            project=project,
            branch=dest,
            name=old_team.name,
            color=old_team.color,
            line_index=old_team.line_index,
            order_index=old_team.order_index,
        )
        # Copy M2M members
        new_team.members.set(old_team.members.all())
        team_map[old_team.pk] = new_team

    # ── Tasks + AcceptanceCriteria ─────────────────────────────────────────────
    task_map = {}  # old_id → new Task
    for old_task in Task.objects.filter(branch=source):
        new_team = team_map.get(old_task.team_id)
        new_task = Task.objects.create(
            project=project,
            branch=dest,
            team=new_team,
            name=old_task.name,
            description=old_task.description,
            difficulty=old_task.difficulty,
            priority=old_task.priority,
            needs_approval=old_task.needs_approval,
            hard_deadline=old_task.hard_deadline,
            team_index=old_task.team_index,
            order_index=old_task.order_index,
        )
        new_task.assigned_members.set(old_task.assigned_members.all())
        task_map[old_task.pk] = new_task

        for ac in old_task.acceptance_criteria.all():
            AcceptanceCriterion.objects.create(
                task=new_task,
                title=ac.title,
                description=ac.description,
                done=ac.done,
                order=ac.order,
            )

    # ── Milestones + MilestoneTodos ────────────────────────────────────────────
    milestone_map = {}  # old_id → new Milestone
    for old_ms in Milestone.objects.filter(branch=source):
        new_task = task_map.get(old_ms.task_id)
        if new_task is None:
            continue  # orphaned milestone — skip
        new_ms = Milestone.objects.create(
            project=project,
            branch=dest,
            task=new_task,
            name=old_ms.name,
            description=old_ms.description,
            start_index=old_ms.start_index,
            duration=old_ms.duration,
        )
        milestone_map[old_ms.pk] = new_ms

        for todo in old_ms.todos.all():
            MilestoneTodo.objects.create(
                milestone=new_ms,
                title=todo.title,
                description=todo.description,
                done=todo.done,
                order=todo.order,
            )

    # ── Dependencies ──────────────────────────────────────────────────────────
    source_milestone_ids = set(milestone_map.keys())
    for old_dep in Dependency.objects.filter(
        source__in=source_milestone_ids,
        target__in=source_milestone_ids,
    ):
        new_src = milestone_map.get(old_dep.source_id)
        new_tgt = milestone_map.get(old_dep.target_id)
        if new_src and new_tgt:
            Dependency.objects.create(
                source=new_src,
                target=new_tgt,
                weight=old_dep.weight,
                reason=old_dep.reason,
                description=old_dep.description,
            )

    # ── Phases ────────────────────────────────────────────────────────────────
    for old_phase in Phase.objects.filter(branch=source):
        new_team = team_map.get(old_phase.team_id) if old_phase.team_id else None
        Phase.objects.create(
            project=project,
            branch=dest,
            team=new_team,
            name=old_phase.name,
            start_index=old_phase.start_index,
            duration=old_phase.duration,
            color=old_phase.color,
            order_index=old_phase.order_index,
        )

    # ── TaskLegends + TaskLegendTypes ──────────────────────────────────────────
    legend_map = {}   # old legend id → new TaskLegend
    type_map = {}     # old type id   → new TaskLegendType
    for old_leg in TaskLegend.objects.filter(branch=source):
        new_leg = TaskLegend.objects.create(
            project=project,
            branch=dest,
            owner=old_leg.owner,
            name=old_leg.name,
        )
        legend_map[old_leg.pk] = new_leg

        for old_type in old_leg.types.all():
            new_type = TaskLegendType.objects.create(
                legend=new_leg,
                name=old_type.name,
                color=old_type.color,
                icon=old_type.icon,
                order_index=old_type.order_index,
            )
            type_map[old_type.pk] = new_type

    # ── TaskLegendAssignments ──────────────────────────────────────────────────
    source_task_ids = set(task_map.keys())
    for old_asgn in TaskLegendAssignment.objects.filter(task__in=source_task_ids):
        new_task = task_map.get(old_asgn.task_id)
        new_leg = legend_map.get(old_asgn.legend_id)
        new_type = type_map.get(old_asgn.legend_type_id)
        if new_task and new_leg and new_type:
            TaskLegendAssignment.objects.create(
                task=new_task,
                legend=new_leg,
                legend_type=new_type,
            )

    # ── Days ──────────────────────────────────────────────────────────────────
    for old_day in Day.objects.filter(branch=source):
        Day.objects.create(
            project=project,
            branch=dest,
            date=old_day.date,
            day_index=old_day.day_index,
            purpose=old_day.purpose,
            purpose_teams=old_day.purpose_teams,
            description=old_day.description,
            is_blocked=old_day.is_blocked,
            color=old_day.color,
        )
