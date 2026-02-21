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
    DaySerializer,
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
    get_project_details,
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
    fetch_project_teams,
    safe_team_order,
)

from .tasks import (
    delete_task_by_id,
    project_tasks,
    task_detail_view,
    assign_task_member,
    user_tasks,
    fetch_project_tasks,
    reorder_team_tasks,
    set_task_deadline,
)

from .milestones import (
    get_all_milestones,
    add_milestone,
    update_start_index,
    delete_milestones,
    change_duration,
    rename_milestone,
    move_milestone_task,
)

from .dependencies import (
    get_all_dependencies,
    create_dependency,
    delete_dependency,
    update_dependency,
)

from .days import (
    get_project_days,
    update_day,
    set_day_purpose,
    validate_project_dates,
    sync_project_days,
)

from .phases import (
    get_all_phases,
    create_phase,
    update_phase,
    delete_phase,
)

from .dependency_views import (
    get_all_views,
    create_view,
    update_view,
    delete_view,
    set_default_view,
)

from .snapshots import (
    list_snapshots,
    create_snapshot,
    get_snapshot,
    restore_snapshot,
    delete_snapshot,
    rename_snapshot,
)

from .ideas import (
    create_idea,
    delete_idea,
    delete_meta_idea,
    copy_idea_to_category,
    safe_order,
    assign_idea_to_category,
    get_all_ideas,
    get_meta_ideas,
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
    assign_idea_legend_type,
    remove_idea_from_category,
    remove_all_idea_categories,
    remove_all_idea_dimension_types,
    get_user_dimensions,
    create_dimension,
    update_dimension,
    delete_dimension,
    adopt_dimension,
    drop_dimension,
    get_all_public_dimensions,
    get_dimension_types,
    create_dimension_type,
    update_dimension_type,
    delete_dimension_type,
    get_all_public_categories,
    adopt_category,
    drop_category,
    get_user_ideas,
)

from .notifications import (
    user_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
    delete_notification,
    demo_date_view,
)

from .shortcuts import (
    get_user_shortcuts,
    save_user_shortcuts,
)

from .protopersonas import (
    get_all_protopersonas,
    create_protopersona,
    update_protopersona,
    delete_protopersona,
)