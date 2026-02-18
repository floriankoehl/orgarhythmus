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
    Day,
    Phase,
    DependencyView,
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
            'assigned_members',
            'assigned_members_data',
        ]

    def get_assigned_members_data(self, obj):
        return [{"id": u.id, "username": u.username, "email": u.email} for u in obj.assigned_members.all()]


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


# DaySerializer
class DaySerializer(serializers.ModelSerializer):
    is_weekend = serializers.BooleanField(read_only=True)
    is_sunday = serializers.BooleanField(read_only=True)
    day_name = serializers.CharField(read_only=True)
    day_name_short = serializers.CharField(read_only=True)

    class Meta:
        model = Day
        fields = [
            "id",
            "project",
            "date",
            "day_index",
            "purpose",
            "purpose_teams",
            "description",
            "is_blocked",
            "color",
            "is_weekend",
            "is_sunday",
            "day_name",
            "day_name_short",
        ]
        read_only_fields = ["id", "project", "date", "day_index", "is_weekend", "is_sunday", "day_name", "day_name_short"]


# PhaseSerializer
class PhaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Phase
        fields = ["id", "project", "team", "name", "start_index", "duration", "color", "order_index"]
        read_only_fields = ["id", "project"]


# DependencyViewSerializer
class DependencyViewSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DependencyView
        fields = ["id", "project", "name", "state", "created_by", "created_by_name", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "created_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.username
        return None


# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________






























