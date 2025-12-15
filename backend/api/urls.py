# api/urls.py
from django.urls import path
from . import views   # or import specific views


from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)



urlpatterns = [

    

    #Projects
    path('orgarhythmus/projects/', views.list_projects),   
    path('orgarhythmus/projects/create/', views.create_project),   
    path("orgarhythmus/projects/<int:pk>/", views.get_project),
    #TODO ADDED
    path("orgarhythmus/projects/<int:pk>/delete/", views.delete_project),  


    #Teams
    path("orgarhythmus/projects/<int:project_id>/teams/", views.project_teams, name="project_teams" ), 
    path("orgarhythmus/projects/<int:project_id>/teams/<int:team_id>/", views.project_team_detail),
    path("orgarhythmus/projects/<int:project_id>/project_teams_expanded/", views.project_teams_expanded, name="project_teams_expanded", ), 
    path("orgarhythmus/projects/<int:project_id>/teams/reorder/", views.reorder_project_teams, name="reorder_project_teams",
),

    #Tasks
    path("orgarhythmus/projects/<int:project_id>/tasks/", views.project_tasks, name="project_tasks", ),
    path('orgarhythmus/projects/<int:project_id>/tasks/<int:task_id>/delete/', views.delete_task_by_id),
    
    #Attempts
    path('orgarhythmus/add_attempt_dependency/', views.add_attempt_dependency),
    path('orgarhythmus/all_attempt_dependencies/', views.list_attempt_dependencies),
    path('orgarhythmus/update_attempt_slot_index/', views.update_attempt_slot_index),  
    path("orgarhythmus/delete_attempt_dependency/", views.delete_attempt_dependency),  
    path("orgarhythmus/projects/<int:project_id>/all_attempts_for_this_project/", views.all_attempts_for_this_project, name="all_attempts_for_this_project", ),



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


