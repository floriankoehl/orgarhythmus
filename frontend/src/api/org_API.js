import { BASE_URL } from '../config/api';
import { redirect } from 'react-router-dom';
import { authFetch } from '../auth';
import { branchParam } from './activeBranch';

//_______________________________________________
//_______________________________________________
//____________________HELPER_____________________
//_______________________________________________
//_______________________________________________

// getCurrentProjectIdFromLocation (helper)
function getCurrentProjectIdFromLocation() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);

  const projectsIndex = parts.indexOf('projects');
  if (projectsIndex === -1 || projectsIndex + 1 >= parts.length) {
    return null;
  }

  const id = parseInt(parts[projectsIndex + 1], 10);
  const projectId = Number.isNaN(id) ? null : id;
  return projectId;
}



//_______________________________________________
//_______________________________________________
//____________________USERS______________________
//_______________________________________________
//_______________________________________________

// ...existing code...
export async function joinTeam(projectId, teamId) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${teamId}/join/`, { method: 'POST' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to join team');
  }
  return await res.json();
}

export async function leaveTeam(projectId, teamId) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${teamId}/leave/`, { method: 'POST' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to leave team');
  }
  return await res.json();
}



//_______________________________________________
//_______________________________________________
//___________________PROJECT_____________________
//_______________________________________________
//_______________________________________________

// fetch_all_projects
export async function fetch_all_projects() {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/projects/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw redirect('/login');
  }

  if (!res.ok) {
    throw new Error('Could not load projects');
  }

  return await res.json();
}

// NEW: fetch_all_projects_browsable
export async function fetch_all_projects_browsable() {
  const res = await authFetch('/api/projects/all/');

  if (!res.ok) {
    throw new Error('Failed to fetch all projects');
  }

  return await res.json();
}

// NEW: join_project_api
export async function join_project_api(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/join/`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to join project');
  }

  return await res.json();
}

// NEW: leave_project_api
export async function leave_project_api(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/leave/`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to leave project');
  }

  return await res.json();
}

// create_project_api
export async function create_project_api(name, description, startDate, endDate) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/projects/create/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
      start_date: startDate || null,
      end_date: endDate || null,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw redirect('/login');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    console.error('Create project failed:', errorBody);
    throw new Error(errorBody.detail || 'Failed to create project');
  }

  return await res.json();
}

// fetch_project_detail
export async function fetch_project_detail(projectId) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw redirect('/login');
  }

  if (!res.ok) {
    throw new Error('Could not load project');
  }

  return await res.json();
}

// delete_project
export async function delete_project(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/delete/`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to delete project');
  }

  return true;
}

// update_project_api
export async function update_project_api(projectId, data) {
  const res = await authFetch(`/api/projects/${projectId}/update/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || 'Failed to update project');
  }

  return await res.json();
}

//____________________TEAMS______________________
//_______________________________________________
//_______________________________________________
//_______________________________________________
//_______________________________________________

// project_teams_expanded
export async function project_teams_expanded(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/project_teams_expanded/${branchParam()}`);

  if (res.status === 401 || res.status === 403) {
    const err = new Error('unauthorized');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const err = new Error('failed_to_load_teams');
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.teams;
}

// fetchTeamsForProject
export async function fetchTeamsForProject(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${branchParam()}`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch teams for project');
  }

  return await res.json();
}

// createTeamForProject
export async function createTeamForProject(projectId, payload) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${branchParam()}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to create team');
  }

  return await res.json();
}

// deleteTeamForProject
export async function deleteTeamForProject(projectId, teamId) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${teamId}/`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to delete team');
  }

  if (res.status === 204) {
    return null;
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

// reorder_project_teams
export async function reorder_project_teams(projectId, order) {
  const res = await authFetch(`/api/projects/${projectId}/teams/reorder/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order }),
  });

  const text = await res.text();
  console.log('[reorder_project_teams] status:', res.status, 'body:', text);

  if (!res.ok) {
    throw new Error(text || 'Failed to reorder teams');
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// fetchSingleTeam
export async function fetchSingleTeam(projectId, teamId) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${teamId}/detail/`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch team details');
  }

  return await res.json();
}

// updateTeam
export async function updateTeam(projectId, teamId, payload) {
  const res = await authFetch(`/api/projects/${projectId}/teams/${teamId}/detail/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to update team');
  }

  return await res.json();
}

