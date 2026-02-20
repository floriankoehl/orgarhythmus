from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, ProtoPersona, Milestone
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
    return Response({"personas": serialized.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_protopersona(request, project_id):
    """
    Create a new protopersona.
    Body: { "name": str, "color": str, "x": float, "z": float, "milestone": int|null }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = str(request.data.get("name", "")).strip()
    if not name:
        return Response({"detail": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

    color = request.data.get("color", "#f87171")
    x = float(request.data.get("x", 0))
    z = float(request.data.get("z", 0))
    milestone_id = request.data.get("milestone", None)

    milestone = None
    if milestone_id:
        try:
            milestone = Milestone.objects.get(pk=milestone_id, project=project)
        except Milestone.DoesNotExist:
            pass

    persona = ProtoPersona.objects.create(
        project=project,
        name=name,
        color=color,
        x=x,
        z=z,
        milestone=milestone,
        created_by=request.user,
    )

    serialized = ProtoPersonaSerializer(persona)
    return Response({"persona": serialized.data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_protopersona(request, project_id, persona_id):
    """
    Update a protopersona's position, milestone link, name, or color.
    Body: any of { "name", "color", "x", "z", "milestone" }
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
        return Response({"detail": "Persona not found"}, status=status.HTTP_404_NOT_FOUND)

    if "name" in request.data:
        persona.name = str(request.data["name"]).strip() or persona.name
    if "color" in request.data:
        persona.color = request.data["color"]
    if "x" in request.data:
        persona.x = float(request.data["x"])
    if "z" in request.data:
        persona.z = float(request.data["z"])
    if "milestone" in request.data:
        mid = request.data["milestone"]
        if mid is None:
            persona.milestone = None
        else:
            try:
                persona.milestone = Milestone.objects.get(pk=mid, project=project)
            except Milestone.DoesNotExist:
                persona.milestone = None

    persona.save()
    serialized = ProtoPersonaSerializer(persona)
    return Response({"persona": serialized.data})


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
        return Response({"detail": "Persona not found"}, status=status.HTTP_404_NOT_FOUND)

    persona.delete()
    return Response({"detail": "Persona deleted"})
