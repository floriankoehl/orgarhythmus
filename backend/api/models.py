from gc import set_debug

from django.db import models
from django.db.models import SET_NULL
from django.conf import settings
from django.contrib.auth import get_user_model
from datetime import date as date_class, timedelta
User = get_user_model()


# ═══════════════════════════════════════════════
#  PROJECT
# ═══════════════════════════════════════════════

class Project(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects_owned")
    members = models.ManyToManyField(User, related_name="projects", blank=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def get_days_count(self):
        """Return number of days in project timespan"""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0

    def create_days(self):
        """Create Day objects for this project based on start and end dates"""
        if not self.start_date or not self.end_date:
            return []
        
        created_days = []
        current_date = self.start_date
        index = 0
        
        while current_date <= self.end_date:
            day, created = Day.objects.get_or_create(
                project=self,
                date=current_date,
                defaults={'day_index': index}
            )
            if not created:
                day.day_index = index
                day.save(update_fields=['day_index'])
            created_days.append(day)
            current_date += timedelta(days=1)
            index += 1
        
        return created_days

    def update_days_on_date_change(self, old_start, old_end, new_start, new_end):
        """
        Update days when project dates change.
        Returns dict with 'success', 'error', 'created', 'deleted' info.
        """
        from django.db.models import Max
        
        result = {
            'success': True,
            'error': None,
            'created': 0,
            'deleted': 0,
            'milestones_out_of_range': []
        }
        
        # Check if any milestones would be out of range
        if new_end and new_start:
            new_days_count = (new_end - new_start).days + 1
            
            # Find milestones that would exceed the new range
            out_of_range_milestones = Milestone.objects.filter(
                project=self
            ).filter(
                models.Q(start_index__gte=new_days_count) |
                models.Q(start_index__lt=0)
            )
            
            # Also check milestones where start_index + duration exceeds range
            all_milestones = Milestone.objects.filter(project=self)
            for ms in all_milestones:
                if ms.start_index + ms.duration > new_days_count:
                    result['milestones_out_of_range'].append({
                        'id': ms.id,
                        'name': ms.name,
                        'start_index': ms.start_index,
                        'duration': ms.duration,
                        'end_index': ms.start_index + ms.duration - 1
                    })
            
            for ms in out_of_range_milestones:
                if ms.id not in [m['id'] for m in result['milestones_out_of_range']]:
                    result['milestones_out_of_range'].append({
                        'id': ms.id,
                        'name': ms.name,
                        'start_index': ms.start_index,
                        'duration': ms.duration,
                        'end_index': ms.start_index + ms.duration - 1
                    })
        
        if result['milestones_out_of_range']:
            result['success'] = False
            result['error'] = 'Some milestones would be outside the new date range'
            return result
        
        # Delete days outside new range
        if new_start and new_end:
            deleted_count, _ = Day.objects.filter(project=self).exclude(
                date__gte=new_start,
                date__lte=new_end
            ).delete()
            result['deleted'] = deleted_count
            
            # Create/update days for new range
            created_days = self.create_days()
            result['created'] = len([d for d in created_days if d])
        
        return result


# ═══════════════════════════════════════════════
#  TEAM
# ═══════════════════════════════════════════════

class Team(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    color = models.CharField(max_length=200, blank=True, null=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="teams")
    line_index = models.IntegerField(blank=True, null=True)
    order_index = models.IntegerField(default=0)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="teams", blank=True)

    def __str__(self):
        return self.name

    class Meta: 
        ordering = ["project", "order_index"]


# ═══════════════════════════════════════════════
#  TASK
# ═══════════════════════════════════════════════

class Task(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    difficulty = models.CharField(max_length=200, blank=True, null=True)
    priority = models.CharField(max_length=200, blank=True, null=True)
    asking = models.CharField(max_length=200, blank=True, null=True)
    team = models.ForeignKey(Team, on_delete=SET_NULL, null=True, blank=True, related_name="tasks")
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="tasks",
        default=1, null=True, blank=True,
    )
    assigned_members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="assigned_tasks", blank=True)

    hard_deadline = models.IntegerField(blank=True, null=True)  # day index deadline (0-based)

    team_index = models.IntegerField(default=0)
    order_index = models.IntegerField(default=0)

    def __str__(self):
        return self.name
    
    class Meta: 
        ordering = ["team", "order_index"]


# ═══════════════════════════════════════════════
#  DAY
# ═══════════════════════════════════════════════

class Day(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="days")
    date = models.DateField()
    day_index = models.IntegerField(default=0)  # 0-based index from project start
    purpose = models.CharField(max_length=200, blank=True, null=True)
    purpose_teams = models.JSONField(blank=True, null=True, default=None)  # null = all teams, list of team IDs = specific teams
    description = models.TextField(blank=True, null=True)
    is_blocked = models.BooleanField(default=False)  # e.g., holiday, no work day
    color = models.CharField(max_length=20, blank=True, null=True)  # custom highlight color

    class Meta:
        ordering = ["project", "day_index"]
        unique_together = ["project", "date"]

    def __str__(self):
        return f"{self.project.name} - Day {self.day_index} ({self.date})"

    @property
    def is_weekend(self):
        """Check if this day is a weekend (Saturday=5, Sunday=6)"""
        return self.date.weekday() >= 5

    @property
    def is_sunday(self):
        """Check if this day is Sunday"""
        return self.date.weekday() == 6

    @property
    def day_name(self):
        """Return abbreviated day name"""
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        return days[self.date.weekday()]

    @property
    def day_name_short(self):
        """Return 2-letter day abbreviation"""
        days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
        return days[self.date.weekday()]


# ═══════════════════════════════════════════════
#  MILESTONE
# ═══════════════════════════════════════════════

class Milestone(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=False, related_name="milestones")
    start_index = models.IntegerField(default=0)
    duration = models.IntegerField(default=1)


# ═══════════════════════════════════════════════
#  DEPENDENCY
# ═══════════════════════════════════════════════

class Dependency(models.Model):
    WEIGHT_CHOICES = [
        ('strong', 'Strong'),
        ('weak', 'Weak'),
        ('suggestion', 'Suggestion'),
    ]

    source = models.ForeignKey(Milestone, on_delete=models.CASCADE, 
                               related_name="outgoing_dependencies")
    target = models.ForeignKey(Milestone, on_delete=models.CASCADE,
                               related_name="incoming_dependencies")
    weight = models.CharField(max_length=20, choices=WEIGHT_CHOICES, default='strong')
    reason = models.TextField(blank=True, null=True)


# ═══════════════════════════════════════════════
#  PHASE (named timeframe spans across the timeline)
# ═══════════════════════════════════════════════

class Phase(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="phases")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="phases", null=True, blank=True)  # null = all teams
    name = models.CharField(max_length=200)
    start_index = models.IntegerField(default=0)      # 0-based day index
    duration = models.IntegerField(default=1)          # number of days
    color = models.CharField(max_length=20, default='#3b82f6')  # hex color
    order_index = models.IntegerField(default=0)       # stacking / display order

    class Meta:
        ordering = ["project", "order_index", "start_index"]

    def __str__(self):
        return f"{self.project.name} - Phase: {self.name} (day {self.start_index}–{self.start_index + self.duration - 1})"

    @property
    def end_index(self):
        return self.start_index + self.duration - 1

    def overlaps(self, other):
        """Check if this phase overlaps with another phase's day range."""
        return self.start_index < other.start_index + other.duration and other.start_index < self.start_index + self.duration


