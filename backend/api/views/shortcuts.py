from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import UserShortcuts


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_shortcuts(request):
    """Get the current user's custom keyboard shortcuts."""
    obj, _ = UserShortcuts.objects.get_or_create(user=request.user)
    return Response({"shortcuts": obj.shortcuts})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def save_user_shortcuts(request):
    """
    Save/update the current user's keyboard shortcuts.
    Body: { "shortcuts": { "actionKey": "letter", ... } }
    """
    shortcuts = request.data.get("shortcuts", {})
    if not isinstance(shortcuts, dict):
        return Response({"detail": "shortcuts must be a dict"}, status=status.HTTP_400_BAD_REQUEST)

    obj, _ = UserShortcuts.objects.get_or_create(user=request.user)
    obj.shortcuts = shortcuts
    obj.save()
    return Response({"shortcuts": obj.shortcuts})
