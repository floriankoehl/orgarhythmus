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

    team_index = models.IntegerField(default=0)
    order_index = models.IntegerField(default=0)

    def __str__(self):
        return self.name
    
    class Meta: 
        ordering = ["team", "order_index"]


# ═══════════════════════════════════════════════
#  MILESTONE
# ═══════════════════════════════════════════════


class Milestone(models.Model):
    name = models.CharField(max_length=200)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=False, related_name="milestones")
    start_index = models.IntegerField(default=0)
    duration = models.IntegerField(default=1)



    
    # _____________________________ END OF NEW ADDING ______________________________
    # _____________________________ END OF NEW ADDING ______________________________
    # _____________________________ END OF NEW ADDING ______________________________





    # _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
    # _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
    # _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
    # What i changed: Added this complete new model


# ═══════════════════════════════════════════════
#  DEPENDENCY
# ═══════════════════════════════════════════════

class Dependency(models.Model):
    source = models.ForeignKey(Milestone, on_delete=models.CASCADE, 
                               related_name="outgoing_dependencies")
    target = models.ForeignKey(Milestone, on_delete=models.CASCADE,
                               related_name="incoming_dependencies")


    
    # _____________________________ END OF NEW ADDING ______________________________
    # _____________________________ END OF NEW ADDING ______________________________
    # _____________________________ END OF NEW ADDING ______________________________




















































# ═══════════════════════════════════════════════
#  ATTEMPT
# ═══════════════════════════════════════════════

class Attempt(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attempts')
    name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True, default='')
    number = models.IntegerField(blank=True, null=True)
    slot_index = models.IntegerField(blank=True, null=True)
    done = models.BooleanField(default=False)

    class Meta:
        unique_together = ('task', 'number')

    def __str__(self):
        if self.name:
            return self.name
        return f"Attempt {self.id}"

    @property
    def calculated_date(self):
        start = getattr(self.task.project, 'start_date', None) if self.task and self.task.project else None
        if start is None or self.slot_index is None:
            return None
        return start + timedelta(days=self.slot_index)


# ═══════════════════════════════════════════════
#  ATTEMPT TODO
# ═══════════════════════════════════════════════

class AttemptTodo(models.Model):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='todos')
    text = models.CharField(max_length=500)
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text


# ═══════════════════════════════════════════════
#  ATTEMPT DEPENDENCY
# ═══════════════════════════════════════════════

class AttemptDependency(models.Model):
    vortakt_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='nachtakt_attempts')
    nachtakt_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='vortakt_attempts')
    type = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return f"{self.vortakt_attempt.name} -> {self.nachtakt_attempt.name}"

    class Meta:
        unique_together = ('vortakt_attempt', 'nachtakt_attempt')


# ═══════════════════════════════════════════════
#  NOTIFICATION
# ═══════════════════════════════════════════════

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('task_assigned', 'Task Assigned'),
        ('task_unassigned', 'Task Unassigned'),
        ('team_joined', 'Team Joined'),
        ('team_left', 'Team Left'),
        ('attempt_upcoming', 'Attempt Upcoming'),
        ('attempt_today', 'Attempt Today'),
        ('attempt_overdue', 'Attempt Overdue'),
        ('general', 'General Notification'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    action_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='general')
    title = models.CharField(max_length=200)
    message = models.TextField()
    related_task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    related_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
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
        """Get the current demo date (or actual date if no demo date set)"""
        try:
            demo = cls.objects.first()
            return demo.date if demo else date_class.today()
        except:
            return date_class.today()


# ═══════════════════════════════════════════════
#  CATEGORY
# ═══════════════════════════════════════════════

class Category(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="categories", null=True, blank=True)
    name = models.CharField(max_length=200)
    x = models.IntegerField(default=0)
    y = models.IntegerField(default=0)
    width = models.IntegerField(default=100)
    height = models.IntegerField(default=100)
    z_index = models.IntegerField(default=0)
    archived = models.BooleanField(default=False)


# ═══════════════════════════════════════════════
#  LEGEND TYPE
# ═══════════════════════════════════════════════

class LegendType(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="legend_types", null=True, blank=True)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default="#ffffff")
    order_index = models.IntegerField(default=0)

    class Meta:
        ordering = ["order_index"]


# ═══════════════════════════════════════════════
#  IDEA
# ═══════════════════════════════════════════════

class Idea(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="ideas", null=True, blank=True)
    title = models.CharField(max_length=500)
    headline = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField()
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    order_index = models.IntegerField(default=0)
    legend_type = models.ForeignKey(LegendType, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["order_index"]
















