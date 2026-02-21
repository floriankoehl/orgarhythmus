"""
Unit tests for the Orgarhythmus API.

Structure:
    1. Model Tests          – Test model creation, relationships, __str__, properties
    2. Authentication Tests – Register, login (JWT), get current user
    3. Project Tests        – CRUD, join/leave, access control
    4. Team Tests           – CRUD, join/leave, reorder, detail
    5. Task Tests           – CRUD, assign members, detail
    6. Legend Type Tests     – CRUD, assignment
    7. Notification Tests   – List, read, delete
    8. Demo Date Tests      – Get/set demo date
    9. User Teams/Tasks     – Aggregated views
"""

import json
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    DemoDate,
    Dimension,
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
    Creates two users, logs in the first one, and provides
    helper methods for common API calls.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.other_user = User.objects.create_user(username="otheruser", password="otherpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    # ── helpers ──
    def _get_other_client(self):
        c = APIClient()
        c.force_authenticate(user=self.other_user)
        return c

    def _create_project(self, name="Test Project", **extra):
        return self.client.post(
            "/api/projects/create/",
            {"name": name, **extra},
            format="json",
        )

    def _create_team(self, project_id, name="Dev", **extra):
        return self.client.post(
            f"/api/projects/{project_id}/teams/",
            {"name": name, **extra},
            format="json",
        )

    def _create_task(self, project_id, name="Task", team_id=None, **extra):
        payload = {"name": name, **extra}
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
    def test_str(self):
        user = User.objects.create_user(username="u1", password="p")
        project = Project.objects.create(name="My Project", owner=user)
        self.assertEqual(str(project), "My Project")


class TeamModelTest(TestCase):
    def test_str(self):
        user = User.objects.create_user(username="u1", password="p")
        project = Project.objects.create(name="P", owner=user)
        team = Team.objects.create(name="My Team", project=project)
        self.assertEqual(str(team), "My Team")


class TaskModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="p")
        self.project = Project.objects.create(name="P", owner=self.user)
        self.team = Team.objects.create(name="T", project=self.project)

    def test_str(self):
        task = Task.objects.create(name="My Task", project=self.project, team=self.team)
        self.assertEqual(str(task), "My Task")


class NotificationModelTest(TestCase):
    def test_str(self):
        user = User.objects.create_user(username="u1", password="p")
        n = Notification.objects.create(user=user, title="Hello", message="World")
        self.assertIn("Hello", str(n))

    def test_ordering(self):
        user = User.objects.create_user(username="u1", password="p")
        n1 = Notification.objects.create(user=user, title="First", message="A")
        n2 = Notification.objects.create(user=user, title="Second", message="B")
        qs = Notification.objects.filter(user=user)
        self.assertEqual(qs.first(), n2)


class DemoDateModelTest(TestCase):
    def test_get_current_date_default(self):
        d = DemoDate.get_current_date()
        self.assertEqual(d, date.today())

    def test_get_current_date_custom(self):
        DemoDate.objects.create(date=date(2030, 6, 15))
        self.assertEqual(DemoDate.get_current_date(), date(2030, 6, 15))


class LegendTypeModelTest(TestCase):
    def test_ordering(self):
        user = User.objects.create_user(username="u1", password="p")
        dim = Dimension.objects.create(name="D", owner=user)
        lt1 = LegendType.objects.create(name="B", order_index=2, dimension=dim)
        lt2 = LegendType.objects.create(name="A", order_index=1, dimension=dim)
        qs = list(LegendType.objects.filter(dimension=dim))
        self.assertEqual(qs[0], lt2)


# ═══════════════════════════════════════════════
#  2. AUTHENTICATION & USER TESTS
# ═══════════════════════════════════════════════


