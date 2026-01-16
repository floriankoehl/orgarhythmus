from django.test import TestCase
from api.models import Project, Team
from django.contrib.auth.models import User
from django.db import IntegrityError



class TeamModelTest(TestCase):
    """Test the Team model's __str__ method"""

    def test_team_string_representation(self):
        """Test that a team's string representation returns its name"""
        user = User.objects.create_user(username="testuser", password="testpass")
        project = Project.objects.create(name="Test Project", owner=user)
        team = Team.objects.create(name="Backend Team", project=project)
        self.assertEqual(str(team), "Backend Team")


    def test_team_without_project(self):
        with self.assertRaises(IntegrityError):
            Team.objects.create(name="Orphan Team").save()
