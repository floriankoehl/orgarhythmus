from gc import set_debug

from django.db import models
from django.contrib.auth.models import User  # ← Djangos User verwenden
from django.db.models import SET_NULL


# Lösche dein eigenes User Model komplett!

class Comment(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE)  # ← Besser!
    text = models.CharField(max_length=2000, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)









class Team(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    color = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return self.name




class Task(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    difficulty = models.CharField(max_length=200, blank=True, null=True)
    priority = models.CharField(max_length=200, blank=True, null=True)
    asking = models.CharField(max_length=200, blank=True, null=True)
    team = models.ForeignKey(Team, on_delete=SET_NULL, null=True, blank=True, related_name="tasks")


    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            name = f"{self.name}_1"
            Attempt.objects.create(task=self, name = name, number=1)


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

    class Meta:
        unique_together = ('task', 'number')  # Prevent duplicate attempt numbers
        ordering = ['number']  # Always order by attempt number