class RegisterUserTest(TestCase):
    def test_register(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "newuser", "password1": "newpass123", "password2": "newpass123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_register_duplicate(self):
        User.objects.create_user(username="dup", password="p")
        response = self.client.post(
            "/api/auth/register/",
            {"username": "dup", "password1": "p2", "password2": "p2"},
            content_type="application/json",
        )
        self.assertIn(response.status_code, [400, 409])


class JWTAuthTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="jwtuser", password="jwtpass")

    def test_obtain_token(self):
        response = self.client.post(
            "/api/auth/jwt/create/",
            {"username": "jwtuser", "password": "jwtpass"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_wrong_password(self):
        response = self.client.post(
            "/api/auth/jwt/create/",
            {"username": "jwtuser", "password": "wrong"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)


class GetCurrentUserTest(APITestBase):
    def test_get_me(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "testuser")


# ═══════════════════════════════════════════════
#  3. PROJECT TESTS
# ═══════════════════════════════════════════════


class ProjectCRUDTest(APITestBase):
    def test_create_project(self):
        resp = self._create_project("New Project")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["name"], "New Project")

    def test_list_projects(self):
        self._create_project("P1")
        self._create_project("P2")
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_get_project(self):
        resp = self._create_project("Detail Project")
        pk = resp.data["id"]
        response = self.client.get(f"/api/projects/{pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Detail Project")

    def test_delete_project(self):
        resp = self._create_project("ToDelete")
        pk = resp.data["id"]
        response = self.client.delete(f"/api/projects/{pk}/delete/")
        self.assertIn(response.status_code, [200, 204])
        self.assertFalse(Project.objects.filter(pk=pk).exists())

    def test_update_project(self):
        resp = self._create_project("Old Name")
        pk = resp.data["id"]
        response = self.client.patch(
            f"/api/projects/{pk}/update/",
            {"name": "New Name"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Project.objects.get(pk=pk).name, "New Name")

    def test_other_user_cannot_see(self):
        resp = self._create_project("Private")
        pk = resp.data["id"]
        other = self._get_other_client()
        response = other.get(f"/api/projects/{pk}/")
        self.assertIn(response.status_code, [403, 404])


class ProjectJoinLeaveTest(APITestBase):
    def test_join_project(self):
        resp = self._create_project("Joinable")
        pk = resp.data["id"]
        other = self._get_other_client()
        response = other.post(f"/api/projects/{pk}/join/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Project.objects.get(pk=pk).members.filter(id=self.other_user.id).exists())

    def test_leave_project(self):
        resp = self._create_project("Leavable")
        pk = resp.data["id"]
        other = self._get_other_client()
        other.post(f"/api/projects/{pk}/join/")
        response = other.post(f"/api/projects/{pk}/leave/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Project.objects.get(pk=pk).members.filter(id=self.other_user.id).exists())


# ═══════════════════════════════════════════════
#  4. TEAM TESTS
# ═══════════════════════════════════════════════


class TeamCRUDTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("TeamProject")
        self.project_id = resp.data["id"]

    def test_create_team(self):
        resp = self._create_team(self.project_id, "Backend")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["name"], "Backend")

    def test_list_teams(self):
        self._create_team(self.project_id, "A")
        self._create_team(self.project_id, "B")
        response = self.client.get(f"/api/projects/{self.project_id}/teams/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_delete_team(self):
        resp = self._create_team(self.project_id, "DelMe")
        team_id = resp.data["id"]
        response = self.client.delete(f"/api/projects/{self.project_id}/teams/{team_id}/")
        self.assertIn(response.status_code, [200, 204])
        self.assertFalse(Team.objects.filter(id=team_id).exists())


class TeamReorderTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("ReorderProject")
        self.project_id = resp.data["id"]
        self.t1 = self._create_team(self.project_id, "First").data["id"]
        self.t2 = self._create_team(self.project_id, "Second").data["id"]

    def test_reorder(self):
        response = self.client.patch(
            f"/api/projects/{self.project_id}/teams/reorder/",
            {"order": [self.t2, self.t1]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


class TeamJoinLeaveTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("JLProject")
        self.project_id = resp.data["id"]
        Project.objects.get(pk=self.project_id).members.add(self.other_user)
        self.team_id = self._create_team(self.project_id, "JLTeam").data["id"]

    def test_join_team(self):
        other = self._get_other_client()
        response = other.post(
            f"/api/projects/{self.project_id}/teams/{self.team_id}/join/"
        )
        self.assertEqual(response.status_code, 200)

    def test_leave_team(self):
        other = self._get_other_client()
        other.post(f"/api/projects/{self.project_id}/teams/{self.team_id}/join/")
        response = other.post(
            f"/api/projects/{self.project_id}/teams/{self.team_id}/leave/"
        )
        self.assertEqual(response.status_code, 200)


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
        resp = self._create_task(self.project_id, "NewTask", self.team_id)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["name"], "NewTask")

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


class TaskAssignMemberTest(APITestBase):
    def setUp(self):
        super().setUp()
        resp = self._create_project("AssignProject")
        self.project_id = resp.data["id"]
        Project.objects.get(pk=self.project_id).members.add(self.other_user)
        self.team_id = self._create_team(self.project_id, "Dev").data["id"]
        task_resp = self._create_task(self.project_id, "AssignTask", self.team_id)
        self.task_id = task_resp.data["id"]

    def test_assign_member(self):
        response = self.client.post(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_unassign_member(self):
        self.client.post(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        response = self.client.delete(
            f"/api/projects/{self.project_id}/tasks/{self.task_id}/assign/",
            {"user_id": self.other_user.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


# ═══════════════════════════════════════════════
#  6. LEGEND TYPE TESTS
# ═══════════════════════════════════════════════


class LegendTypeTest(APITestBase):
    def setUp(self):
        super().setUp()
        self.dimension = Dimension.objects.create(name="Priority", owner=self.user)
        self.dim_id = self.dimension.id

    def test_create_legend_type(self):
        response = self.client.post(
            f"/api/user/dimensions/{self.dim_id}/types/create/",
            {"name": "Bug", "color": "#ff0000"},
            format="json",
        )
        self.assertIn(response.status_code, [200, 201])

    def test_update_legend_type(self):
        lt = LegendType.objects.create(dimension=self.dimension, name="Old", color="#000")
        response = self.client.post(
            f"/api/user/dimensions/{self.dim_id}/types/{lt.id}/",
            {"name": "New", "color": "#fff"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_delete_legend_type(self):
        lt = LegendType.objects.create(dimension=self.dimension, name="Del")
        response = self.client.delete(
            f"/api/user/dimensions/{self.dim_id}/types/{lt.id}/delete/",
        )
        self.assertIn(response.status_code, [200, 204])


# ═══════════════════════════════════════════════
#  7. NOTIFICATION TESTS
# ═══════════════════════════════════════════════


class NotificationTest(APITestBase):
    def setUp(self):
        super().setUp()
        self.n1 = Notification.objects.create(
            user=self.user, title="N1", message="M1"
        )
        self.n2 = Notification.objects.create(
            user=self.user, title="N2", message="M2"
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
        self.assertTrue(all(n.read for n in Notification.objects.filter(user=self.user)))

    def test_delete_notification(self):
        response = self.client.delete(f"/api/notifications/{self.n1.id}/delete/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Notification.objects.filter(id=self.n1.id).exists())

    def test_cannot_see_other_users_notifications(self):
        other = self._get_other_client()
        response = other.get("/api/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["notifications"]), 0)


# ═══════════════════════════════════════════════
#  8. DEMO DATE TESTS
# ═══════════════════════════════════════════════


class DemoDateTest(APITestBase):
    def test_get_default(self):
        response = self.client.get("/api/demo-date/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["date"], date.today().isoformat())

    def test_set_date(self):
        response = self.client.post(
            "/api/demo-date/",
            {"date": "2030-01-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["date"], "2030-01-01")


# ═══════════════════════════════════════════════
#  9. USER TEAMS / TASKS
# ═══════════════════════════════════════════════


class UserTeamsTasksTest(APITestBase):
    def test_user_teams(self):
        response = self.client.get("/api/user/teams/")
        self.assertEqual(response.status_code, 200)

    def test_user_tasks(self):
        response = self.client.get("/api/user/tasks/")
        self.assertEqual(response.status_code, 200)