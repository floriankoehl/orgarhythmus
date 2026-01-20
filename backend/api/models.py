from gc import set_debug

from django.db import models
from django.contrib.auth.models import User
from django.db.models import SET_NULL
from django.conf import settings
from django.contrib.auth import get_user_model
from datetime import date as date_class, timedelta
User = get_user_model()

class Comment(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE)  # ← Besser!
    text = models.CharField(max_length=2000, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

#________________________________________________________________________________________________________________________________
#________________________________________________________________________________________________________________________________
#________________________________________________________________________________________________________________________________
#________________________________________________________ORGARHYTHMUS_____________________________________________________________
#________________________________________________________________________________________________________________________________
#________________________________________________________________________________________________________________________________
#________________________________________________________________________________________________________________________________

#_________________________________________
#________________PROJECT__________________
#_________________________________________

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


class Team(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    color = models.CharField(max_length=200, blank=True, null=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="teams")
    line_index = models.IntegerField(blank=True, null=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="teams", blank=True)

    def __str__(self):
        return self.name


class Task(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    difficulty = models.CharField(max_length=200, blank=True, null=True)
    priority = models.CharField(max_length=200, blank=True, null=True)
    asking = models.CharField(max_length=200, blank=True, null=True)
    team = models.ForeignKey(Team, on_delete=SET_NULL, null=True, blank=True, related_name="tasks")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks", default=1, null=True,
        blank=True, )
    assigned_members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="assigned_tasks", blank=True)
    


    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            for i in range(3):
                name = f"{self.name}_{i}"
                Attempt.objects.create(task=self, name=name, number=i+1, slot_index=i)



    def __str__(self):
        return self.name


class Dependency(models.Model):
    vortakt = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='nachtakte')  # parent -> children
    nachtakt = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='vortakte')  # child -> parents
    type = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return f"{self.vortakt} -> {self.nachtakt} ({self.type})"

    class Meta:
        unique_together = ('vortakt', 'nachtakt')


class Attempt(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attempts')
    name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True, default='')
    number = models.IntegerField(blank=True, null=True)
    slot_index = models.IntegerField(blank=True, null=True)
    done = models.BooleanField(default=False)  # NEW

    class Meta:
        unique_together = ('task', 'number')
        ordering = ['number']

    def __str__(self):
        return self.name or f"Attempt {self.id}"
    
    @property
    def calculated_date(self):
        """
        Calculate the date for this attempt based on the project's start_date and this attempt's slot_index.
        Returns None if project start_date is not set or slot_index is None.
        """
        if not self.task or not self.task.project:
            return None
        
        project = self.task.project
        if not project.start_date or self.slot_index is None:
            return None
        
        # Add slot_index days to project start_date
        return project.start_date + timedelta(days=self.slot_index)

class AttemptTodo(models.Model):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='todos')
    text = models.CharField(max_length=500)
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text

class AttemptDependency(models.Model):
    vortakt_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='nachtakt_attempts')
    nachtakt_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='vortakt_attempts')
    type = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return f"{self.vortakt_attempt.name} -> {self.nachtakt_attempt.name}"

    class Meta:
        unique_together = ('vortakt_attempt', 'nachtakt_attempt')


class Notification(models.Model):
    # Action types for extensibility
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


# Demo Date Model - stores the simulated "current date" for testing
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











