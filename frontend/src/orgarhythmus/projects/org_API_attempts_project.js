function getCurrentProjectIdFromLocation() {
  // Beispiel-Pfad: /orgarhythmus/projects/1/attempts
  const path = window.location.pathname; 
  const parts = path.split("/").filter(Boolean); 
  // ["orgarhythmus", "projects", "1", "attempts"]

  const projectsIndex = parts.indexOf("projects");
  if (projectsIndex === -1 || projectsIndex + 1 >= parts.length) {
    return null;
  }

  const id = parseInt(parts[projectsIndex + 1], 10);
  return Number.isNaN(id) ? null : id;
}




import { authFetch } from "../../auth";

export async function fetch_all_attempts() {
  const projectId = getCurrentProjectIdFromLocation();
  if (!projectId) {
    throw new Error("No projectId in URL for attempts");
  }

  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/attempts/`,
    { method: "GET" }
  );

  if (!res.ok) {
    throw new Error("Could not load attempts for this project");
  }

  const data = await res.json();

  // Be robust: if it’s already an array, return it; otherwise use data.attempts
  if (Array.isArray(data)) {
    return data;
  }

  return data.attempts || [];
}






export async function add_attempt_dependency(vortakt_attempt_id, nachtakt_attempt_id) {
  const projectId = getCurrentProjectIdFromLocation();
  if (!projectId) {
    throw new Error("No projectId in URL for attempts");
  }

  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/attempt_dependencies/`,
    {
      method: "POST",
      body: JSON.stringify({ vortakt_attempt_id, nachtakt_attempt_id }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to add attempt dependency");
  }

  return await res.json();
}





export async function fetch_all_attempt_dependencies() {
  const projectId = getCurrentProjectIdFromLocation();
  if (!projectId) {
    throw new Error("No projectId in URL for attempts");
  }

  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/attempt_dependencies/`,
    { method: "GET" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch attempt dependencies");
  }

  return await res.json();
}





export async function update_attempt_slot_index(attempt_id, slot_index) {
  const projectId = getCurrentProjectIdFromLocation();
  if (!projectId) {
    throw new Error("No projectId in URL for attempts");
  }

  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/attempts/update_slot_index/`,
    {
      method: "POST",
      body: JSON.stringify({ attempt_id, slot_index }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to update attempt slot_index");
  }

  return await res.json();
}





export async function delete_attempt_dependency(dependency_id) {
  const projectId = getCurrentProjectIdFromLocation();
  if (!projectId) {
    throw new Error("No projectId in URL for attempts");
  }

  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/attempt_dependencies/delete/`,
    {
      method: "POST",
      body: JSON.stringify({ dependency_id }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to delete attempt dependency");
  }

  return await res.json();
}






export async function fetchTeamsForProject() {

    const projectId = getCurrentProjectIdFromLocation();
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch teams for project");
  }

  return await res.json();
}

// export async function createTeamForProject(payload) {
//     const projectId = getCurrentProjectIdFromLocation();
 
//     const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/`, {
//     method: "POST",
//     body: JSON.stringify(payload),
//     // Content-Type setzt authFetch automatisch
//   });

//   if (!res.ok) {
//     throw new Error("Failed to create team");
//   }

//   return await res.json();
// }







// import { authFetch } from "../auth"; // hast du ja schon

// 🔹 Nur die Teams dieses Projekts (für ProjectAttempts, etc.)
export async function fetchTeamsForCurrentProject() {
  const projectId = getCurrentProjectIdFromLocation();
  if (!projectId) {
    throw new Error("No projectId in URL for teams");
  }

  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/teams/`,
    { method: "GET" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch teams for current project");
  }

  const data = await res.json();
  // dein View gibt direkt ein Array von Teams zurück
  // => einfach so zurückgeben
  return data;
}










