"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


from api.views import (echo_view,


display_single_user,


write_comment ,
all_comments,
get_current_user,


network_connection,
dummy_data,
all_tasks,
delete_task_by_id,
create_task,
all_teams,
delete_team,
create_team,
add_dependency,
all_dependencies,
delete_dependency,



#USER AUTHENTICATION & REGISTRATION
register_user,
check_auth,


#ATTEMPS:
all_attempts,
add_attempt_dependency,
list_attempt_dependencies,
update_attempt_slot_index,
delete_attempt_dependency,


#PROJECTS:
list_projects,
create_project,
get_project,

                       )  # nutzt unsere Minimal-API

from django.urls import path
from api import views

def root_view(request):
    # Antwort für GET http://127.0.0.1:8000/
    return JsonResponse({"message": "Django API is running 🚀"})

urlpatterns = [
    path('', root_view),



    path('api/orgarhytmus/all_tasks/', all_tasks),
    path('api/orgarhytmus/delete_task/', delete_task_by_id),
    path('api/orgarhytmus/create_task/', create_task),
    path('api/orgarhythmus/all_teams/', all_teams),
    path('api/orgarhythmus/delete_team/', delete_team),
    path('api/orgarhythmus/create_team/', create_team),
    path('api/orgarhythmus/add_dependency/', add_dependency),
    path('api/orgarhythmus/all_dependencies/', all_dependencies),
    path('api/orgarhythmus/delete_dependency/', delete_dependency),

    path('api/orgarhythmus/all_attempts/', all_attempts),
    path('api/orgarhythmus/add_attempt_dependency/', add_attempt_dependency),
    path('api/orgarhythmus/all_attempt_dependencies/', list_attempt_dependencies),
    path('api/orgarhythmus/update_attempt_slot_index/', update_attempt_slot_index),
    # path("api/orgarhythmus/update_attempt_slot_index/", update_attempt_slot_index),
path("api/orgarhythmus/delete_attempt_dependency/", delete_attempt_dependency),  # 👈 NEW

    # ... deine existierenden orgarhythmus Routen ...
























    #PROJEKT BEZOGEN:
    path('api/orgarhythmus/projects/', list_projects),
    path('api/orgarhythmus/projects/create/', create_project),
    path("api/orgarhythmus/projects/<int:pk>/", get_project),path(
        "api/orgarhythmus/projects/<int:project_id>/teams/",
        views.project_teams,
        name="project_teams",
    ),
path(
        "api/orgarhythmus/projects/<int:project_id>/teams/",
        views.project_teams,
        name="project_teams",
    ),
path(
        "api/orgarhythmus/projects/<int:project_id>/tasks/",
        views.project_tasks_view,
        name="project_tasks",
    ),




























    #AUTHENTICATION
    path('admin/', admin.site.urls),

    path('api/auth/me/', get_current_user),  # Nur für eingeloggte User
    path('api/auth/check/', check_auth),
    path('api/auth/jwt/create/', TokenObtainPairView.as_view(), name='jwt_create'),
    path('api/auth/jwt/refresh/', TokenRefreshView.as_view(), name='jwt_refresh'),
    path('api/auth/register/', register_user, name='register_user'),





    path('api/users/<int:user_id>/', display_single_user),













    # ← NEU: Root

    path('api/echo/<str:text>/', echo_view),


    path('api/comments/write/', write_comment),
    path('api/comments/all_comments/', all_comments),

    path('api/company/network_connection/<int:comp_id>/', network_connection),
    path('api/skills/dummy_data/', dummy_data),







]

