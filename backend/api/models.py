from django.db import models

class User(models.Model):   # <-- capital M
    name = models.CharField(max_length=120)
    password = models.CharField(max_length=120)

    def __str__(self):
        return self.id, self.name


class Comment(models.Model):
    author = models.CharField(max_length=120)
    text = models.CharField(max_length=2000, blank=True, null=True, default=None)