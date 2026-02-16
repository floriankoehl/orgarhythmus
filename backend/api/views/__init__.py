# api/views/__init__.py
# This package replaces the old monolithic views.py file.
# All view functions are imported here so that existing imports
# (e.g. `from . import views` then `views.some_view`) keep working.

from .serializers import (
    ProjectSerializer,
    TaskSerializer,
    TeamExpandedSerializer,
    BasicTeamSerializer,
    TaskSerializer_TeamView,
    TaskExpandedSerializer,
    IdeaSerializer,
    CategorySerializer,
    LegendTypeSerializer,
)

from .helpers import user_has_project_access

from .auth import (
    check_auth,
    register_user,
    display_single_user,
    get_current_user,
)

from .projects import (
    list_projects,
    list_all_projects,
    join_project,
    leave_project,
    create_project,
    get_project,
    delete_project,
    update_project,
)

from .teams import (
    join_team,
    leave_team,
    project_teams,
    project_teams_expanded,
    project_team_detail,
    reorder_project_teams,
    team_detail_view,
    user_teams,
)

from .tasks import (
    delete_task_by_id,
    project_tasks,
    task_detail_view,
    assign_task_member,
    user_tasks,
)

from .attempts import (
    add_attempt_dependency,
    list_attempt_dependencies,
    update_attempt_slot_index,
    delete_attempt_dependency,
    all_attempts_for_this_project,
    create_attempt_view,
    delete_attempt_view,
    attempt_detail_view,
    attempt_todos_view,
)

from .ideas import (
    create_idea,
    delete_idea,
    safe_order,
    assign_idea_to_category,
    get_all_ideas,
    get_all_categories,
    create_category,
    set_position_category,
    set_area_category,
    delete_category,
    bring_to_front_category,
    rename_category,
    update_idea_title,
    update_idea_headline,
    toggle_archive_category,
    get_all_legend_types,
    create_legend_type,
    update_legend_type,
    delete_legend_type,
    assign_idea_legend_type,
)

from .notifications import (
    user_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
    delete_notification,
    demo_date_view,
)