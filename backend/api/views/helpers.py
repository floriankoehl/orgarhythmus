from ..models import Project


def user_has_project_access(user, project: Project) -> bool:
    return project.owner == user or user in project.members.all()