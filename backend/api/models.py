from django.db import models

class User(models.Model):   # <-- capital M
    name = models.CharField(max_length=120)
    password = models.CharField(max_length=120)

    def __str__(self):
        return self.id, self.name
