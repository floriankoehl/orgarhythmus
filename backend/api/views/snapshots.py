"""
Project Snapshot endpoints — save and restore complete project state.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import (
    Project, ProjectSnapshot, Team, Task, Milestone,
    Dependency, Day, Phase, DependencyView,
)
from .helpers import user_has_project_access


def _capture_snapshot_data(project):
    """Serialize the full project state into a JSON-friendly dict."""
    teams = list(
        Team.objects.filter(project=project)
        .values('id', 'name', 'color', 'order_index')
    )

    tasks = list(
        Task.objects.filter(project=project)
        .values('id', 'name', 'description', 'difficulty', 'priority',
                'asking', 'team_id', 'order_index', 'hard_deadline')
    )

    milestones = list(
        Milestone.objects.filter(project=project)
        .values('id', 'name', 'description', 'task_id', 'start_index', 'duration')
    )

    dependencies = list(
        Dependency.objects.filter(source__project=project)
        .values('source_id', 'target_id', 'weight', 'reason')
    )

    days = list(
        Day.objects.filter(project=project)
        .values('day_index', 'purpose', 'purpose_teams', 'description',
                'is_blocked', 'color')
    )

    phases = list(
        Phase.objects.filter(project=project)
        .values('id', 'name', 'team_id', 'start_index', 'duration',
                'color', 'order_index')
    )

    views = list(
        DependencyView.objects.filter(project=project)
        .values('name', 'state', 'is_default')
    )

    return {
        'project': {
            'start_date': str(project.start_date) if project.start_date else None,
            'end_date': str(project.end_date) if project.end_date else None,
        },
        'teams': teams,
        'tasks': tasks,
        'milestones': milestones,
        'dependencies': dependencies,
        'days': days,
        'phases': phases,
        'views': views,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_snapshots(request, project_id):
    """List all snapshots for a project (metadata only, no full data blob)."""
    project = Project.objects.filter(id=project_id).first()
    if not project:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user_has_project_access(request.user, project):
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    snapshots = ProjectSnapshot.objects.filter(project=project).values(
        'id', 'name', 'description', 'created_at', 'created_by__username',
    )
    return Response(list(snapshots))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_snapshot(request, project_id):
    """Save a new snapshot of the current project state."""
    project = Project.objects.filter(id=project_id).first()
    if not project:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user_has_project_access(request.user, project):
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'Name is required'}, status=status.HTTP_400_BAD_REQUEST)

    description = request.data.get('description', '').strip()

    data = _capture_snapshot_data(project)

    snapshot = ProjectSnapshot.objects.create(
        project=project,
        name=name,
        description=description,
        data=data,
        created_by=request.user,
    )

    return Response({
        'id': snapshot.id,
        'name': snapshot.name,
        'description': snapshot.description,
        'created_at': snapshot.created_at,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_snapshot(request, project_id, snapshot_id):
    """Retrieve the full data of a single snapshot."""
    project = Project.objects.filter(id=project_id).first()
    if not project:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user_has_project_access(request.user, project):
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    snapshot = ProjectSnapshot.objects.filter(id=snapshot_id, project=project).first()
    if not snapshot:
        return Response({'error': 'Snapshot not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'id': snapshot.id,
        'name': snapshot.name,
        'description': snapshot.description,
        'data': snapshot.data,
        'created_at': snapshot.created_at,
        'created_by': snapshot.created_by.username if snapshot.created_by else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def restore_snapshot(request, project_id, snapshot_id):
    """
    Restore a project to a saved snapshot state.
    This REPLACES all teams, tasks, milestones, dependencies, days, phases, views.
    """
    project = Project.objects.filter(id=project_id).first()
    if not project:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user_has_project_access(request.user, project):
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    snapshot = ProjectSnapshot.objects.filter(id=snapshot_id, project=project).first()
    if not snapshot:
        return Response({'error': 'Snapshot not found'}, status=status.HTTP_404_NOT_FOUND)

    data = snapshot.data
    if not data:
        return Response({'error': 'Snapshot data is empty'}, status=status.HTTP_400_BAD_REQUEST)

    # ── 1. Restore project dates ──
    proj_data = data.get('project', {})
    if proj_data.get('start_date'):
        project.start_date = proj_data['start_date']
    if proj_data.get('end_date'):
        project.end_date = proj_data['end_date']
    project.save()

    # ── 2. Wipe current data ──
    Dependency.objects.filter(source__project=project).delete()
    Milestone.objects.filter(project=project).delete()
    Phase.objects.filter(project=project).delete()
    DependencyView.objects.filter(project=project).delete()
    Day.objects.filter(project=project).delete()
    Task.objects.filter(project=project).delete()
    Team.objects.filter(project=project).delete()

    # ── 3. Rebuild teams ──
    team_id_map = {}  # old id → new Team
    for t in data.get('teams', []):
        new_team = Team.objects.create(
            project=project,
            name=t['name'],
            color=t.get('color'),
            order_index=t.get('order_index', 0),
        )
        team_id_map[t['id']] = new_team

    # ── 4. Rebuild tasks ──
    task_id_map = {}  # old id → new Task
    for tk in data.get('tasks', []):
        new_team = team_id_map.get(tk.get('team_id'))
        new_task = Task.objects.create(
            project=project,
            name=tk['name'],
            description=tk.get('description'),
            difficulty=tk.get('difficulty'),
            priority=tk.get('priority'),
            asking=tk.get('asking'),
            team=new_team,
            order_index=tk.get('order_index', 0),
            hard_deadline=tk.get('hard_deadline'),
        )
        task_id_map[tk['id']] = new_task

    # ── 5. Rebuild milestones ──
    milestone_id_map = {}  # old id → new Milestone
    for ms in data.get('milestones', []):
        new_task = task_id_map.get(ms.get('task_id'))
        if not new_task:
            continue
        new_ms = Milestone.objects.create(
            project=project,
            task=new_task,
            name=ms['name'],
            description=ms.get('description'),
            start_index=ms.get('start_index', 0),
            duration=ms.get('duration', 1),
        )
        milestone_id_map[ms['id']] = new_ms

    # ── 6. Rebuild dependencies ──
    for dep in data.get('dependencies', []):
        src = milestone_id_map.get(dep.get('source_id'))
        tgt = milestone_id_map.get(dep.get('target_id'))
        if src and tgt:
            Dependency.objects.create(
                source=src,
                target=tgt,
                weight=dep.get('weight', 'strong'),
                reason=dep.get('reason'),
            )

    # ── 7. Rebuild days ──
    project.create_days()  # create Day objects from start/end dates
    for d in data.get('days', []):
        Day.objects.filter(project=project, day_index=d['day_index']).update(
            purpose=d.get('purpose'),
            purpose_teams=d.get('purpose_teams'),
            description=d.get('description'),
            is_blocked=d.get('is_blocked', False),
            color=d.get('color'),
        )

    # ── 8. Rebuild phases ──
    for ph in data.get('phases', []):
        new_team = team_id_map.get(ph.get('team_id'))
        Phase.objects.create(
            project=project,
            team=new_team,
            name=ph['name'],
            start_index=ph.get('start_index', 0),
            duration=ph.get('duration', 1),
            color=ph.get('color', '#3b82f6'),
            order_index=ph.get('order_index', 0),
        )

    # ── 9. Rebuild views ──
    for v in data.get('views', []):
        DependencyView.objects.create(
            project=project,
            name=v['name'],
            state=v.get('state', {}),
            is_default=v.get('is_default', False),
            created_by=request.user,
        )

    return Response({'success': True, 'message': f'Restored snapshot "{snapshot.name}"'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_snapshot(request, project_id, snapshot_id):
    """Delete a saved snapshot."""
    project = Project.objects.filter(id=project_id).first()
    if not project:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user_has_project_access(request.user, project):
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    snapshot = ProjectSnapshot.objects.filter(id=snapshot_id, project=project).first()
    if not snapshot:
        return Response({'error': 'Snapshot not found'}, status=status.HTTP_404_NOT_FOUND)

    snapshot.delete()
    return Response({'success': True})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def rename_snapshot(request, project_id, snapshot_id):
    """Rename an existing snapshot."""
    project = Project.objects.filter(id=project_id).first()
    if not project:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user_has_project_access(request.user, project):
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    snapshot = ProjectSnapshot.objects.filter(id=snapshot_id, project=project).first()
    if not snapshot:
        return Response({'error': 'Snapshot not found'}, status=status.HTTP_404_NOT_FOUND)

    name = request.data.get('name', '').strip()
    if name:
        snapshot.name = name
    description = request.data.get('description')
    if description is not None:
        snapshot.description = description.strip()
    snapshot.save()

    return Response({
        'id': snapshot.id,
        'name': snapshot.name,
        'description': snapshot.description,
    })
