from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, ProtoPersona, Task
from .serializers import ProtoPersonaSerializer
from .helpers import user_has_project_access


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_protopersonas(request, project_id):
    """Get all protopersonas for a project."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    personas = ProtoPersona.objects.filter(project=project)
    serialized = ProtoPersonaSerializer(personas, many=True)
    return Response({"protopersonas": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_protopersona(request, project_id):
    """
    Create a new protopersona.
    Body: { "name": str, "color": str, "hair_color": str, "task"?: int|null, "day_index"?: int }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = request.data.get("name", "New Persona")
    color = request.data.get("color", "#3b82f6")
    hair_color = request.data.get("hair_color", "#4a3728")
    day_index = int(request.data.get("day_index", 0))
    task_id = request.data.get("task", None)

    task = None
    if task_id is not None:
        try:
            task = Task.objects.get(pk=int(task_id), project=project)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

    max_order = ProtoPersona.objects.filter(project=project).count()

    persona = ProtoPersona.objects.create(
        project=project,
        task=task,
        name=name,
        color=color,
        hair_color=hair_color,
        day_index=day_index,
        order_index=max_order,
    )

    serialized = ProtoPersonaSerializer(persona)
    return Response({"protopersona": serialized.data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_protopersona(request, project_id, persona_id):
    """
    Update a protopersona's fields.
    Body: any of { "name", "color", "hair_color", "task", "day_index", "order_index" }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        persona = ProtoPersona.objects.get(pk=persona_id, project=project)
    except ProtoPersona.DoesNotExist:
        return Response({"detail": "ProtoPersona not found"}, status=status.HTTP_404_NOT_FOUND)

    if "name" in request.data:
        persona.name = request.data["name"]
    if "color" in request.data:
        persona.color = request.data["color"]
    if "hair_color" in request.data:
        persona.hair_color = request.data["hair_color"]
    if "day_index" in request.data:
        persona.day_index = int(request.data["day_index"])
    if "order_index" in request.data:
        persona.order_index = int(request.data["order_index"])
    if "task" in request.data:
        task_id = request.data["task"]
        if task_id is None:
            persona.task = None
        else:
            try:
                persona.task = Task.objects.get(pk=int(task_id), project=project)
            except Task.DoesNotExist:
                return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

    persona.save()
    serialized = ProtoPersonaSerializer(persona)
    return Response({"protopersona": serialized.data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_protopersona(request, project_id, persona_id):
    """Delete a protopersona."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    try:
        persona = ProtoPersona.objects.get(pk=persona_id, project=project)
    except ProtoPersona.DoesNotExist:
        return Response({"detail": "ProtoPersona not found"}, status=status.HTTP_404_NOT_FOUND)

    persona.delete()
    return Response({"deleted": True}, status=status.HTTP_200_OK)