# ═══════════════════════════════════════════════
#  NOTIFICATION
# ═══════════════════════════════════════════════

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('task_assigned', 'Task Assigned'),
        ('task_unassigned', 'Task Unassigned'),
        ('team_joined', 'Team Joined'),
        ('team_left', 'Team Left'),
        ('general', 'General Notification'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    action_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='general')
    title = models.CharField(max_length=200)
    message = models.TextField()
    related_task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    related_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications_about")
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.user.username}"


# ═══════════════════════════════════════════════
#  DEMO DATE
# ═══════════════════════════════════════════════

class DemoDate(models.Model):
    date = models.DateField(default=date_class.today)

    class Meta:
        verbose_name_plural = "Demo Date"

    def __str__(self):
        return f"Demo Date: {self.date}"

    @classmethod
    def get_current_date(cls):
        try:
            demo = cls.objects.first()
            return demo.date if demo else date_class.today()
        except:
            return date_class.today()


# ═══════════════════════════════════════════════
#  LEGEND
# ═══════════════════════════════════════════════

class Legend(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="legends")
    name = models.CharField(max_length=200, default="General")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} ({self.owner.username})"


# ═══════════════════════════════════════════════
#  CATEGORY
# ═══════════════════════════════════════════════

class Category(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_categories", null=True, blank=True)
    name = models.CharField(max_length=200)
    x = models.IntegerField(default=0)
    y = models.IntegerField(default=0)
    width = models.IntegerField(default=100)
    height = models.IntegerField(default=100)
    z_index = models.IntegerField(default=0)
    archived = models.BooleanField(default=False)
    is_public = models.BooleanField(default=False)
    filter_config = models.JSONField(null=True, blank=True, default=None)


# ═══════════════════════════════════════════════
#  LEGEND TYPE
# ═══════════════════════════════════════════════

class LegendType(models.Model):
    legend = models.ForeignKey('Legend', on_delete=models.CASCADE, related_name="types", null=True, blank=True)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default="#ffffff")
    icon = models.CharField(max_length=50, null=True, blank=True)  # MUI icon name e.g. "Star", "Lightbulb"
    order_index = models.IntegerField(default=0)

    class Meta:
        ordering = ["order_index"]