// Get all teams for current user (across all projects)
export async function fetchUserTeams() {
  const res = await authFetch(`/api/user/teams/`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch user teams');
  }
  
  return await res.json();
}

// Get all tasks assigned to current user (across all projects)
export async function fetchUserTasks() {
  const res = await authFetch(`/api/user/tasks/`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch user tasks');
  }
  
  return await res.json();
}

//____________________TASKS______________________
//_______________________________________________
//_______________________________________________
//_______________________________________________
//_______________________________________________

// delete_task
export async function delete_task(projectId, id) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${id}/delete/`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    console.error('Failed to delete task');
    return null;
  }

  return true;
}

// bulk_delete_tasks
export async function bulk_delete_tasks(projectId, taskIds) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/bulk-delete/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_ids: taskIds }),
  });
  if (!res.ok) {
    console.error('Failed to bulk-delete tasks');
    return null;
  }
  return res.json();
}

// fetchTasksForProject
export async function fetchTasksForProject(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${branchParam()}`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch tasks for project');
  }

  const data = await res.json();
  return data.tasks || data;
}

// createTaskForProject
export async function createTaskForProject(projectId, payload) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${branchParam()}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to create project task');
  }

  return await res.json();
}

// fetchSingleTask
export async function fetchSingleTask(projectId, taskId) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/detail/`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch task details');
  }

  return await res.json();
}

// updateTask
export async function updateTask(projectId, taskId, payload) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/detail/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to update task');
  }

  return await res.json();
}

// toggleCriterion — toggle done state of an acceptance criterion
export async function toggleCriterion(projectId, taskId, criterionId) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/criteria/${criterionId}/toggle/`, {
    method: 'PATCH',
  });

  if (!res.ok) {
    throw new Error('Failed to toggle criterion');
  }

  return await res.json();
}

// toggleTaskDone — toggle is_done state, optionally force-complete criteria
export async function toggleTaskDone(projectId, taskId, { forceCompleteCriteria = false } = {}) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/toggle_done/`, {
    method: 'PATCH',
    body: JSON.stringify({ force_complete_criteria: forceCompleteCriteria }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.detail || 'Failed to toggle task done');
    err.data = errorData;
    throw err;
  }

  return await res.json();
}

// Assign a user to a task
export async function assignTaskMember(projectId, taskId, userId) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/assign/`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to assign member to task');
  }

  return await res.json();
}

// Unassign a user from a task
export async function unassignTaskMember(projectId, taskId, userId) {
  const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/assign/`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to unassign member from task');
  }

  return await res.json();
}


//____________________NOTIFICATIONS______________________
//_______________________________________________
//_______________________________________________

// Fetch all notifications for current user
export async function fetchUserNotifications(readFilter = null) {
  const res = await authFetch(`/api/notifications/${readFilter ? `?read=${readFilter}` : ''}`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch notifications');
  }
  
  return await res.json();
}

// Mark a single notification as read
export async function markNotificationAsRead(notificationId) {
  const res = await authFetch(`/api/notifications/${notificationId}/read/`, {
    method: 'POST',
  });
  
  if (!res.ok) {
    throw new Error('Failed to mark notification as read');
  }
  
  return await res.json();
}

// Mark all notifications as read
export async function markAllNotificationsAsRead() {
  const res = await authFetch(`/api/notifications/read-all/`, {
    method: 'POST',
  });
  
  if (!res.ok) {
    throw new Error('Failed to mark all notifications as read');
  }
  
  return await res.json();
}

// Delete a notification
export async function deleteNotification(notificationId) {
  const res = await authFetch(`/api/notifications/${notificationId}/delete/`, {
    method: 'DELETE',
  });
  
  if (!res.ok) {
    throw new Error('Failed to delete notification');
  }
  
  return await res.json();
}

