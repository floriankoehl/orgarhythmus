"""
Unit tests for the Orgarhythmus API.

Structure:
    1. Model Tests          – Test model creation, relationships, __str__, properties, auto-creation
    2. Authentication Tests – Register, login (JWT), get current user
    3. Project Tests        – CRUD, join/leave, access control
    4. Team Tests           – CRUD, join/leave, reorder, detail
    5. Task Tests           – CRUD, assign members, detail
    6. Category & Idea Tests – CRUD, ordering, assignment
    7. Legend Type Tests     – CRUD, assignment
    8. Notification Tests   – List, read, delete
    9. Demo Date Tests      – Get/set demo date
   10. User Teams/Tasks     – Aggregated views
"""

import json
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Category,
    DemoDate,
    Idea,
    LegendType,
    Notification,
    Project,
    Task,
    Team,
)


# ─────────────────────────────────────────────
#  Helper mixin for authenticated API requests
# ─────────────────────────────────────────────


class APITestBase(TestCase):
    """
    Base class that creates a user, obtains a JWT token, and sets up
    an authenticated APIClient.  Every test class that hits API endpoints
    should inherit from this.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123", email="other@example.com"
        )
        # Obtain JWT token
        response = self.client.post(
            "/api/auth/jwt/create/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.token = response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def _get_other_client(self):
        """Return an APIClient authenticated as other_user."""
        client = APIClient()
        response = client.post(
            "/api/auth/jwt/create/",
            {"username": "otheruser", "password": "otherpass123"},
            format="json",
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return client

    def _create_project(self, name="Test Project"):
        """Helper to create a project via the API."""
        return self.client.post(
            "/api/projects/create/",
            {"name": name, "description": "desc"},
            format="json",
        )

    def _create_team(self, project_id, name="Backend Team", color="#ff0000"):
        """Helper to create a team via the API."""
        return self.client.post(
            f"/api/projects/{project_id}/teams/",
            {"name": name, "color": color},
            format="json",
        )

    def _create_task(self, project_id, name="Test Task", team_id=None):
        """Helper to create a task via the API."""
        payload = {"name": name}
        if team_id:
            payload["team_id"] = team_id
        return self.client.post(
            f"/api/projects/{project_id}/tasks/",
            payload,
            format="json",
        )


# ═══════════════════════════════════════════════
#  1. MODEL TESTS
# ═══════════════════════════════════════════════


class ProjectModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="p")

    def test_str(self):
        project = Project.objects.create(name="My Project", owner=self.user)
        self.assertEqual(str(project), "My Project")

    def test_members_m2m(self):
        project = Project.objects.create(name="P", owner=self.user)
        u2 = User.objects.create_user(username="u2", password="p")
        project.members.add(u2)
        self.assertIn(u2, project.members.all())


class TeamModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="p")
        self.project = Project.objects.create(name="P", owner=self.user)

    def test_str(self):
        team = Team.objects.create(name="Backend Team", project=self.project)
        self.assertEqual(str(team), "Backend Team")

    def test_team_requires_project(self):
        with self.assertRaises(IntegrityError):
            Team.objects.create(name="Orphan Team")

    def test_team_members(self):
        team = Team.objects.create(name="T", project=self.project)
        team.members.add(self.user)
        self.assertIn(self.user, team.members.all())


class TaskModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="p")
        self.project = Project.objects.create(name="P", owner=self.user)
        self.team = Team.objects.create(name="T", project=self.project)

    def test_str(self):
        task = Task.objects.create(name="My Task", project=self.project, team=self.team)
        self.assertEqual(str(task), "My Task")

    # def test_auto_creates_3_attempts(self):
    # """When a task is saved for the first time, 3 attempts should be created."""
    # task = Task.objects.create(name="AutoTask", project=self.project, team=self.team)
    # self.assertEqual(task.attempts.count(), 3)

    # def test_auto_created_attempts_have_todos(self):
    # """Each auto-created attempt should have a 'complete task' todo."""
    # task = Task.objects.create(name="TodoTask", project=self.project, team=self.team)
    # for attempt in task.attempts.all():
    # self.assertEqual(attempt.todos.count(), 1)
    # self.assertEqual(attempt.todos.first().text, "complete task")

    # def test_auto_created_attempt_names(self):
    # """Auto-created attempts should be named TaskName_0, TaskName_1, TaskName_2."""
    # task = Task.objects.create(name="Alpha", project=self.project, team=self.team)
    # names = list(task.attempts.order_by("number").values_list("name", flat=True))
    # self.assertEqual(names, ["Alpha_0", "Alpha_1", "Alpha_2"])

    # def test_saving_existing_task_does_not_create_more_attempts(self):
    # """Re-saving should not duplicate attempts."""
    # task = Task.objects.create(name="Once", project=self.project, team=self.team)
    # task.name = "Once Updated"
    # task.save()
    # self.assertEqual(task.attempts.count(), 3)


# class AttemptModelTest(TestCase):
#     def setUp(self):
#         self.user = User.objects.create_user(username="u1", password="p")
#         self.project = Project.objects.create(
#             name="P", owner=self.user, start_date=date(2026, 1, 1)
#         )
#         self.team = Team.objects.create(name="T", project=self.project)
#         self.task = Task.objects.create(name="T1", project=self.project, team=self.team)

#     def test_str_with_name(self):
#         attempt = self.task.attempts.first()
#         self.assertIn("T1_", str(attempt))

#     def test_str_without_name(self):
#         attempt = Attempt.objects.create(task=self.task, name=None, number=99)
#         self.assertEqual(str(attempt), f"Attempt {attempt.id}")

#     def test_calculated_date(self):
#         attempt = self.task.attempts.get(number=1)  # slot_index=0
#         self.assertEqual(attempt.calculated_date, date(2026, 1, 1))

#     def test_calculated_date_with_offset(self):
#         attempt = self.task.attempts.get(number=2)  # slot_index=1
#         self.assertEqual(attempt.calculated_date, date(2026, 1, 2))

#     def test_calculated_date_no_start_date(self):
#         self.project.start_date = None
#         self.project.save()
#         attempt = self.task.attempts.first()
#         self.assertIsNone(attempt.calculated_date)

#     def test_calculated_date_no_slot_index(self):
#         attempt = Attempt.objects.create(task=self.task, number=99, slot_index=None)
#         self.assertIsNone(attempt.calculated_date)

#     def test_unique_together(self):
#         """Same task + same number should raise IntegrityError."""
#         with self.assertRaises(IntegrityError):
#             Attempt.objects.create(task=self.task, number=1, slot_index=99)


class NotificationModelTest(TestCase):
    def test_str(self):
        user = User.objects.create_user(username="u1", password="p")
        n = Notification.objects.create(user=user, title="Hello", message="World")
        self.assertEqual(str(n), "Hello - u1")


class DemoDateModelTest(TestCase):
    def test_get_current_date_no_demo(self):
        """Without any DemoDate object, returns today."""
        self.assertEqual(DemoDate.get_current_date(), date.today())

    def test_get_current_date_with_demo(self):
        d = date(2026, 6, 15)
        DemoDate.objects.create(date=d)
        self.assertEqual(DemoDate.get_current_date(), d)

    def test_str(self):
        dd = DemoDate.objects.create(date=date(2026, 1, 1))
        self.assertIn("2026-01-01", str(dd))


class CategoryModelTest(TestCase):
    def test_creation(self):
        user = User.objects.create_user(username="u1", password="p")
        project = Project.objects.create(name="P", owner=user)
        cat = Category.objects.create(project=project, name="Cat1")
        self.assertEqual(cat.name, "Cat1")
        self.assertFalse(cat.archived)


class IdeaModelTest(TestCase):
    def test_creation(self):
        user = User.objects.create_user(username="u1", password="p")
        project = Project.objects.create(name="P", owner=user)
        idea = Idea.objects.create(project=project, title="Idea1", description="D")
        self.assertEqual(idea.title, "Idea1")


class LegendTypeModelTest(TestCase):
    def test_creation(self):
        user = User.objects.create_user(username="u1", password="p")
        project = Project.objects.create(name="P", owner=user)
        lt = LegendType.objects.create(project=project, name="Bug", color="#ff0000")
        self.assertEqual(lt.name, "Bug")


# ═══════════════════════════════════════════════
#  2. AUTHENTICATION & USER TESTS
# ═══════════════════════════════════════════════


class RegisterUserTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "newuser", "password1": "abc123", "password2": "abc123", "email": "new@test.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "newuser")
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_register_passwords_dont_match(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "u", "password1": "abc", "password2": "xyz"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_fields(self):
        response = self.client.post(
            "/api/auth/register/", {"username": "u"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username(self):
        User.objects.create_user(username="taken", password="p")
        response = self.client.post(
            "/api/auth/register/",
            {"username": "taken", "password1": "abc", "password2": "abc"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already taken", response.data["detail"])


class JWTAuthTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="jwtuser", password="jwtpass")

    def test_obtain_token(self):
        response = self.client.post(
            "/api/auth/jwt/create/",
            {"username": "jwtuser", "password": "jwtpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_obtain_token_wrong_password(self):
        response = self.client.post(
            "/api/auth/jwt/create/",
            {"username": "jwtuser", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_refresh_token(self):
        response = self.client.post(
            "/api/auth/jwt/create/",
            {"username": "jwtuser", "password": "jwtpass"},
            format="json",
        )
        refresh = response.data["refresh"]
        response = self.client.post(
            "/api/auth/jwt/refresh/", {"refresh": refresh}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)


class GetCurrentUserTest(APITestBase):
    def test_get_current_user(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "testuser")
        self.assertTrue(response.data["is_authenticated"])

    def test_unauthenticated_blocked(self):
        client = APIClient()  # no token
        response = client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 401)


# ═══════════════════════════════════════════════
#  3. PROJECT TESTS
# ═══════════════════════════════════════════════


class ProjectCRUDTest(APITestBase):
    def test_create_project(self):
        response = self._create_project("New Project")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "New Project")
        self.assertEqual(response.data["owner"], self.user.id)

    def test_create_project_no_name(self):
        response = self.client.post(
            "/api/projects/create/", {"name": ""}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_projects(self):
        self._create_project("P1")
        self._create_project("P2")
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_get_project(self):
        create_resp = self._create_project("Detail")
        pk = create_resp.data["id"]
        response = self.client.get(f"/api/projects/{pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Detail")

    def test_get_project_no_access(self):
        """Other user cannot see a project they're not a member of."""
        create_resp = self._create_project("Private")
        pk = create_resp.data["id"]
        other_client = self._get_other_client()
        response = other_client.get(f"/api/projects/{pk}/")
        self.assertEqual(response.status_code, 404)

    def test_update_project(self):
        create_resp = self._create_project("Old Name")
        pk = create_resp.data["id"]
        response = self.client.patch(
            f"/api/projects/{pk}/update/",
            {"name": "New Name", "start_date": "2026-03-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "New Name")
        self.assertEqual(response.data["start_date"], "2026-03-01")

    def test_update_project_non_owner(self):
        create_resp = self._create_project("Owned")
        pk = create_resp.data["id"]
        # Add other user as member
        project = Project.objects.get(id=pk)
        project.members.add(self.other_user)
        other_client = self._get_other_client()
        response = other_client.patch(
            f"/api/projects/{pk}/update/", {"name": "Hacked"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_delete_project(self):
        create_resp = self._create_project("ToDelete")
        pk = create_resp.data["id"]
        response = self.client.delete(f"/api/projects/{pk}/delete/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Project.objects.filter(id=pk).exists())

    def test_delete_project_non_owner(self):
        create_resp = self._create_project("Owned")
        pk = create_resp.data["id"]
        project = Project.objects.get(id=pk)
        project.members.add(self.other_user)
        other_client = self._get_other_client()
        response = other_client.delete(f"/api/projects/{pk}/delete/")
        self.assertEqual(response.status_code, 403)

    def test_delete_project_not_found(self):
        response = self.client.delete("/api/projects/99999/delete/")
        self.assertEqual(response.status_code, 404)


class ProjectJoinLeaveTest(APITestBase):
    def test_join_project(self):
        create_resp = self._create_project("Joinable")
        pk = create_resp.data["id"]
        other_client = self._get_other_client()
        response = other_client.post(f"/api/projects/{pk}/join/")
        self.assertEqual(response.status_code, 200)
        project = Project.objects.get(id=pk)
        self.assertIn(self.other_user, project.members.all())

    def test_join_project_already_member(self):
        create_resp = self._create_project("AlreadyIn")
        pk = create_resp.data["id"]
        # Owner is already a member
        response = self.client.post(f"/api/projects/{pk}/join/")
        self.assertEqual(response.status_code, 400)

    def test_leave_project(self):
        create_resp = self._create_project("Leavable")
        pk = create_resp.data["id"]
        project = Project.objects.get(id=pk)
        project.members.add(self.other_user)
        other_client = self._get_other_client()
        response = other_client.post(f"/api/projects/{pk}/leave/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.other_user, project.members.all())

    def test_owner_cannot_leave(self):
        create_resp = self._create_project("OwnedProject")
        pk = create_resp.data["id"]
        response = self.client.post(f"/api/projects/{pk}/leave/")
        self.assertEqual(response.status_code, 400)

    def test_list_all_projects(self):
        self._create_project("Global1")
        response = self.client.get("/api/projects/all/")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)


# ═══════════════════════════════════════════════
#  4. TEAM TESTS
# ═══════════════════════════════════════════════


class TeamCRUDTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("TeamProject")
        self.project_id = resp.data["id"]

    def test_create_team(self):
        response = self._create_team(self.project_id, "Frontend", "#00ff00")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Frontend")

    def test_list_teams(self):
        self._create_team(self.project_id, "A")
        self._create_team(self.project_id, "B")
        response = self.client.get(f"/api/projects/{self.project_id}/teams/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_list_teams_expanded(self):
        self._create_team(self.project_id, "Expanded")
        response = self.client.get(
            f"/api/projects/{self.project_id}/project_teams_expanded/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("teams", response.data)

    def test_delete_team(self):
        resp = self._create_team(self.project_id, "ToDelete")
        team_id = resp.data["id"]
        response = self.client.delete(
            f"/api/projects/{self.project_id}/teams/{team_id}/"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Team.objects.filter(id=team_id).exists())

    def test_team_detail_get(self):
        resp = self._create_team(self.project_id, "Detail")
        team_id = resp.data["id"]
        response = self.client.get(
            f"/api/projects/{self.project_id}/teams/{team_id}/detail/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Detail")

    def test_team_detail_patch(self):
        resp = self._create_team(self.project_id, "Old")
        team_id = resp.data["id"]
        response = self.client.patch(
            f"/api/projects/{self.project_id}/teams/{team_id}/detail/",
            {"name": "New", "color": "#0000ff"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "New")

    def test_forbidden_for_non_member(self):
        other_client = self._get_other_client()
        response = other_client.get(f"/api/projects/{self.project_id}/teams/")
        self.assertEqual(response.status_code, 403)


class TeamReorderTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("ReorderProject")
        self.project_id = resp.data["id"]
        self.t1 = self._create_team(self.project_id, "A").data["id"]
        self.t2 = self._create_team(self.project_id, "B").data["id"]
        self.t3 = self._create_team(self.project_id, "C").data["id"]

    def test_reorder(self):
        response = self.client.patch(
            f"/api/projects/{self.project_id}/teams/reorder/",
            {"order": [self.t3, self.t1, self.t2]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Team.objects.get(id=self.t3).line_index, 0)
        self.assertEqual(Team.objects.get(id=self.t1).line_index, 1)
        self.assertEqual(Team.objects.get(id=self.t2).line_index, 2)

    def test_reorder_invalid_body(self):
        response = self.client.patch(
            f"/api/projects/{self.project_id}/teams/reorder/",
            {"order": "not a list"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class TeamJoinLeaveTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("TeamJoinProject")
        self.project_id = resp.data["id"]
        # Add other_user to project
        project = Project.objects.get(id=self.project_id)
        project.members.add(self.other_user)
        self.team_id = self._create_team(self.project_id, "JoinTeam").data["id"]

    def test_join_team(self):
        other_client = self._get_other_client()
        response = other_client.post(
            f"/api/projects/{self.project_id}/teams/{self.team_id}/join/"
        )
        self.assertEqual(response.status_code, 200)
        team = Team.objects.get(id=self.team_id)
        self.assertIn(self.other_user, team.members.all())

    def test_join_team_already_member(self):
        team = Team.objects.get(id=self.team_id)
        team.members.add(self.other_user)
        other_client = self._get_other_client()
        response = other_client.post(
            f"/api/projects/{self.project_id}/teams/{self.team_id}/join/"
        )
        self.assertEqual(response.status_code, 400)

    def test_leave_team(self):
        team = Team.objects.get(id=self.team_id)
        team.members.add(self.other_user)
        other_client = self._get_other_client()
        response = other_client.post(
            f"/api/projects/{self.project_id}/teams/{self.team_id}/leave/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.other_user, team.members.all())

    def test_leave_team_not_member(self):
        other_client = self._get_other_client()
        response = other_client.post(
            f"/api/projects/{self.project_id}/teams/{self.team_id}/leave/"
        )
        self.assertEqual(response.status_code, 400)


# ═══════════════════════════════════════════════
#  5. TASK TESTS
# ═══════════════════════════════════════════════


class TaskCRUDTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("TaskProject")
        self.project_id = resp.data["id"]
        self.team_id = self._create_team(self.project_id, "Dev").data["id"]

    def test_create_task(self):
        response = self._create_task(self.project_id, "Build Feature", self.team_id)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Build Feature")

    def test_create_task_no_name(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/tasks/",
            {"name": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_task_without_team(self):
        response = self._create_task(self.project_id, "No Team")
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["team"])

    def test_list_tasks(self):
        self._create_task(self.project_id, "T1", self.team_id)
        self._create_task(self.project_id, "T2", self.team_id)
        response = self.client.get(f"/api/projects/{self.project_id}/tasks/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["tasks"]), 2)

    def test_delete_task(self):
        resp = self._create_task(self.project_id, "ToDelete", self.team_id)
        task_id = resp.data["id"]
        response = self.client.delete(
            f"/api/projects/{self.project_id}/tasks/{task_id}/delete/"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Task.objects.filter(id=task_id).exists())

    def test_delete_task_not_found(self):
        response = self.client.delete(
            f"/api/projects/{self.project_id}/tasks/99999/delete/"
        )
        self.assertEqual(response.status_code, 404)

    def test_task_detail_get(self):
        resp = self._create_task(self.project_id, "DetailTask", self.team_id)
        task_id = resp.data["id"]
        response = self.client.get(
            f"/api/projects/{self.project_id}/tasks/{task_id}/detail/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "DetailTask")
        # self.assertIn("attempts", response.data)  # attempts removed

    def test_task_detail_patch(self):
        resp = self._create_task(self.project_id, "PatchMe", self.team_id)
        task_id = resp.data["id"]
        response = self.client.patch(
            f"/api/projects/{self.project_id}/tasks/{task_id}/detail/",
            {"name": "Patched", "priority": "high", "difficulty": "hard"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Patched")

    def test_task_detail_patch_change_team(self):
        resp = self._create_task(self.project_id, "ChangeTeam", self.team_id)
        task_id = resp.data["id"]
        new_team = self._create_team(self.project_id, "QA").data["id"]
        response = self.client.patch(
            f"/api/projects/{self.project_id}/tasks/{task_id}/detail/",
            {"team_id": new_team},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["team"]["id"], new_team)

    def test_task_forbidden_for_non_member(self):
        """Non-members should not be able to see a project's tasks."""
        other_client = self._get_other_client()
        response = other_client.get(f"/api/projects/{self.project_id}/tasks/")
        self.assertEqual(response.status_code, 404)


class TaskAssignMemberTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("AssignProject")
        self.project_id = resp.data["id"]
        project = Project.objects.get(id=self.project_id)
        project.members.add(self.other_user)
        self.team_id = self._create_team(self.project_id, "Dev").data["id"]
        self.task_id = self._create_task(self.project_id, "AssignTask", self.team_id).data["id"]

    def test_assign_member(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        task = Task.objects.get(id=self.task_id)
        self.assertIn(self.other_user, task.assigned_members.all())

    def test_assign_creates_notification(self):
        self.client.post(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.other_user, action_type="task_assigned"
            ).exists()
        )

    def test_assign_already_assigned(self):
        task = Task.objects.get(id=self.task_id)
        task.assigned_members.add(self.other_user)
        response = self.client.post(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unassign_member(self):
        task = Task.objects.get(id=self.task_id)
        task.assigned_members.add(self.other_user)
        response = self.client.delete(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.other_user, task.assigned_members.all())

    def test_unassign_creates_notification(self):
        task = Task.objects.get(id=self.task_id)
        task.assigned_members.add(self.other_user)
        self.client.delete(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.other_user, action_type="task_unassigned"
            ).exists()
        )

    def test_assign_no_user_id(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


# ═══════════════════════════════════════════════
#  6. ATTEMPT TESTS
# ═══════════════════════════════════════════════


# class AttemptCRUDTest(APITestBase):
#     def setUp(self):
#         super().setUp()
#         resp = self._create_project("AttemptProject")
#         self.project_id = resp.data["id"]
#         self.team_id = self._create_team(self.project_id, "Dev").data["id"]
#         task_resp = self._create_task(self.project_id, "AttemptTask", self.team_id)
#         self.task_id = task_resp.data["id"]
#         # Task auto-creates 3 attempts
#         self.attempts = list(Attempt.objects.filter(task_id=self.task_id).values_list("id", flat=True))

#     def test_auto_created_attempts(self):
#         self.assertEqual(len(self.attempts), 3)

#     def test_create_additional_attempt(self):
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/",
#             {"task_id": self.task_id, "name": "Extra Attempt"},
#             format="json",
#         )
#         self.assertEqual(response.status_code, 201)
#         self.assertEqual(response.data["name"], "Extra Attempt")
#         self.assertEqual(Attempt.objects.filter(task_id=self.task_id).count(), 4)

#     def test_create_attempt_no_task_id(self):
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/",
#             {"name": "No Task"},
#             format="json",
#         )
#         self.assertEqual(response.status_code, 400)

#     def test_delete_attempt(self):
#         attempt_id = self.attempts[0]
#         response = self.client.delete(
#             f"/api/projects/{self.project_id}/attempts/{attempt_id}/delete/"
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertFalse(Attempt.objects.filter(id=attempt_id).exists())

#     def test_attempt_detail_get(self):
#         attempt_id = self.attempts[0]
#         response = self.client.get(
#             f"/api/projects/{self.project_id}/attempts/{attempt_id}/"
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertIn("todos", response.data)
#         self.assertIn("incoming_dependencies", response.data)
#         self.assertIn("outgoing_dependencies", response.data)

#     def test_attempt_detail_patch_done(self):
#         attempt_id = self.attempts[0]
#         response = self.client.patch(
#             f"/api/projects/{self.project_id}/attempts/{attempt_id}/",
#             {"done": True},
#             format="json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertTrue(response.data["done"])

#     def test_attempt_detail_patch_name(self):
#         attempt_id = self.attempts[0]
#         response = self.client.patch(
#             f"/api/projects/{self.project_id}/attempts/{attempt_id}/",
#             {"name": "Renamed"},
#             format="json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertEqual(response.data["name"], "Renamed")

#     def test_all_attempts_for_project(self):
#         response = self.client.get(
#             f"/api/projects/{self.project_id}/all_attempts_for_this_project/"
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertEqual(len(response.json()["attempts"]), 3)

#     def test_attempt_forbidden(self):
#         other_client = self._get_other_client()
#         response = other_client.get(
#             f"/api/projects/{self.project_id}/attempts/{self.attempts[0]}/"
#         )
#         self.assertEqual(response.status_code, 403)


# # class AttemptSlotIndexTest(APITestBase):
#     def setUp(self):
#         super().setUp()
#         resp = self._create_project("SlotProject")
#         self.project_id = resp.data["id"]
#         self.team_id = self._create_team(self.project_id, "Dev").data["id"]
#         task_resp = self._create_task(self.project_id, "SlotTask", self.team_id)
#         self.task_id = task_resp.data["id"]
#         self.attempt_id = Attempt.objects.filter(task_id=self.task_id).first().id

#     def test_update_slot_index(self):
#         response = self.client.post(
#             "/api/update_attempt_slot_index/",
#             json.dumps({"attempt_id": self.attempt_id, "slot_index": 10}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 200)
#         attempt = Attempt.objects.get(id=self.attempt_id)
#         self.assertEqual(attempt.slot_index, 10)

#     def test_update_slot_index_missing_fields(self):
#         response = self.client.post(
#             "/api/update_attempt_slot_index/",
#             json.dumps({"attempt_id": self.attempt_id}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 400)


# # class AttemptDependencyAPITest(APITestBase):
#     def setUp(self):
#         super().setUp()
#         resp = self._create_project("DepProject")
#         self.project_id = resp.data["id"]
#         self.team_id = self._create_team(self.project_id, "Dev").data["id"]
#         task_resp = self._create_task(self.project_id, "DepTask", self.team_id)
#         self.task_id = task_resp.data["id"]
#         attempts = Attempt.objects.filter(task_id=self.task_id).order_by("number")
#         self.a1 = attempts[0].id
#         self.a2 = attempts[1].id

#     def test_add_dependency(self):
#         response = self.client.post(
#             "/api/add_attempt_dependency/",
#             json.dumps({"vortakt_attempt_id": self.a1, "nachtakt_attempt_id": self.a2}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertTrue(response.json()["created"])

#     def test_add_duplicate_dependency(self):
#         AttemptDependency.objects.create(
#             vortakt_attempt_id=self.a1, nachtakt_attempt_id=self.a2
#         )
#         response = self.client.post(
#             "/api/add_attempt_dependency/",
#             json.dumps({"vortakt_attempt_id": self.a1, "nachtakt_attempt_id": self.a2}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertFalse(response.json()["created"])

#     def test_list_dependencies(self):
#         AttemptDependency.objects.create(
#             vortakt_attempt_id=self.a1, nachtakt_attempt_id=self.a2
#         )
#         response = self.client.get("/api/all_attempt_dependencies/")
#         self.assertEqual(response.status_code, 200)
#         self.assertGreaterEqual(len(response.json()), 1)

#     def test_delete_dependency(self):
#         dep = AttemptDependency.objects.create(
#             vortakt_attempt_id=self.a1, nachtakt_attempt_id=self.a2
#         )
#         response = self.client.post(
#             "/api/delete_attempt_dependency/",
#             json.dumps({"dependency_id": dep.id}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertFalse(AttemptDependency.objects.filter(id=dep.id).exists())

#     def test_delete_dependency_not_found(self):
#         response = self.client.post(
#             "/api/delete_attempt_dependency/",
#             json.dumps({"dependency_id": 99999}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 404)


# # class AttemptTodosTest(APITestBase):
#     def setUp(self):
#         super().setUp()
#         resp = self._create_project("TodoProject")
#         self.project_id = resp.data["id"]
#         self.team_id = self._create_team(self.project_id, "Dev").data["id"]
#         task_resp = self._create_task(self.project_id, "TodoTask", self.team_id)
#         self.task_id = task_resp.data["id"]
#         self.attempt = Attempt.objects.filter(task_id=self.task_id).first()
#         self.attempt_id = self.attempt.id

#     def test_create_todo(self):
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/{self.attempt_id}/todos/",
#             json.dumps({"action": "create", "text": "Write tests"}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 201)
#         self.assertEqual(response.data["text"], "Write tests")

#     def test_create_todo_no_text(self):
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/{self.attempt_id}/todos/",
#             json.dumps({"action": "create", "text": ""}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 400)

#     def test_toggle_todo(self):
#         todo = self.attempt.todos.first()
#         self.assertFalse(todo.done)
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/{self.attempt_id}/todos/",
#             json.dumps({"action": "toggle", "todo_id": todo.id}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertTrue(response.data["done"])

#     def test_toggle_todo_auto_completes_attempt(self):
#         """When all todos are done, attempt.done should become True."""
#         todo = self.attempt.todos.first()
#         self.client.post(
#             f"/api/projects/{self.project_id}/attempts/{self.attempt_id}/todos/",
#             json.dumps({"action": "toggle", "todo_id": todo.id}),
#             content_type="application/json",
#         )
#         self.attempt.refresh_from_db()
#         self.assertTrue(self.attempt.done)

#     def test_delete_todo(self):
#         todo = self.attempt.todos.first()
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/{self.attempt_id}/todos/",
#             json.dumps({"action": "delete", "todo_id": todo.id}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 200)
#         self.assertFalse(AttemptTodo.objects.filter(id=todo.id).exists())

#     def test_invalid_action(self):
#         response = self.client.post(
#             f"/api/projects/{self.project_id}/attempts/{self.attempt_id}/todos/",
#             json.dumps({"action": "invalid"}),
#             content_type="application/json",
#         )
#         self.assertEqual(response.status_code, 400)


# # ═══════════════════════════════════════════════
#  7. CATEGORY & IDEA TESTS
# ═══════════════════════════════════════════════


class CategoryCRUDTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("CatProject")
        self.project_id = resp.data["id"]

    def test_create_category(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/create_category/",
            {"name": "Design"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["created"])
        self.assertEqual(response.data["category"]["name"], "Design")

    def test_list_categories(self):
        Category.objects.create(project_id=self.project_id, name="Cat1")
        Category.objects.create(project_id=self.project_id, name="Cat2")
        response = self.client.get(
            f"/api/projects/{self.project_id}/get_all_categories/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["categories"]), 2)

    def test_rename_category(self):
        cat = Category.objects.create(project_id=self.project_id, name="Old")
        response = self.client.post(
            f"/api/projects/{self.project_id}/rename_category/",
            {"id": cat.id, "name": "New"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        cat.refresh_from_db()
        self.assertEqual(cat.name, "New")

    def test_rename_category_empty_name(self):
        cat = Category.objects.create(project_id=self.project_id, name="X")
        response = self.client.post(
            f"/api/projects/{self.project_id}/rename_category/",
            {"id": cat.id, "name": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_delete_category(self):
        cat = Category.objects.create(project_id=self.project_id, name="Bye")
        response = self.client.delete(
            f"/api/projects/{self.project_id}/delete_category/",
            {"id": cat.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Category.objects.filter(id=cat.id).exists())

    def test_delete_category_unassigns_ideas(self):
        cat = Category.objects.create(project_id=self.project_id, name="Cat")
        idea = Idea.objects.create(
            project_id=self.project_id, title="I", description="D", category=cat
        )
        self.client.delete(
            f"/api/projects/{self.project_id}/delete_category/",
            {"id": cat.id},
            format="json",
        )
        idea.refresh_from_db()
        self.assertIsNone(idea.category)

    def test_set_position_category(self):
        cat = Category.objects.create(project_id=self.project_id, name="Pos")
        response = self.client.post(
            f"/api/projects/{self.project_id}/set_position_category/",
            {"id": cat.id, "position": {"x": 100, "y": 200}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        cat.refresh_from_db()
        self.assertEqual(cat.x, 100)
        self.assertEqual(cat.y, 200)

    def test_set_area_category(self):
        cat = Category.objects.create(project_id=self.project_id, name="Area")
        response = self.client.post(
            f"/api/projects/{self.project_id}/set_area_category/",
            {"id": cat.id, "width": 300, "height": 400},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        cat.refresh_from_db()
        self.assertEqual(cat.width, 300)
        self.assertEqual(cat.height, 400)

    def test_bring_to_front(self):
        cat1 = Category.objects.create(project_id=self.project_id, name="C1", z_index=0)
        cat2 = Category.objects.create(project_id=self.project_id, name="C2", z_index=1)
        self.client.post(
            f"/api/projects/{self.project_id}/bring_to_front_category/",
            {"id": cat1.id},
            format="json",
        )
        cat1.refresh_from_db()
        self.assertGreater(cat1.z_index, cat2.z_index)

    def test_toggle_archive(self):
        cat = Category.objects.create(project_id=self.project_id, name="Arc")
        self.assertFalse(cat.archived)
        response = self.client.post(
            f"/api/projects/{self.project_id}/toggle_archive_category/",
            {"id": cat.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["archived"])
        # Toggle back
        response = self.client.post(
            f"/api/projects/{self.project_id}/toggle_archive_category/",
            {"id": cat.id},
            format="json",
        )
        self.assertFalse(response.data["archived"])


class IdeaCRUDTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("IdeaProject")
        self.project_id = resp.data["id"]

    def test_create_idea(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/create_idea/",
            {"idea_name": "Cool Idea", "description": "Something cool"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["created"])

    def test_create_idea_no_title(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/create_idea/",
            {"idea_name": "", "description": "No title"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_list_ideas(self):
        Idea.objects.create(project_id=self.project_id, title="I1", description="D")
        Idea.objects.create(project_id=self.project_id, title="I2", description="D")
        response = self.client.get(
            f"/api/projects/{self.project_id}/get_all_ideas/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 2)

    def test_delete_idea(self):
        idea = Idea.objects.create(
            project_id=self.project_id, title="Bye", description="D"
        )
        response = self.client.delete(
            f"/api/projects/{self.project_id}/delete_idea/",
            {"id": idea.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Idea.objects.filter(id=idea.id).exists())

    def test_assign_idea_to_category(self):
        cat = Category.objects.create(project_id=self.project_id, name="Cat")
        idea = Idea.objects.create(
            project_id=self.project_id, title="I", description="D"
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/assign_idea_to_category/",
            {"idea_id": idea.id, "category_id": cat.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        idea.refresh_from_db()
        self.assertEqual(idea.category, cat)

    def test_unassign_idea_from_category(self):
        cat = Category.objects.create(project_id=self.project_id, name="Cat")
        idea = Idea.objects.create(
            project_id=self.project_id, title="I", description="D", category=cat
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/assign_idea_to_category/",
            {"idea_id": idea.id, "category_id": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        idea.refresh_from_db()
        self.assertIsNone(idea.category)

    def test_update_idea_title(self):
        idea = Idea.objects.create(
            project_id=self.project_id, title="Old", description="D"
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/update_idea_title/",
            {"id": idea.id, "title": "New"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        idea.refresh_from_db()
        self.assertEqual(idea.title, "New")

    def test_update_idea_headline(self):
        idea = Idea.objects.create(
            project_id=self.project_id, title="T", description="D"
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/update_idea_headline/",
            {"id": idea.id, "headline": "Brief"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        idea.refresh_from_db()
        self.assertEqual(idea.headline, "Brief")

    def test_safe_order(self):
        i1 = Idea.objects.create(
            project_id=self.project_id, title="A", description="D", order_index=0
        )
        i2 = Idea.objects.create(
            project_id=self.project_id, title="B", description="D", order_index=1
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/safe_order/",
            {"order": [i2.id, i1.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        i1.refresh_from_db()
        i2.refresh_from_db()
        self.assertEqual(i2.order_index, 0)
        self.assertEqual(i1.order_index, 1)

    def test_forbidden_for_non_member(self):
        other_client = self._get_other_client()
        response = other_client.get(
            f"/api/projects/{self.project_id}/get_all_ideas/"
        )
        self.assertEqual(response.status_code, 403)


# ═══════════════════════════════════════════════
#  8. LEGEND TYPE TESTS
# ═══════════════════════════════════════════════


class LegendTypeTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("LegendProject")
        self.project_id = resp.data["id"]

    def test_create_legend_type(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/create_legend_type/",
            {"name": "Bug", "color": "#ff0000"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["created"])

    def test_list_legend_types(self):
        LegendType.objects.create(project_id=self.project_id, name="L1")
        LegendType.objects.create(project_id=self.project_id, name="L2")
        response = self.client.get(
            f"/api/projects/{self.project_id}/get_all_legend_types/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["legend_types"]), 2)

    def test_update_legend_type(self):
        lt = LegendType.objects.create(project_id=self.project_id, name="Old", color="#000")
        response = self.client.post(
            f"/api/projects/{self.project_id}/update_legend_type/",
            {"id": lt.id, "name": "New", "color": "#fff"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        lt.refresh_from_db()
        self.assertEqual(lt.name, "New")
        self.assertEqual(lt.color, "#fff")

    def test_delete_legend_type(self):
        lt = LegendType.objects.create(project_id=self.project_id, name="Bye")
        response = self.client.delete(
            f"/api/projects/{self.project_id}/delete_legend_type/",
            {"id": lt.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(LegendType.objects.filter(id=lt.id).exists())

    def test_delete_legend_type_unassigns_ideas(self):
        lt = LegendType.objects.create(project_id=self.project_id, name="L")
        idea = Idea.objects.create(
            project_id=self.project_id, title="I", description="D", legend_type=lt
        )
        self.client.delete(
            f"/api/projects/{self.project_id}/delete_legend_type/",
            {"id": lt.id},
            format="json",
        )
        idea.refresh_from_db()
        self.assertIsNone(idea.legend_type)

    def test_assign_idea_legend_type(self):
        lt = LegendType.objects.create(project_id=self.project_id, name="L")
        idea = Idea.objects.create(
            project_id=self.project_id, title="I", description="D"
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/assign_idea_legend_type/",
            {"idea_id": idea.id, "legend_type_id": lt.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        idea.refresh_from_db()
        self.assertEqual(idea.legend_type, lt)

    def test_unassign_idea_legend_type(self):
        lt = LegendType.objects.create(project_id=self.project_id, name="L")
        idea = Idea.objects.create(
            project_id=self.project_id, title="I", description="D", legend_type=lt
        )
        response = self.client.post(
            f"/api/projects/{self.project_id}/assign_idea_legend_type/",
            {"idea_id": idea.id, "legend_type_id": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        idea.refresh_from_db()
        self.assertIsNone(idea.legend_type)


# ═══════════════════════════════════════════════
#  9. NOTIFICATION TESTS
# ═══════════════════════════════════════════════


class NotificationTest(APITestBase):
    def setUp(self):
        super().setUp()
        self.n1 = Notification.objects.create(
            user=self.user, title="N1", message="Msg1", action_type="general"
        )
        self.n2 = Notification.objects.create(
            user=self.user, title="N2", message="Msg2", action_type="general"
        )

    def test_list_notifications(self):
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["notifications"]), 2)

    def test_mark_as_read(self):
        response = self.client.post(f"/api/notifications/{self.n1.id}/read/")
        self.assertEqual(response.status_code, 200)
        self.n1.refresh_from_db()
        self.assertTrue(self.n1.read)

    def test_mark_all_as_read(self):
        response = self.client.post("/api/notifications/read-all/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            all(n.read for n in Notification.objects.filter(user=self.user))
        )

    def test_delete_notification(self):
        response = self.client.delete(f"/api/notifications/{self.n1.id}/delete/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Notification.objects.filter(id=self.n1.id).exists())

    def test_cannot_see_other_users_notifications(self):
        other_notif = Notification.objects.create(
            user=self.other_user, title="Secret", message="Hidden"
        )
        response = self.client.get("/api/notifications/")
        ids = [n["id"] for n in response.data["notifications"]]
        self.assertNotIn(other_notif.id, ids)


# ═══════════════════════════════════════════════
# 10. DEMO DATE TESTS
# ═══════════════════════════════════════════════


class DemoDateTest(APITestBase):
    def test_get_demo_date_default(self):
        response = self.client.get("/api/demo-date/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("date", response.data)

    def test_set_demo_date(self):
        response = self.client.post(
            "/api/demo-date/", {"date": "2026-07-01"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["date"], "2026-07-01")

    def test_set_demo_date_updates_existing(self):
        self.client.post("/api/demo-date/", {"date": "2026-01-01"}, format="json")
        self.client.post("/api/demo-date/", {"date": "2026-12-31"}, format="json")
        self.assertEqual(DemoDate.objects.count(), 1)
        self.assertEqual(DemoDate.objects.first().date, date(2026, 12, 31))

    def test_set_demo_date_invalid(self):
        response = self.client.post(
            "/api/demo-date/", {"date": "not-a-date"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_set_demo_date_missing(self):
        response = self.client.post("/api/demo-date/", {}, format="json")
        self.assertEqual(response.status_code, 400)


# ═══════════════════════════════════════════════
# 11. USER TEAMS & TASKS AGGREGATION TESTS
# ═══════════════════════════════════════════════


class UserTeamsTest(APITestBase):
    def test_user_teams_empty(self):
        response = self.client.get("/api/user/teams/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["teams"]), 0)

    def test_user_teams_with_membership(self):
        resp = self._create_project("P")
        project_id = resp.data["id"]
        team_resp = self._create_team(project_id, "MyTeam")
        team = Team.objects.get(id=team_resp.data["id"])
        team.members.add(self.user)
        response = self.client.get("/api/user/teams/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["teams"]), 1)
        self.assertEqual(response.data["teams"][0]["name"], "MyTeam")


class UserTasksTest(APITestBase):
    def test_user_tasks_empty(self):
        response = self.client.get("/api/user/tasks/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["tasks"]), 0)

    def test_user_tasks_with_assignment(self):
        resp = self._create_project("P")
        project_id = resp.data["id"]
        team_id = self._create_team(project_id, "T").data["id"]
        task_resp = self._create_task(project_id, "AssignedToMe", team_id)
        task = Task.objects.get(id=task_resp.data["id"])
        task.assigned_members.add(self.user)
        response = self.client.get("/api/user/tasks/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["tasks"]), 1)
        self.assertEqual(response.data["tasks"][0]["name"], "AssignedToMe")