# ═══════════════════════════════════════════════
#  ADOPTION MODELS
# ═══════════════════════════════════════════════

class UserCategoryAdoption(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="adopted_categories")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="adopters")
    adopted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "category"]


class UserLegendAdoption(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="adopted_legends")
    legend = models.ForeignKey(Legend, on_delete=models.CASCADE, related_name="adopters")
    adopted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "legend"]


# ═══════════════════════════════════════════════
#  CONTEXT  (classification for categories)
# ═══════════════════════════════════════════════

class Context(models.Model):
    """
    A named container that groups categories.
    Works like categories group ideas — contexts group categories.
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_contexts")
    name = models.CharField(max_length=200)
    x = models.IntegerField(default=0)
    y = models.IntegerField(default=0)
    width = models.IntegerField(default=200)
    height = models.IntegerField(default=200)
    z_index = models.IntegerField(default=0)
    is_public = models.BooleanField(default=False)
    color = models.CharField(max_length=20, null=True, blank=True)  # e.g. "#f59e0b"
    filter_state = models.JSONField(null=True, blank=True, default=None)  # {legend_filters: [...], filter_combine_mode: "and"|"or"}
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} ({self.owner.username})"


class UserContextAdoption(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="adopted_contexts")
    context = models.ForeignKey(Context, on_delete=models.CASCADE, related_name="adopters")
    adopted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "context"]


class CategoryContextPlacement(models.Model):
    """
    Links a Category to a Context.
    Each category can be placed in multiple contexts.
    """
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="context_placements")
    context = models.ForeignKey(Context, on_delete=models.CASCADE, related_name="category_placements")
    order_index = models.IntegerField(default=0)

    class Meta:
        ordering = ["order_index"]
        unique_together = ["category", "context"]

    def __str__(self):
        return f"{self.category.name} → {self.context.name}"


class LegendContextPlacement(models.Model):
    """
    Links a Legend to a Context.
    Each legend can be placed in multiple contexts.
    """
    legend = models.ForeignKey(Legend, on_delete=models.CASCADE, related_name="context_placements")
    context = models.ForeignKey(Context, on_delete=models.CASCADE, related_name="legend_placements")
    order_index = models.IntegerField(default=0)

    class Meta:
        ordering = ["order_index"]
        unique_together = ["legend", "context"]

    def __str__(self):
        return f"{self.legend.name} → {self.context.name}"


# ═══════════════════════════════════════════════
#  DEPENDENCY VIEW (saved frontend state)
# ═══════════════════════════════════════════════

class DependencyView(models.Model):
    """
    A named, saveable representation of the frontend dependency-page state.
    Each project can have multiple views; all members can access them.
    The 'state' JSON blob stores every frontend-only display preference.
    """
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="dependency_views")
    name = models.CharField(max_length=200)
    state = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_views")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        unique_together = [("project", "name")]

    def __str__(self):
        return f"{self.name} ({self.project.name})"


# ═══════════════════════════════════════════════
#  PROJECT SNAPSHOT (full project state backup)
# ═══════════════════════════════════════════════

class ProjectSnapshot(models.Model):
    """
    A complete snapshot of all project data at a point in time.
    Stores teams, tasks, milestones, dependencies, days, phases, and views
    as a single JSON blob so the entire state can be restored.
    """
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="snapshots")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    data = models.JSONField(default=dict)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_snapshots")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Snapshot: {self.name} ({self.project.name})"


# ═══════════════════════════════════════════════
#  USER SHORTCUTS (per-user keyboard shortcut mapping)
# ═══════════════════════════════════════════════

class UserShortcuts(models.Model):
    """
    Stores a user's custom keyboard shortcuts as a JSON dict.
    Each key is an action identifier, value is the single letter key.
    All shortcuts use the Q+W chord prefix automatically.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="shortcuts")
    shortcuts = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "User shortcuts"

    def __str__(self):
        return f"Shortcuts for {self.user.username}"


# ═══════════════════════════════════════════════
#  IDEA  (meta container – the "original" idea)
# ═══════════════════════════════════════════════

