from django.db import models
from django.contrib.auth.models import User  # ← Djangos User verwenden

# Lösche dein eigenes User Model komplett!

class Comment(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE)  # ← Besser!
    text = models.CharField(max_length=2000, blank=True, null=True)

