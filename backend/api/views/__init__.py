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
    LegendVariantSerializer,
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
    # Legend Variants
    get_all_legend_variants,
    create_legend_variant,
    update_legend_variant,
    delete_legend_variant,
    # Multi-assignment
    assign_idea_legend_types,
    assign_idea_categories,
    add_idea_to_category,
    remove_idea_from_category,
    # Category visibility
    set_category_visibility,
    # Variant-scoped legend types
    create_variant_legend_type,
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