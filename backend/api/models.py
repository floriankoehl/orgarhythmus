from django.db import models
from django.contrib.auth.models import User  # ← Djangos User verwenden

# Lösche dein eigenes User Model komplett!

class Comment(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE)  # ← Besser!
    text = models.CharField(max_length=2000, blank=True, null=True)






class Task(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    difficulty = models.CharField(max_length=200, blank=True, null=True)
    priority = models.CharField(max_length=200, blank=True, null=True)
    asking = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return self.name



class Team(models.Model):
    name = models.CharField(max_length=200, blank=True, null=True)
    color = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return self.name