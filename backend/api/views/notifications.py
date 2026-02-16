from datetime import date

from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Notification, DemoDate


# ===== NOTIFICATIONS =====

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_notifications(request):
    notifications = Notification.objects.filter(user=request.user).order_by("-created_at")
    data = [
        {
            "id": n.id,
            "action_type": n.action_type,
            "title": n.title,
            "message": n.message,
            "related_task": n.related_task_id,
            "related_attempt": n.related_attempt_id,
            "related_user": n.related_user_id,
            "read": n.read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]
    return Response({"notifications": data}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_as_read(request, notification_id):
    notification = get_object_or_404(Notification, id=notification_id, user=request.user)
    notification.read = True
    notification.save(update_fields=["read"])
    return Response({"id": notification.id, "read": True}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_as_read(request):
    Notification.objects.filter(user=request.user, read=False).update(read=True)
    return Response({"updated": True}, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_notification(request, notification_id):
    notification = get_object_or_404(Notification, id=notification_id, user=request.user)
    notification.delete()
    return Response({"deleted": True}, status=status.HTTP_200_OK)


# ===== DEMO DATE =====

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def demo_date_view(request):
    if request.method == "GET":
        return Response({"date": DemoDate.get_current_date().isoformat()}, status=status.HTTP_200_OK)

    date_str = request.data.get("date")
    if not date_str:
        return Response({"detail": "date is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({"detail": "Invalid date format"}, status=status.HTTP_400_BAD_REQUEST)

    demo = DemoDate.objects.first()
    if demo is None:
        demo = DemoDate.objects.create(date=new_date)
    else:
        demo.date = new_date
        demo.save(update_fields=["date"])

    return Response({"date": demo.date.isoformat()}, status=status.HTTP_200_OK)