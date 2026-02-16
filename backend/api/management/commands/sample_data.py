from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from datetime import date, timedelta
import random

from api.models import Project, Team, Task, Milestone, Dependency

User = get_user_model()


class Command(BaseCommand):
    help = "Create sample projects with teams, tasks, milestones, and dependencies for development."

    def handle(self, *args, **kwargs):
        # ──────────────────────────────────────────────
        #  1. Ensure a demo user exists
        # ──────────────────────────────────────────────
        username = "demo"
        password = "demo1234"
        email = "demo@example.com"

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user '{username}' with password '{password}'"))
        else:
            self.stdout.write(f"User '{username}' already exists — skipping creation.")

        # Optional: second user for membership demos
        user2, created2 = User.objects.get_or_create(
            username="alice",
            defaults={"email": "alice@example.com"},
        )
        if created2:
            user2.set_password("alice1234")
            user2.save()
            self.stdout.write(self.style.SUCCESS("Created user 'alice' with password 'alice1234'"))

        # ──────────────────────────────────────────────
        #  2. Small project (sanity-check that two
        #     projects are treated independently)
        # ──────────────────────────────────────────────
        small_project, _ = Project.objects.get_or_create(
            name="Tiny Test Project",
            owner=user,
            defaults={
                "description": "A tiny project to verify multi-project isolation.",
                "start_date": date.today(),
                "end_date": date.today() + timedelta(days=14),
            },
        )
        small_project.members.add(user, user2)

        # One team, two tasks, one milestone
        small_team, _ = Team.objects.get_or_create(
            name="Solo Team",
            project=small_project,
            defaults={"color": "#94a3b8", "order_index": 0},
        )

        small_task_1, _ = Task.objects.get_or_create(
            name="Quick Check",
            project=small_project,
            team=small_team,
            defaults={"order_index": 0, "priority": "1", "difficulty": "1"},
        )
        small_task_2, _ = Task.objects.get_or_create(
            name="Verify Isolation",
            project=small_project,
            team=small_team,
            defaults={"order_index": 1, "priority": "2", "difficulty": "1"},
        )

        Milestone.objects.get_or_create(
            name="Quick Check_m0",
            project=small_project,
            task=small_task_1,
            defaults={"start_index": 1, "duration": 3},
        )
        Milestone.objects.get_or_create(
            name="Verify Isolation_m0",
            project=small_project,
            task=small_task_2,
            defaults={"start_index": 5, "duration": 2},
        )

        self.stdout.write(self.style.SUCCESS(
            f"Small project '{small_project.name}' ready (id={small_project.id})"
        ))

        # ──────────────────────────────────────────────
        #  3. Large demo project
        # ──────────────────────────────────────────────
        start_date = date.today()
        end_date = start_date + timedelta(days=60)

        big_project, _ = Project.objects.get_or_create(
            name="OrgaRhythmus Demo",
            owner=user,
            defaults={
                "description": "A full-featured demo project with teams, tasks, milestones, and dependencies.",
                "start_date": start_date,
                "end_date": end_date,
            },
        )
        big_project.members.add(user, user2)

        # ── Teams ──
        team_definitions = [
            ("Design", "#FF6B6B"),
            ("Backend", "#4ECDC4"),
            ("Frontend", "#45B7D1"),
            ("Marketing", "#FFA69E"),
            ("Operations", "#6A4C93"),
            ("QA", "#FFD166"),
            ("Management", "#2EC4B6"),
        ]

        teams = {}
        for idx, (name, color) in enumerate(team_definitions):
            team, _ = Team.objects.get_or_create(
                name=name,
                project=big_project,
                defaults={"color": color, "order_index": idx},
            )
            teams[name] = team

        # ── Tasks (2-5 per team) ──
        task_pool = {
            "Design": [
                ("Wireframes", "3", "2"),
                ("Moodboard", "1", "1"),
                ("Component Library", "4", "3"),
                ("Mobile Layout", "3", "2"),
                ("Icon Set", "2", "1"),
            ],
            "Backend": [
                ("Auth System", "5", "4"),
                ("Database Schema", "4", "3"),
                ("API Routes", "3", "3"),
                ("Permissions Layer", "4", "4"),
                ("Caching Strategy", "2", "3"),
            ],
            "Frontend": [
                ("Navbar", "2", "2"),
                ("Dashboard UI", "4", "3"),
                ("Drag & Drop", "5", "4"),
                ("Forms & Validation", "3", "3"),
            ],
            "Marketing": [
                ("Landing Page Copy", "3", "2"),
                ("Newsletter Campaign", "2", "1"),
                ("SEO Audit", "3", "3"),
            ],
            "Operations": [
                ("CI/CD Pipeline", "4", "4"),
                ("Monitoring Setup", "3", "3"),
                ("Backup Strategy", "2", "2"),
                ("Deployment Automation", "4", "3"),
            ],
            "QA": [
                ("Unit Tests", "3", "3"),
                ("Integration Tests", "4", "4"),
                ("Bug Bash", "2", "2"),
                ("Regression Suite", "3", "3"),
            ],
            "Management": [
                ("Roadmap v1", "3", "2"),
                ("Sprint Planning", "2", "1"),
                ("Stakeholder Meeting", "1", "1"),
            ],
        }

        all_tasks = {}  # name -> Task instance
        for team_name, task_defs in task_pool.items():
            team = teams[team_name]
            count = random.randint(2, min(5, len(task_defs)))
            selected = random.sample(task_defs, count)

            for order, (task_name, priority, difficulty) in enumerate(selected):
                task, _ = Task.objects.get_or_create(
                    name=task_name,
                    project=big_project,
                    team=team,
                    defaults={
                        "order_index": order,
                        "priority": priority,
                        "difficulty": difficulty,
                        "description": f"Sample task: {task_name} for team {team_name}.",
                    },
                )
                all_tasks[task_name] = task

        self.stdout.write(f"  Created/verified {len(all_tasks)} tasks across {len(teams)} teams.")

        # ── Milestones (roughly 60-70% of tasks get a milestone) ──
        all_milestones = []
        cursor = 0  # spread milestones across the timeline

        task_list = list(all_tasks.values())
        random.shuffle(task_list)

        milestone_count = int(len(task_list) * 0.7)
        for task in task_list[:milestone_count]:
            start_idx = cursor
            duration = random.randint(1, 5)

            ms, ms_created = Milestone.objects.get_or_create(
                name=f"{task.name}_m0",
                project=big_project,
                task=task,
                defaults={
                    "start_index": start_idx,
                    "duration": duration,
                },
            )
            all_milestones.append(ms)
            cursor += random.randint(1, 4)  # space them out a bit

        self.stdout.write(f"  Created/verified {len(all_milestones)} milestones.")

        # ── Dependencies (a few sequential chains) ──
        dep_count = 0
        # Only create dependencies between milestones that have at least 2
        if len(all_milestones) >= 2:
            # Create 3-5 dependency chains
            num_deps = min(random.randint(3, 5), len(all_milestones) - 1)
            shuffled = list(all_milestones)
            random.shuffle(shuffled)

            for i in range(num_deps):
                source = shuffled[i]
                target = shuffled[i + 1]
                _, dep_created = Dependency.objects.get_or_create(
                    source=source,
                    target=target,
                )
                if dep_created:
                    dep_count += 1

        self.stdout.write(f"  Created {dep_count} dependencies.")

        self.stdout.write(self.style.SUCCESS(
            f"Big project '{big_project.name}' ready (id={big_project.id})"
        ))

        # ── Summary ──
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(self.style.SUCCESS("  SAMPLE DATA READY"))
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(f"  Login:  username={username}  password={password}")
        self.stdout.write(f"  Also:   username=alice  password=alice1234")
        self.stdout.write(f"  Small project id: {small_project.id}")
        self.stdout.write(f"  Big project id:   {big_project.id}")
        self.stdout.write(self.style.SUCCESS("=" * 50))