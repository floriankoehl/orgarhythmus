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
    AcceptanceCriterionSerializer,
    IdeaSerializer,
    CategorySerializer,
    LegendTypeSerializer,
    DaySerializer,
    ContextSerializer,
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
    toggle_criterion,
)

from .milestones import (
    get_all_milestones,
    add_milestone,
    update_start_index,
    delete_milestones,
    change_duration,
    rename_milestone,
    move_milestone_task,
    bulk_import_dependencies,
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
    merge_categories,
    bring_to_front_category,
    rename_category,
    update_idea_title,
    update_idea_description,
    toggle_archive_category,
    toggle_public_category,
    assign_idea_legend_type,
    remove_idea_from_category,
    remove_all_idea_categories,
    remove_all_idea_legend_types,
    get_context_legends,
    create_legend,
    update_legend,
    delete_legend,
    get_legend_types,
    create_legend_type,
    update_legend_type,
    delete_legend_type,
    get_all_public_categories,
    adopt_category,
    drop_category,
    get_user_ideas,
    spinoff_idea,
    toggle_upvote_idea,
    idea_comments,
    delete_idea_comment,
    create_category_with_ideas,
    batch_remove_legend_type,
    batch_assign_legend_type,
    sync_category_ideas,
    toggle_archive_idea,
    batch_set_archive,
    get_archived_ideas,
    update_category_filter_config,
    merge_ideas,
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
    get_filter_presets,
    save_filter_presets,
)

from .protopersonas import (
    get_all_protopersonas,
    create_protopersona,
    update_protopersona,
    delete_protopersona,
)

from .contexts import (
    get_all_contexts,
    create_context,
    update_context,
    delete_context,
    set_context_position,
    set_context_area,
    bring_to_front_context,
    set_context_color,
    set_context_filter_state,
    assign_category_to_context,
    remove_category_from_context,
    rename_context,
    safe_context_order,
    toggle_public_context,
    get_all_public_contexts,
    adopt_context,
    drop_context,
    assign_idea_to_context,
    remove_idea_from_context,
    save_context_idea_order,
    assign_project_to_context,
    remove_project_from_context,
    get_context_projects,
    get_project_contexts,
)

from .formations import (
    list_formations,
    create_formation,
    get_formation,
    update_formation,
    delete_formation,
    set_default_formation,
    get_default_formation,
    set_default_context,
    get_default_context,
)

from .export import (
    export_ideabin,
)

from .import_backup import (
    import_ideabin,
)

from .category_transfer import (
    export_category,
    import_category,
    insert_ideas_into_category,
)