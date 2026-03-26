from datetime import datetime

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from ..models import Project, Day, Milestone
from .serializers import DaySerializer
from .helpers import user_has_project_access, resolve_branch


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project_days(request, project_id):
    """
    Get all days for a project. Creates them if they don't exist.
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

    # Ensure days exist
    if project.start_date and project.end_date:
        existing_days_count = Day.objects.filter(project=project, branch=branch).count()
        expected_days_count = (project.end_date - project.start_date).days + 1

        if existing_days_count != expected_days_count:
            project.create_days()

    days = Day.objects.filter(project=project, branch=branch).order_by("day_index")
    serialized = DaySerializer(days, many=True)
    
    # Convert to dict by day_index for easier frontend access
    days_by_index = {}
    for day in serialized.data:
        days_by_index[day["day_index"]] = day

    return Response({
        "days": days_by_index,
        "days_list": serialized.data,
        "total_days": len(serialized.data)
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_day(request, project_id, day_index):
    """
    Update a specific day's properties (purpose, description, is_blocked, color).
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

    try:
        day = Day.objects.get(project=project, branch=branch, day_index=day_index)
    except Day.DoesNotExist:
        return Response({"detail": "Day not found"}, status=status.HTTP_404_NOT_FOUND)

    data = request.data

    if "purpose" in data:
        day.purpose = data["purpose"].strip() if data["purpose"] else None

    if "description" in data:
        day.description = data["description"].strip() if data["description"] else None

    if "is_blocked" in data:
        day.is_blocked = bool(data["is_blocked"])

    if "color" in data:
        day.color = data["color"] if data["color"] else None

    day.save()

    serializer = DaySerializer(day)
    return Response({"success": True, "day": serializer.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_day_purpose(request, project_id):
    """
    Quick endpoint to set or clear a day's purpose.
    Body: { "day_index": 0, "purpose": "Meeting" }
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    day_index = request.data.get("day_index")
    purpose = request.data.get("purpose")
    purpose_teams = request.data.get("purpose_teams", None)  # null = all, list of IDs = specific

    if day_index is None:
        return Response({"detail": "day_index is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        day = Day.objects.get(project=project, day_index=day_index)
    except Day.DoesNotExist:
        return Response({"detail": "Day not found"}, status=status.HTTP_404_NOT_FOUND)

    day.purpose = purpose.strip() if purpose else None
    # If purpose is cleared, also clear purpose_teams
    if not day.purpose:
        day.purpose_teams = None
    else:
        day.purpose_teams = purpose_teams  # null means all teams
    day.save()

    serializer = DaySerializer(day)
    return Response({"success": True, "day": serializer.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def validate_project_dates(request, project_id):
    """
    Validate if new project dates would cause issues with existing milestones.
    Body: { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }
    Returns validation result without making changes.
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    new_start = request.data.get("start_date")
    new_end = request.data.get("end_date")

    if not new_start or not new_end:
        return Response({"detail": "start_date and end_date are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_start_date = datetime.strptime(new_start, "%Y-%m-%d").date()
        new_end_date = datetime.strptime(new_end, "%Y-%m-%d").date()
    except ValueError:
        return Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

    if new_end_date < new_start_date:
        return Response({
            "valid": False,
            "error": "End date cannot be before start date",
            "milestones_out_of_range": []
        })

    new_days_count = (new_end_date - new_start_date).days + 1
    
    # Find milestones that would be out of range
    milestones_out_of_range = []
    all_milestones = Milestone.objects.filter(project=project)
    
    for ms in all_milestones:
        end_index = ms.start_index + ms.duration - 1
        if ms.start_index >= new_days_count or end_index >= new_days_count:
            milestones_out_of_range.append({
                'id': ms.id,
                'name': ms.name,
                'task_name': ms.task.name if ms.task else 'Unknown',
                'start_index': ms.start_index,
                'duration': ms.duration,
                'end_index': end_index,
                'required_days': end_index + 1
            })

    if milestones_out_of_range:
        return Response({
            "valid": False,
            "error": f"{len(milestones_out_of_range)} milestone(s) would be outside the new date range",
            "milestones_out_of_range": milestones_out_of_range,
            "new_days_count": new_days_count
        })

    return Response({
        "valid": True,
        "new_days_count": new_days_count,
        "milestones_out_of_range": []
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_project_days(request, project_id):
    """
    Synchronize days for a project after date changes.
    This creates missing days and removes days outside the range.
    """
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    if not project.start_date or not project.end_date:
        return Response({"detail": "Project must have start and end dates"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # Delete days outside range
        deleted_count, _ = Day.objects.filter(project=project).exclude(
            date__gte=project.start_date,
            date__lte=project.end_date
        ).delete()

        # Create/update days
        created_days = project.create_days()

    return Response({
        "success": True,
        "deleted": deleted_count,
        "total_days": len(created_days)
    })