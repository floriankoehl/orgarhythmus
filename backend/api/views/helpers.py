from ..models import Project


def user_has_project_access(user, project: Project) -> bool:
    return project.owner == user or user in project.members.all()


def resolve_branch(request, project):
    """
    Resolve the active branch for a request.
    Reads ?branch=<id> from query params. Defaults to the project's main branch.
    Returns Branch instance or None if not found.
    """
    from ..models import Branch
    branch_id = request.query_params.get("branch") or request.GET.get("branch")
    if branch_id:
        try:
            return Branch.objects.get(pk=branch_id, project=project)
        except Branch.DoesNotExist:
            return None
    branch = Branch.objects.filter(project=project, is_main=True).first()
    if branch is None:
        # Auto-create a main branch for projects created before branching was introduced
        branch, _ = Branch.objects.get_or_create(
            project=project, is_main=True,
            defaults={"name": "main", "description": "Auto-created main branch."}
        )
    return branch