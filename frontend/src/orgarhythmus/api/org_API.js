import { BASE_URL } from '../../config/api';
import { redirect } from 'react-router-dom';
import { authFetch } from '../../auth'; // Pfad ggf. anpassen

//_______________________________________________
//_______________________________________________
//____________________HELPER_____________________
//_______________________________________________
//_______________________________________________

// getCurrentProjectIdFromLocation (helper)
function getCurrentProjectIdFromLocation() {
  // Beispiel-Pfad: /orgarhythmus/projects/1/attempts
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  // ["orgarhythmus", "projects", "1", "attempts"]

  const projectsIndex = parts.indexOf('projects');
  if (projectsIndex === -1 || projectsIndex + 1 >= parts.length) {
    return null;
  }

  const id = parseInt(parts[projectsIndex + 1], 10);

  const projectId = Number.isNaN(id) ? null : id;

  // console.log('Inside getCurrentProjectIdFromLocation (PROJECT ID): ', projectId);
  return projectId;
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

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/projects/`, {
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

// create_project_api
export async function create_project_api(name, description) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/projects/create/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
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

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/projects/${projectId}/`, {
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



// TODO ADDED
// delete_project
export async function delete_project(projectId) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/delete/`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to delete project');
  }

  return true;
}



//_______________________________________________
//_______________________________________________
//____________________TEAMS______________________
//_______________________________________________
//_______________________________________________

// project_teams_expanded
export async function project_teams_expanded(projectId) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/project_teams_expanded/`);

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
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch teams for project');
  }

  return await res.json();
}

// createTeamForProject
export async function createTeamForProject(projectId, payload) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/`, {
    method: 'POST',
    body: JSON.stringify(payload),
    // Content-Type setzt authFetch automatisch
  });

  if (!res.ok) {
    throw new Error('Failed to create team');
  }

  return await res.json();
}

// deleteTeamForProject
export async function deleteTeamForProject(projectId, teamId) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/${teamId}/`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to delete team');
  }

  // If response is 204 No Content → return nothing
  if (res.status === 204) {
    return null;
  }

  // Otherwise try to parse JSON
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// reorder_project_teams
export async function reorder_project_teams(projectId, order) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/reorder/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order }),
  });

  // helpful debug
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

//_______________________________________________
//_______________________________________________
//____________________TASKS______________________
//_______________________________________________
//_______________________________________________

// delete_task
export async function delete_task(projectId, id) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/tasks/${id}/delete/`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    console.error('Failed to delete task');
    return null;
  }

  return true; // 204 No Content
}

// fetchTasksForProject
export async function fetchTasksForProject(projectId) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/tasks/`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch tasks for project');
  }

  const data = await res.json();
  // falls dein Backend { tasks: [...] } zurückgibt, nimm data.tasks
  return data.tasks || data;
}

// createTaskForProject
export async function createTaskForProject(projectId, payload) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/tasks/`, {
    method: 'POST',
    body: JSON.stringify(payload),
    // Content-Type kommt von authFetch
  });

  if (!res.ok) {
    throw new Error('Failed to create project task');
  }

  return await res.json();
}

//_______________________________________________
//_______________________________________________
//__________________ATTEMPTS____________________
//_______________________________________________
//_______________________________________________

// fetch_all_attempts
export async function fetch_all_attempts() {
  const projectId = getCurrentProjectIdFromLocation();
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(
    `${BASE_URL}/api/orgarhythmus/projects/${projectId}/all_attempts_for_this_project`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('Could not load tasks');
  }

  const data = await res.json();
  // console.log("The fetched attempts from the API", data)

  // console.log('Attempts: ', data);
  return data.attempts;
}

// add_attempt_dependency
export async function add_attempt_dependency(vortakt_attempt_id, nachtakt_attempt_id) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/add_attempt_dependency/`, {
    method: 'POST', // 👈 important
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vortakt_attempt_id, nachtakt_attempt_id }),
  });

  if (!res.ok) {
    console.error('Backend failed:', res.status);
    throw new Error('Failed to add dependency');
  }

  const data = await res.json();
  return data;
}

// fetch_all_attempt_dependencies
export async function fetch_all_attempt_dependencies() {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_attempt_dependencies/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch attempt dependencies');
  }

  return await res.json();
}

// update_attempt_slot_index
export async function update_attempt_slot_index(attempt_id, slot_index) {
  const token = localStorage.getItem('access_token');
  if (!token) throw redirect('/login');

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/update_attempt_slot_index/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ attempt_id, slot_index }),
  });

  if (!res.ok) {
    console.error('Backend failed:', res.status);
    throw new Error('Failed to update attempt slot_index');
  }

  return await res.json();
}

// delete_attempt_dependency
export async function delete_attempt_dependency(dependency_id) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw redirect('/login');
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/delete_attempt_dependency/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dependency_id }),
  });

  if (!res.ok) {
    console.error('Backend failed:', res.status);
    throw new Error('Failed to delete attempt dependency');
  }

  return await res.json();
}
