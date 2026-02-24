# api/urls.py
from django.urls import path
from . import views   # or import specific views


from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)



urlpatterns = [

    

    #Projects
    path('projects/', views.list_projects),
    path('projects/all/', views.list_all_projects),  # NEW
    path('projects/create/', views.create_project),
    path("projects/<int:pk>/", views.get_project),
    path("projects/<int:pk>/update/", views.update_project),
    path("projects/<int:pk>/delete/", views.delete_project),
    path("projects/<int:pk>/join/", views.join_project),  # NEW
    path("projects/<int:pk>/leave/", views.leave_project),  # NEW


    #Teams
    path("projects/<int:project_id>/teams/", views.project_teams, name="project_teams" ), 
    #TODO ADDED TEAM
    path("projects/<int:project_id>/teams/<int:team_id>/detail/", views.team_detail_view, name="team_detail_view"),  # ADD THIS
    path("projects/<int:project_id>/teams/<int:team_id>/", views.project_team_detail),
    path("projects/<int:project_id>/project_teams_expanded/", views.project_teams_expanded, name="project_teams_expanded", ), 
    path("projects/<int:project_id>/teams/reorder/", views.reorder_project_teams, name="reorder_project_teams",),
    path("projects/<int:project_id>/teams/<int:team_id>/join/", views.join_team, name="join_team"),
    path("projects/<int:project_id>/teams/<int:team_id>/leave/", views.leave_team, name="leave_team"),
    path("user/teams/", views.user_teams, name="user_teams"),  # Get all teams for current user

    #Tasks
    path("user/tasks/", views.user_tasks, name="user_tasks"),  # Get all tasks assigned to current user
    path("projects/<int:project_id>/tasks/", views.project_tasks, name="project_tasks", ),
    #TODO ADDED TASK
    path("projects/<int:project_id>/tasks/<int:task_id>/detail/", views.task_detail_view, name="task_detail_view"),  # ADD THIS
    path('projects/<int:project_id>/tasks/<int:task_id>/delete/', views.delete_task_by_id),
    path("projects/<int:project_id>/tasks/<int:task_id>/assign/", views.assign_task_member, name="assign_task_member"),
    path("projects/<int:project_id>/tasks/<int:task_id>/set_deadline/", views.set_task_deadline, name="set_task_deadline"),
    
    #Notifications
    path("notifications/", views.user_notifications, name="user_notifications"),  # Get all notifications
    path("notifications/<int:notification_id>/read/", views.mark_notification_as_read, name="mark_notification_as_read"),
    path("notifications/read-all/", views.mark_all_notifications_as_read, name="mark_all_notifications_as_read"),
    path("notifications/<int:notification_id>/delete/", views.delete_notification, name="delete_notification"),
    
    # Demo Date
    path("demo-date/", views.demo_date_view, name="demo_date"),
    
    #AUTHENTICATION
    path('auth/me/', views.get_current_user),  # Nur für eingeloggte User
    path('auth/check/', views.check_auth),
    path('auth/jwt/create/', TokenObtainPairView.as_view(), name='jwt_create'),
    path('auth/jwt/refresh/', TokenRefreshView.as_view(), name='jwt_refresh'),
    path('auth/register/', views.register_user, name='register_user'),
    path('users/<int:user_id>/', views.display_single_user),

    # Categories and Ideas (user-scoped)
    path("user/categories/", views.get_all_categories),
    path("user/categories/create/", views.create_category),
    path("user/categories/bring_to_front/", views.bring_to_front_category),
    path("user/categories/delete/", views.delete_category),
    path("user/categories/merge/", views.merge_categories),
    path("user/categories/set_position/", views.set_position_category),
    path("user/categories/set_area/", views.set_area_category),

    path("user/ideas/all/", views.get_all_ideas),
    path("user/ideas/meta/", views.get_meta_ideas),
    path("user/ideas/create/", views.create_idea),
    path("user/ideas/delete/", views.delete_idea),
    path("user/ideas/delete_meta/", views.delete_meta_idea),
    path("user/ideas/copy/", views.copy_idea_to_category),
    path("user/ideas/spinoff/", views.spinoff_idea),
    path("user/ideas/safe_order/", views.safe_order),
    path("user/ideas/assign_to_category/", views.assign_idea_to_category),
    path("user/categories/rename/", views.rename_category),
    path("user/ideas/update_title/", views.update_idea_title),
    path("user/ideas/update_description/", views.update_idea_description),
    path("user/categories/toggle_archive/", views.toggle_archive_category),
    path("user/categories/toggle_public/", views.toggle_public_category),
    path("user/ideas/toggle_archive/", views.toggle_archive_idea),
    path("user/ideas/batch_set_archive/", views.batch_set_archive),
    path("user/ideas/archived/", views.get_archived_ideas),

    # Legend Types (user-scoped)
    path("user/ideas/assign_legend_type/", views.assign_idea_legend_type),
    path("user/ideas/remove_from_category/", views.remove_idea_from_category),
    path("user/ideas/remove_all_categories/", views.remove_all_idea_categories),
    path("user/ideas/remove_all_legend_types/", views.remove_all_idea_legend_types),
    path("user/categories/create_with_ideas/", views.create_category_with_ideas),
    path("user/ideas/batch_remove_legend_type/", views.batch_remove_legend_type),
    path("user/ideas/batch_assign_legend_type/", views.batch_assign_legend_type),
    path("user/ideas/merge/", views.merge_ideas),
    path("user/categories/sync_ideas/", views.sync_category_ideas),
    path("user/categories/update_filter_config/", views.update_category_filter_config),


    # _____________________________ ADDED THIS NOW WITH THE DEPENDENCY VIEW ______________________________
    # Project
    path("projects/<int:project_id>/get_project_details/", views.get_project_details),

    # Teams
    path("projects/<int:project_id>/fetch_project_teams/", views.fetch_project_teams),
    path("projects/<int:project_id>/safe_team_order/", views.safe_team_order),

    # Tasks
    path("projects/<int:project_id>/fetch_project_tasks/", views.fetch_project_tasks),
    path("projects/<int:project_id>/reorder_team_tasks/", views.reorder_team_tasks),
    path("projects/<int:project_id>/tasks/<int:task_id>/set_deadline/", views.set_task_deadline),
    
    # Milestones
    path("projects/<int:project_id>/get_all_milestones/", views.get_all_milestones),
    path("projects/<int:project_id>/add_milestone/", views.add_milestone),
    path("projects/<int:project_id>/update_start_index/", views.update_start_index),
    path("projects/<int:project_id>/delete_milestones/", views.delete_milestones),
    path("projects/<int:project_id>/change_duration/", views.change_duration),
    path("projects/<int:project_id>/rename_milestone/", views.rename_milestone),
    path("projects/<int:project_id>/move_milestone_task/", views.move_milestone_task),

    # Dependencies
    path("projects/<int:project_id>/get_all_dependencies/", views.get_all_dependencies),
    path("projects/<int:project_id>/create_dependency/", views.create_dependency),
    path("projects/<int:project_id>/delete_dependency/", views.delete_dependency),
    path("projects/<int:project_id>/update_dependency/", views.update_dependency),
    
    # Days
    path("projects/<int:project_id>/days/", views.get_project_days),
    path("projects/<int:project_id>/days/<int:day_index>/", views.update_day),
    path("projects/<int:project_id>/days/set_purpose/", views.set_day_purpose),
    path("projects/<int:project_id>/validate_dates/", views.validate_project_dates),
    path("projects/<int:project_id>/sync_days/", views.sync_project_days),

    # Phases
    path("projects/<int:project_id>/phases/", views.get_all_phases),
    path("projects/<int:project_id>/phases/create/", views.create_phase),
    path("projects/<int:project_id>/phases/<int:phase_id>/", views.update_phase),
    path("projects/<int:project_id>/phases/<int:phase_id>/delete/", views.delete_phase),

    # Dependency Views (saved frontend state)
    path("projects/<int:project_id>/views/", views.get_all_views),
    path("projects/<int:project_id>/views/create/", views.create_view),
    path("projects/<int:project_id>/views/<int:view_id>/", views.update_view),
    path("projects/<int:project_id>/views/<int:view_id>/delete/", views.delete_view),
    path("projects/<int:project_id>/views/set-default/", views.set_default_view),

    # Project Snapshots
    path("projects/<int:project_id>/snapshots/", views.list_snapshots),
    path("projects/<int:project_id>/snapshots/create/", views.create_snapshot),
    path("projects/<int:project_id>/snapshots/<int:snapshot_id>/", views.get_snapshot),
    path("projects/<int:project_id>/snapshots/<int:snapshot_id>/restore/", views.restore_snapshot),
    path("projects/<int:project_id>/snapshots/<int:snapshot_id>/delete/", views.delete_snapshot),
    path("projects/<int:project_id>/snapshots/<int:snapshot_id>/rename/", views.rename_snapshot),
    # _____________________________ END OF NEW ADDING ______________________________

    # Proto-Personas
    path("projects/<int:project_id>/protopersonas/", views.get_all_protopersonas),
    path("projects/<int:project_id>/protopersonas/create/", views.create_protopersona),
    path("projects/<int:project_id>/protopersonas/<int:persona_id>/", views.update_protopersona),
    path("projects/<int:project_id>/protopersonas/<int:persona_id>/delete/", views.delete_protopersona),

    # User Shortcuts (per-user keyboard shortcut configuration)
    path("user/shortcuts/", views.get_user_shortcuts, name="get_user_shortcuts"),
    path("user/shortcuts/save/", views.save_user_shortcuts, name="save_user_shortcuts"),
    path("user/filter-presets/", views.get_filter_presets, name="get_filter_presets"),
    path("user/filter-presets/save/", views.save_filter_presets, name="save_filter_presets"),

    # Legends (context-scoped)
    path("user/contexts/<int:context_id>/legends/", views.get_context_legends, name="get_context_legends"),
    path("user/contexts/<int:context_id>/legends/create/", views.create_legend, name="create_legend"),

    # Per-legend endpoints (legend already belongs to a context)
    path("user/legends/<int:legend_id>/", views.update_legend, name="update_legend"),
    path("user/legends/<int:legend_id>/delete/", views.delete_legend, name="delete_legend"),

    # Legend types
    path("user/legends/<int:legend_id>/types/", views.get_legend_types, name="get_legend_types"),
    path("user/legends/<int:legend_id>/types/create/", views.create_legend_type, name="create_legend_type"),
    path("user/legends/<int:legend_id>/types/<int:type_id>/", views.update_legend_type, name="update_legend_type"),
    path("user/legends/<int:legend_id>/types/<int:type_id>/delete/", views.delete_legend_type, name="delete_legend_type"),

    # Category adoption
    path("categories/public/", views.get_all_public_categories, name="get_all_public_categories"),
    path("categories/<int:category_id>/adopt/", views.adopt_category, name="adopt_category"),
    path("categories/<int:category_id>/drop/", views.drop_category, name="drop_category"),

    # User-level ideas
    path("user/ideas/", views.get_user_ideas, name="get_user_ideas"),

    # Idea upvotes & comments
    path("user/ideas/<int:idea_id>/upvote/", views.toggle_upvote_idea, name="toggle_upvote_idea"),
    path("user/ideas/<int:idea_id>/comments/", views.idea_comments, name="idea_comments"),
    path("user/ideas/comments/<int:comment_id>/delete/", views.delete_idea_comment, name="delete_idea_comment"),

    # Contexts (user-scoped)
    path("user/contexts/", views.get_all_contexts, name="get_all_contexts"),
    path("user/contexts/create/", views.create_context, name="create_context"),
    path("user/contexts/<int:context_id>/", views.update_context, name="update_context"),
    path("user/contexts/<int:context_id>/delete/", views.delete_context, name="delete_context"),
    path("user/contexts/set_position/", views.set_context_position, name="set_context_position"),
    path("user/contexts/set_area/", views.set_context_area, name="set_context_area"),
    path("user/contexts/bring_to_front/", views.bring_to_front_context, name="bring_to_front_context"),
    path("user/contexts/set_color/", views.set_context_color, name="set_context_color"),
    path("user/contexts/set_filter_state/", views.set_context_filter_state, name="set_context_filter_state"),
    path("user/contexts/rename/", views.rename_context, name="rename_context"),
    path("user/contexts/assign_category/", views.assign_category_to_context, name="assign_category_to_context"),
    path("user/contexts/remove_category/", views.remove_category_from_context, name="remove_category_from_context"),
    path("user/contexts/safe_order/", views.safe_context_order, name="safe_context_order"),
    path("user/contexts/toggle_public/", views.toggle_public_context, name="toggle_public_context"),

    # Context adoption
    path("contexts/public/", views.get_all_public_contexts, name="get_all_public_contexts"),
    path("contexts/<int:context_id>/adopt/", views.adopt_context, name="adopt_context"),
    path("contexts/<int:context_id>/drop/", views.drop_context, name="drop_context"),

    # Default context
    path("user/contexts/default/", views.get_default_context, name="get_default_context"),
    path("user/contexts/<int:context_id>/set-default/", views.set_default_context, name="set_default_context"),

    # Formations (saved IdeaBin layouts — scoped to a context)
    path("user/contexts/<int:context_id>/formations/", views.list_formations, name="list_formations"),
    path("user/contexts/<int:context_id>/formations/create/", views.create_formation, name="create_formation"),
    path("user/contexts/<int:context_id>/formations/default/", views.get_default_formation, name="get_default_formation"),
    path("user/formations/<int:formation_id>/", views.get_formation, name="get_formation"),
    path("user/formations/<int:formation_id>/update/", views.update_formation, name="update_formation"),
    path("user/formations/<int:formation_id>/delete/", views.delete_formation, name="delete_formation"),
    path("user/formations/<int:formation_id>/set-default/", views.set_default_formation, name="set_default_formation"),

    # IdeaBin backup export
    path("ideabin/export/", views.export_ideabin, name="export_ideabin"),
    path("ideabin/import/", views.import_ideabin, name="import_ideabin"),
]