class Idea(models.Model):
    """
    The canonical idea.  All editable content lives here.
    IdeaPlacements are lightweight copies that sit inside categories.
    Deleting the Idea cascade-deletes every placement.
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_ideas", null=True, blank=True)
    title = models.CharField(max_length=500)
    headline = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


# ═══════════════════════════════════════════════
#  IDEA PLACEMENT  (a "copy" living in a category)
# ═══════════════════════════════════════════════

class IdeaPlacement(models.Model):
    """
    A lightweight reference that places an Idea inside a Category.
    Each placement belongs to exactly one category (or none = unassigned).
    Multiple placements can point to the same Idea.
    """
    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="placements")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    order_index = models.IntegerField(default=0)

    class Meta:
        ordering = ["order_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["idea", "category"],
                condition=models.Q(category__isnull=False),
                name="unique_idea_per_category",
            ),
        ]

    def __str__(self):
        cat = self.category.name if self.category else "Unassigned"
        return f"{self.idea.title} → {cat}"


# ═══════════════════════════════════════════════
#  IDEA ↔ LEGEND TYPE  (one type per legend per idea)
# ═══════════════════════════════════════════════

class IdeaLegendType(models.Model):
    """
    Links an Idea to a LegendType within a specific Legend.
    Each idea can have at most one type per legend.
    """
    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="legend_types")
    legend = models.ForeignKey(Legend, on_delete=models.CASCADE, related_name="idea_type_assignments")
    legend_type = models.ForeignKey(LegendType, on_delete=models.CASCADE, related_name="idea_assignments")

    class Meta:
        unique_together = ["idea", "legend"]

    def __str__(self):
        return f"{self.idea.title} → {self.legend.name}: {self.legend_type.name}"


# ═══════════════════════════════════════════════
#  IDEA UPVOTE  (one per user per idea)
# ═══════════════════════════════════════════════

class IdeaUpvote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="idea_upvotes")
    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="upvotes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "idea"]

    def __str__(self):
        return f"{self.user.username} ▲ {self.idea.title}"


# ═══════════════════════════════════════════════
#  IDEA COMMENT
# ═══════════════════════════════════════════════

class IdeaComment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="idea_comments")
    idea = models.ForeignKey(Idea, on_delete=models.CASCADE, related_name="comments")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user.username}: {self.text[:50]}"


# ═══════════════════════════════════════════════
#  PROTO-PERSONA
# ═══════════════════════════════════════════════

class ProtoPersona(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="protopersonas")
    name = models.CharField(max_length=200)
    color = models.CharField(max_length=20, default="#f87171")
    x = models.FloatField(default=0)
    z = models.FloatField(default=0)
    milestones = models.ManyToManyField(
        Milestone, blank=True, related_name="protopersonas"
    )
    teams = models.ManyToManyField(
        Team, blank=True, related_name="protopersonas"
    )
    tasks = models.ManyToManyField(
        Task, blank=True, related_name="protopersonas"
    )
    created_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="created_protopersonas"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} ({self.project.name})"


# ═══════════════════════════════════════════════
#  FORMATION  (saved IdeaBin visual state)
# ═══════════════════════════════════════════════

class Formation(models.Model):
    """
    Stores a complete snapshot of the IdeaBin visual layout for a user.
    All layout data lives in the JSON `state` field so new settings can
    be added without migrations.

    Current state schema (v1):
    {
      "version": 1,

      # window
      "window_pos": {"x": 0, "y": 0},
      "window_size": {"w": 1920, "h": 1080},
      "is_maximized": true,

      # view
      "view_mode": "ideas" | "contexts",

      # sidebar
      "sidebar_width": 240,
      "sidebar_headline_only": false,
      "show_sidebar_meta": false,
      "list_filter": "all" | "unassigned" | <category_id>,
      "show_archive": false,

      # legend
      "active_legend_id": null | <id>,
      "legend_panel_collapsed": true,
      "global_type_filter": [],

      # categories (canvas positions + collapse)
      "minimized_categories": {"<catId>": true, ...},
      "collapsed_ideas": {"<placementId>": true, ...},
      "selected_category_id": null | <id>,
      "show_meta_list": false,

      # context view
      "context_sidebar_mode": "categories" | "legends",
      "minimized_contexts": {"<ctxId>": true, ...},

      # category canvas positions (snapshot)
      "category_positions": {
        "<catId>": {"x": 0, "y": 0, "width": 200, "height": 300, "z_index": 0},
        ...
      },

      # context canvas positions
      "context_positions": {
        "<ctxId>": {"x": 0, "y": 0, "width": 200, "height": 300, "z_index": 0},
        ...
      },
    }
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="formations")
    name = models.CharField(max_length=200)
    state = models.JSONField(default=dict)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.owner.username} — {self.name}"
















