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

    #Tasks
    path("projects/<int:project_id>/tasks/", views.project_tasks, name="project_tasks", ),
    #TODO ADDED TASK
    path("projects/<int:project_id>/tasks/<int:task_id>/detail/", views.task_detail_view, name="task_detail_view"),  # ADD THIS
    path('projects/<int:project_id>/tasks/<int:task_id>/delete/', views.delete_task_by_id),
    
    #Attempts
    path("projects/<int:project_id>/attempts/", views.create_attempt_view, name="create_attempt"),
    path("projects/<int:project_id>/attempts/<int:attempt_id>/", views.attempt_detail_view),
    path("projects/<int:project_id>/attempts/<int:attempt_id>/delete/", views.delete_attempt_view, name="delete_attempt"),
    path("projects/<int:project_id>/attempts/<int:attempt_id>/todos/", views.attempt_todos_view),
    path('add_attempt_dependency/', views.add_attempt_dependency),
    path('all_attempt_dependencies/', views.list_attempt_dependencies),
    path('update_attempt_slot_index/', views.update_attempt_slot_index),  
    path("delete_attempt_dependency/", views.delete_attempt_dependency),  
    path("projects/<int:project_id>/all_attempts_for_this_project/", views.all_attempts_for_this_project, name="all_attempts_for_this_project", ),



    #AUTHENTICATION
    path('auth/me/', views.get_current_user),  # Nur für eingeloggte User
    path('auth/check/', views.check_auth),
    path('auth/jwt/create/', TokenObtainPairView.as_view(), name='jwt_create'),
    path('auth/jwt/refresh/', TokenRefreshView.as_view(), name='jwt_refresh'),
    path('auth/register/', views.register_user, name='register_user'),
    path('users/<int:user_id>/', views.display_single_user),

    # Other Website stuff
    path('echo/<str:text>/', views.echo_view),
    path('comments/write/', views.write_comment),
    path('comments/all_comments/', views.all_comments),
    path('company/network_connection/<int:comp_id>/', views.network_connection),
    path('skills/dummy_data/', views.dummy_data),

#
]


