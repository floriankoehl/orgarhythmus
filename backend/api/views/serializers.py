from datetime import timedelta

from rest_framework import serializers

from ..models import (
    Project,
    Team,
    Task,
    AcceptanceCriterion,
    Milestone,
    MilestoneTodo,
    Dependency,
    Idea,
    IdeaPlacement,
    IdeaLegendType,
    Category,
    LegendType,
    Day,
    Phase,
    DependencyView,
    ProtoPersona,
    Legend,
    Context,
    CategoryContextPlacement,
    TaskLegend,
    TaskLegendType,
    TaskLegendAssignment,
)


# AcceptanceCriterionSerializer
class AcceptanceCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcceptanceCriterion
        fields = ["id", "title", "description", "done", "order"]
        read_only_fields = ["id"]


# MilestoneTodoSerializer
class MilestoneTodoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MilestoneTodo
        fields = ["id", "title", "description", "done", "order"]


# MilestoneSerializer_Deps
class MilestoneSerializer_Deps(serializers.ModelSerializer):
    todos = MilestoneTodoSerializer(many=True, read_only=True)
    is_done = serializers.SerializerMethodField()
    is_done_effective = serializers.SerializerMethodField()

    class Meta:
        model = Milestone
        fields = ["id", "name", "description", "project", "task", "start_index", "duration", "todos", "is_done", "is_done_effective"]

    def get_is_done(self, obj):
        todos = obj.todos.all()
        return todos.exists() and all(t.done for t in todos)

    def get_is_done_effective(self, obj):
        # Own TODOs done?
        todos = obj.todos.all()
        own_done = todos.exists() and all(t.done for t in todos)
        if own_done:
            return True
        # Parent task done? (all acceptance criteria done)
        task = obj.task
        if task:
            criteria = task.acceptance_criteria.all()
            if criteria.exists() and all(c.done for c in criteria):
                return True
        return False


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
    acceptance_criteria = AcceptanceCriterionSerializer(many=True, read_only=True)
    is_done = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "name",
            "description",
            "difficulty",
            "priority",
            "needs_approval",
            "team",
            "is_done",
            "acceptance_criteria",
        ]

    def get_is_done(self, obj):
        criteria = obj.acceptance_criteria.all()
        return criteria.exists() and all(c.done for c in criteria)


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
    acceptance_criteria = AcceptanceCriterionSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer_Deps(many=True, read_only=True)
    is_done = serializers.SerializerMethodField()
    legend_types = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "name",
            "description",
            "difficulty",
            "priority",
            "needs_approval",
            "team",
            "is_done",
            "acceptance_criteria",
            "milestones",
            "order_index",
            "legend_types",
        ]

    def get_is_done(self, obj):
        criteria = obj.acceptance_criteria.all()
        return criteria.exists() and all(c.done for c in criteria)

    def get_legend_types(self, obj):
        result = {}
        for a in obj.legend_assignments.select_related('legend', 'legend_type').all():
            result[str(a.legend_id)] = {
                "legend_type_id": a.legend_type_id,
                "name": a.legend_type.name,
                "color": a.legend_type.color,
                "icon": a.legend_type.icon,
            }
        return result


# TaskExpandedSerializer
class TaskExpandedSerializer(serializers.ModelSerializer):
    team = BasicTeamSerializer(read_only=True)
    project_id = serializers.IntegerField(source='project.id', read_only=True)
    assigned_members_data = serializers.SerializerMethodField()
    acceptance_criteria = AcceptanceCriterionSerializer(many=True, read_only=True)
    is_done = serializers.SerializerMethodField()
    legend_types = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id',
            'name',
            'description',
            'priority',
            'difficulty',
            'needs_approval',
            'team',
            'is_done',
            'project_id',
            'assigned_members',
            'assigned_members_data',
            'acceptance_criteria',
            'legend_types',
        ]

    def get_assigned_members_data(self, obj):
        return [{"id": u.id, "username": u.username, "email": u.email} for u in obj.assigned_members.all()]

    def get_legend_types(self, obj):
        result = {}
        for a in obj.legend_assignments.select_related('legend', 'legend_type').all():
            result[str(a.legend_id)] = {
                "legend_type_id": a.legend_type_id,
                "name": a.legend_type.name,
                "color": a.legend_type.color,
                "icon": a.legend_type.icon,
            }
        return result

    def get_is_done(self, obj):
        criteria = obj.acceptance_criteria.all()
        return criteria.exists() and all(c.done for c in criteria)


