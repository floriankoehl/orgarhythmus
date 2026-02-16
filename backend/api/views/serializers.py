from datetime import timedelta

from rest_framework import serializers

from ..models import (
    Project,
    Team,
    Task,
    Milestone,
    Dependency,
    Idea,
    Category,
    LegendType,

)


# ProjectSerializer
class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    members_data = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "description", "created_at", "owner", "owner_username", "members_data", "start_date", "end_date"]
        read_only_fields = ["id", "created_at", "owner", "owner_username", "members_data"]

    def get_members_data(self, obj):
        """Return list of member usernames"""
        return [{"id": member.id, "username": member.username} for member in obj.members.all()]


# TaskSerializer
class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "name",
            "description",
            "difficulty",
            "priority",
            "asking",
            "team",
        ]


# TeamExpandedSerializer
class TeamExpandedSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(many=True, read_only=True)
    members_data = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "color",
            "line_index",
            "tasks",
            "members_data",
        ]

    def get_members_data(self, obj):
        return [{"id": u.id, "username": u.username, "email": u.email} for u in obj.members.all()]


# BasicTeamSerializer
class BasicTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "color",
            "project",
        ]
        read_only_fields = ["id", "project"]


# TaskSerializer_TeamView
class TaskSerializer_TeamView(serializers.ModelSerializer):
    team = BasicTeamSerializer(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "name",
            "description",
            "difficulty",
            "priority",
            "asking",
            "team",
        ]


# TaskExpandedSerializer
class TaskExpandedSerializer(serializers.ModelSerializer):
    team = BasicTeamSerializer(read_only=True)
    project_id = serializers.IntegerField(source='project.id', read_only=True)
    attempts = serializers.SerializerMethodField()
    assigned_members_data = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id',
            'name',
            'description',
            'priority',
            'difficulty',
            'team',
            'project_id',
            'attempts',
            'assigned_members',
            'assigned_members_data',
        ]

    def get_assigned_members_data(self, obj):
        return [{"id": u.id, "username": u.username, "email": u.email} for u in obj.assigned_members.all()]

    def get_attempts(self, obj):
        attempts_qs = getattr(obj, "attempts", None)
        if attempts_qs is None:
            return []

        ordered = attempts_qs.all().order_by('slot_index', 'id').prefetch_related('todos')
        start_date = getattr(getattr(obj, 'project', None), 'start_date', None)
        return [
            {
                "id": a.id,
                "name": getattr(a, "name", None),
                "description": getattr(a, "description", None),
                "number": getattr(a, "number", None),
                "slot_index": getattr(a, "slot_index", None),
                "done": getattr(a, "done", False),
                "scheduled_date": (
                    (
                        (start_date + timedelta(days=(a.slot_index - 1))).isoformat()
                    ) if (start_date and (a.slot_index is not None)) else None
                ),
                "todos": [
                    {
                        "id": t.id,
                        "text": t.text,
                        "done": t.done,
                        "created_at": t.created_at,
                    }
                    for t in (a.todos.all().order_by('-created_at') if hasattr(a, 'todos') else [])
                ],
            }
            for a in ordered
        ]


# IdeaSerializer
class IdeaSerializer(serializers.ModelSerializer):
    legend_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LegendType.objects.all(),
        source='legend_type',
        allow_null=True,
        required=False
    )

    class Meta:
        model = Idea
        fields = ["id", "title", "headline", "description", "category", "order_index", "legend_type_id"]


# CategorySerializer
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "x", "y", "width", "height", "z_index", "archived"]


# LegendTypeSerializer
class LegendTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegendType
        fields = "__all__"








# _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
# _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
# _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
# What i changed: Added this complete new model


class ProjectSerializer_Deps(serializers.ModelSerializer):
    class Meta: 
        model = Project
        fields = "__all__"


class TeamSerializer_Deps(serializers.ModelSerializer):
    class Meta: 
        model = Team
        fields = "__all__"


class MilestoneSerializer_Deps(serializers.ModelSerializer):
    class Meta: 
        model = Milestone
        fields = "__all__"


class TaskSerializer_Deps(serializers.ModelSerializer):
    milestones = MilestoneSerializer_Deps(many=True, read_only=True)

    class Meta:
        model = Task
        fields = "__all__"


class DependencySerializer_Deps(serializers.ModelSerializer):
    class Meta:
        model = Dependency
        fields = "__all__"


# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________






























