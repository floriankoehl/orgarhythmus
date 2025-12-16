from gc import set_debug

from django.db import models
from django.contrib.auth.models import User
from django.db.models import SET_NULL

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
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="teams", default=1, null=True,
        blank=True, )
    line_index = models.IntegerField(blank=True, null=True)
    

    def __str__(self):
        return self.name


class Task(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    difficulty = models.CharField(max_length=200, blank=True, null=True)
    priority = models.CharField(max_length=200, blank=True, null=True)
    asking = models.CharField(max_length=200, blank=True, null=True)
    team = models.ForeignKey(Team, on_delete=SET_NULL, null=True, blank=True, related_name="tasks")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks", default=1, null=True,
        blank=True, )
    


    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            for i in range(3):
                name = f"{self.name}_{i}"
                Attempt.objects.create(task=self, name=name, number=i+1)



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
    number = models.IntegerField()  # Remove blank=True, null=True if it's always required
    slot_index = models.IntegerField(blank=True, null=True)

    class Meta:
        unique_together = ('task', 'number')  # Prevent duplicate attempt numbers
        ordering = ['number']  # Always order by attempt number


class AttemptDependency(models.Model):
    vortakt_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='nachtakt_attempts')
    nachtakt_attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='vortakt_attempts')
    type = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return f"{self.vortakt_attempt.name} -> {self.nachtakt_attempt.name}"

    class Meta:
        unique_together = ('vortakt_attempt', 'nachtakt_attempt')