# IdeaSerializer
class IdeaSerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField()
    placement_count = serializers.SerializerMethodField()
    placement_categories = serializers.SerializerMethodField()
    legend_types = serializers.SerializerMethodField()
    upvote_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    user_has_upvoted = serializers.SerializerMethodField()

    class Meta:
        model = Idea
        fields = [
            "id", "title", "description",
            "owner", "owner_username",
            "created_at", "archived", "placement_count", "placement_categories",
            "legend_types",
            "upvote_count", "comment_count", "user_has_upvoted",
        ]

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_placement_count(self, obj):
        return obj.placements.count()

    def get_placement_categories(self, obj):
        """Return list of {id, name} dicts for categories where this idea is placed."""
        cats = []
        for p in obj.placements.select_related('category').all():
            cats.append({
                "id": p.category.id if p.category else None,
                "name": p.category.name if p.category else "Unassigned",
                "placement_id": p.id,
            })
        return cats

    def get_legend_types(self, obj):
        """Return {legend_id: {legend_type_id, name, color, icon}} for every assigned legend."""
        result = {}
        for dt in obj.legend_types.select_related('legend', 'legend_type').all():
            result[str(dt.legend_id)] = {
                "legend_type_id": dt.legend_type_id,
                "name": dt.legend_type.name,
                "color": dt.legend_type.color,
                "icon": dt.legend_type.icon,
            }
        return result

    def get_upvote_count(self, obj):
        return obj.upvotes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_user_has_upvoted(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.upvotes.filter(user=request.user).exists()
        return False


class IdeaPlacementSerializer(serializers.ModelSerializer):
    """Serialises a placement with the full idea data nested."""
    idea = IdeaSerializer(read_only=True)

    class Meta:
        model = IdeaPlacement
        fields = ["id", "idea", "category", "order_index"]


# CategorySerializer
class CategorySerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField()
    owner_id = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "x", "y", "width", "height", "z_index", "archived", "is_public", "owner_username", "owner_id", "filter_config"]

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_owner_id(self, obj):
        return obj.owner.id if obj.owner else None


# LegendTypeSerializer
class LegendTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegendType
        fields = "__all__"


# LegendSerializer
class LegendSerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField()

    class Meta:
        model = Legend
        fields = ['id', 'name', 'owner', 'owner_username', 'created_at']

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None


# TaskLegendTypeSerializer
class TaskLegendTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskLegendType
        fields = "__all__"


# TaskLegendSerializer
class TaskLegendSerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField()

    class Meta:
        model = TaskLegend
        fields = ['id', 'name', 'project', 'owner', 'owner_username', 'created_at']

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None


# ContextSerializer
class ContextSerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField()
    owner_id = serializers.SerializerMethodField()

    class Meta:
        model = Context
        fields = ["id", "name", "x", "y", "width", "height", "z_index", "is_public", "color", "filter_state", "owner_id", "owner_username"]

    def get_owner_username(self, obj):
        return obj.owner.username if obj.owner else None

    def get_owner_id(self, obj):
        return obj.owner_id


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


class TaskSerializer_Deps(serializers.ModelSerializer):
    milestones = MilestoneSerializer_Deps(many=True, read_only=True)
    acceptance_criteria = AcceptanceCriterionSerializer(many=True, read_only=True)
    is_done = serializers.SerializerMethodField()
    legend_types = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = "__all__"

    def get_is_done(self, obj):
        criteria = obj.acceptance_criteria.all()
        return criteria.exists() and all(c.done for c in criteria)

    def get_legend_types(self, obj):
        result = {}
        for a in obj.legend_assignments.select_related('legend', 'legend_type').all():
            result[str(a.legend_id)] = {
                "legend_type_id": a.legend_type_id,
                "name": a.legend_type.name,
                "color": a.legend_type.color,
                "icon": a.legend_type.icon,
            }
        return result


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
        fields = ["id", "project", "name", "state", "is_default", "created_by", "created_by_name", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "created_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.username
        return None


# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________
# _____________________________ END OF NEW ADDING ______________________________


# ProtoPersonaSerializer
class ProtoPersonaSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    milestones = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    teams = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    tasks = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = ProtoPersona
        fields = ["id", "name", "color", "x", "z", "milestones", "teams", "tasks", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_at", "created_by"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.username
        return None






























