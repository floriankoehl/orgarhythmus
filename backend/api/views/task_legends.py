from django.db import models as db_models
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Task, TaskLegend, TaskLegendType, TaskLegendAssignment
from .helpers import user_has_project_access
from .serializers import TaskLegendSerializer, TaskLegendTypeSerializer


# ─── helpers ───────────────────────────────────────────────

def _get_project_or_403(user, project_id):
    """Return project if user has access, else None."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return None
    if not user_has_project_access(user, project):
        return None
    return project


# ═══════════════════════════════════════════════════════════
#  TASK LEGEND CRUD
# ═══════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project_task_legends(request, project_id):
    """List all task legends for a project."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    legends = TaskLegend.objects.filter(project=project)
    return Response({"legends": TaskLegendSerializer(legends, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_task_legend(request, project_id):
    """Create a new task legend inside a project."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    name = (request.data.get("name") or "New Legend").strip()
    leg = TaskLegend.objects.create(project=project, owner=request.user, name=name)
    return Response({"created": True, "legend": TaskLegendSerializer(leg).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_task_legend(request, project_id, legend_id):
    """Update a task legend's name."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    name = (request.data.get("name") or "").strip()
    if name:
        leg.name = name
        leg.save(update_fields=["name"])
    return Response({"updated": True, "legend": TaskLegendSerializer(leg).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_task_legend(request, project_id, legend_id):
    """Delete a task legend (and its types + assignments)."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    TaskLegend.objects.filter(id=legend_id, project=project).delete()
    return Response({"deleted": True})


# ═══════════════════════════════════════════════════════════
#  TASK LEGEND TYPE CRUD
# ═══════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_task_legend_types(request, project_id, legend_id):
    """List all types for a specific task legend."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    types = TaskLegendType.objects.filter(legend=leg)
    return Response({"types": TaskLegendTypeSerializer(types, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_task_legend_type(request, project_id, legend_id):
    """Create a type inside a task legend."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    name = (request.data.get("name") or "New Type").strip()
    color = request.data.get("color", "#cccccc")
    icon = request.data.get("icon", None)
    max_order = TaskLegendType.objects.filter(legend=leg).aggregate(
        db_models.Max("order_index")
    )["order_index__max"]
    next_order = (max_order + 1) if max_order is not None else 0
    lt = TaskLegendType.objects.create(
        legend=leg, name=name, color=color, icon=icon, order_index=next_order
    )
    return Response({"created": True, "type": TaskLegendTypeSerializer(lt).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_task_legend_type(request, project_id, legend_id, type_id):
    """Update a type inside a task legend."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    lt = get_object_or_404(TaskLegendType, id=type_id, legend=leg)
    if "name" in request.data:
        lt.name = (request.data["name"] or "").strip()
    if "color" in request.data:
        lt.color = request.data["color"]
    if "icon" in request.data:
        lt.icon = request.data["icon"] or None
    lt.save()
    return Response({"updated": True, "type": TaskLegendTypeSerializer(lt).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_task_legend_type(request, project_id, legend_id, type_id):
    """Delete a type inside a task legend."""
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)
    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    TaskLegendType.objects.filter(id=type_id, legend=leg).delete()
    return Response({"deleted": True})


# ═══════════════════════════════════════════════════════════
#  TASK ↔ LEGEND TYPE ASSIGNMENT
# ═══════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_task_legend_type(request, project_id):
    """
    Assign (or unassign) a legend type to a task.
    Body: { task_id, legend_id, legend_type_id }
    legend_type_id=null removes the assignment for that legend.
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)

    task_id = request.data.get("task_id")
    legend_id = request.data.get("legend_id")
    legend_type_id = request.data.get("legend_type_id")

    if not task_id or not legend_id:
        return Response({"error": "task_id and legend_id required"}, status=400)

    task = get_object_or_404(Task, id=task_id, project=project)
    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)

    if legend_type_id is not None:
        lt = get_object_or_404(TaskLegendType, id=legend_type_id, legend=leg)
        TaskLegendAssignment.objects.update_or_create(
            task=task, legend=leg,
            defaults={"legend_type": lt},
        )
    else:
        TaskLegendAssignment.objects.filter(task=task, legend=leg).delete()

    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_assign_task_legend_type(request, project_id):
    """
    Assign (or unassign) a legend type to multiple tasks at once.
    Body: { task_ids: [...], legend_id, legend_type_id }
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)

    task_ids = request.data.get("task_ids", [])
    legend_id = request.data.get("legend_id")
    legend_type_id = request.data.get("legend_type_id")

    if not legend_id:
        return Response({"error": "legend_id required"}, status=400)

    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    tasks = Task.objects.filter(id__in=task_ids, project=project)

    if legend_type_id is not None:
        lt = get_object_or_404(TaskLegendType, id=legend_type_id, legend=leg)
        updated = 0
        for task in tasks:
            TaskLegendAssignment.objects.update_or_create(
                task=task, legend=leg,
                defaults={"legend_type": lt},
            )
            updated += 1
        return Response({"updated": updated})
    else:
        removed = TaskLegendAssignment.objects.filter(
            task__in=tasks, legend=leg
        ).delete()[0]
        return Response({"removed": removed})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_remove_task_legend_type(request, project_id):
    """
    Remove legend type assignment for a specific legend from multiple tasks.
    Body: { task_ids: [...], legend_id }
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)

    task_ids = request.data.get("task_ids", [])
    legend_id = request.data.get("legend_id")

    if not legend_id:
        return Response({"error": "legend_id required"}, status=400)

    leg = get_object_or_404(TaskLegend, id=legend_id, project=project)
    removed = TaskLegendAssignment.objects.filter(
        task__id__in=task_ids,
        task__project=project,
        legend=leg,
    ).delete()[0]

    return Response({"removed": removed})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_all_task_legend_types(request, project_id):
    """
    Remove ALL legend type assignments from a task.
    Body: { task_id }
    """
    project = _get_project_or_403(request.user, project_id)
    if not project:
        return Response({"error": "Not found"}, status=404)

    task_id = request.data.get("task_id")
    task = get_object_or_404(Task, id=task_id, project=project)
    TaskLegendAssignment.objects.filter(task=task).delete()

    return Response({"removed": True})
