import { BASE_URL } from "../config/api"
import { redirect } from "react-router-dom";





//_______________________________________________
//_______________________________________________
//____________________TASKS______________________
//_______________________________________________
//_______________________________________________


export async function fetch_all_tasks() {
    const token = localStorage.getItem("access_token");

    if (!token) {
    throw redirect("/login");
  }

    const res = await fetch(`${BASE_URL}/api/orgarhytmus/all_tasks/`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

    if (res.status === 401 || res.status === 403) {
    // Token invalid/expired or user not allowed
    throw redirect("/login");
  }

    if (!res.ok) {
    // Let React Router show the default error boundary or your custom one
    throw new Error("Could not load tasks");
  }

    const data = await res.json();
    // console.log("The fetched tasks from the API", data.tasks)
    // const dummy = {"task1": "task1 data", "task2": "task2 data"}
    return data.tasks
}

export async function create_task(name, difficulty, priority, approval, team_id) {
    const res = await fetch(`${BASE_URL}/api/orgarhytmus/create_task/`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({
            name: name,
            difficulty: difficulty,
            priority: priority,
            approval: approval,
            team_id: team_id || null,
        }),
    })

    if (!res.ok) {  // ✅ Better error check
        console.log("something went wrong");
        throw new Error("Failed to create task");
    }

    const data = await res.json();
    console.log("Successfully created");
    
    return data;  // ✅ Return the data
}

export async function delete_task(id) {
        const res = await fetch(`${BASE_URL}/api/orgarhytmus/delete_task/`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({ id }),
        })

        if (!res.ok) {
            console.log("Some Error")
            return
        }

        const data = await res.json();
        // setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
        console.log(data)

        return data
    }











//_______________________________________________
//_______________________________________________
//____________________TEAMS______________________
//_______________________________________________
//_______________________________________________

//ALL TEAMS
// export async function fetch_all_teams() {
//     const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_teams/`)

//     if (!res.ok) {
//         console.log("Something went wrong calling teams in api.js")
//         return
//     }

//     const data = await res.json()

//     // console.log("The fetched teams from api: ", data)
//     return data.teams

// }


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




export async function fetch_all_teams() {
    const projectId = getCurrentProjectIdFromLocation();
    const res = await fetch(`${BASE_URL}/api/orgarhythmus/${projectId}/all_teams_for_this_project/`)

    if (!res.ok) {
        console.log("Something went wrong calling teams in api.js")
        return
    }

    const data = await res.json()

    // console.log("The fetched teams from api: ", data)
    return data.teams

}







//_______________________________________________
//_______________________________________________
//________________DEPENDENCIES___________________
//_______________________________________________
//_______________________________________________


export async function all_dependencies(){
    const token = localStorage.getItem("access_token");

    if (!token) {
    throw redirect("/login");
  }

    const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_dependencies/`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

    if (res.status === 401 || res.status === 403) {
    // Token invalid/expired or user not allowed
    throw redirect("/login");
  }

    if (!res.ok) {
    // Let React Router show the default error boundary or your custom one
    throw new Error("Could not load dependencies");
  }

    const data = await res.json()
    console.log("ALLL DEPENDCENCIES", data)
    return data; 
}


export async function add_dependency(vortakt_id, nachtakt_id){
  const res = await fetch(`${BASE_URL}/api/orgarhythmus/add_dependency/`, {
    method: "POST", 
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ vortakt_id, nachtakt_id })
  });

  if (!res.ok) {
    throw new Error("Failed to add dependency");
  }

  const data = await res.json();
  return data;
}


export async function delete_dependency(dep_id){
    const token = localStorage.getItem("access_token");

    if (!token) {
        throw redirect("/login");
    }

    const res = await fetch(`${BASE_URL}/api/orgarhythmus/delete_dependency/`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "content-type": "application/json"
        },  
        body: JSON.stringify({ dep_id }),
    });

    if (res.status === 401 || res.status === 403) {
        throw redirect("/login");
    }

    if (!res.ok) {
        throw new Error("Could not delete dependency");
    }

    const data = await res.json();
    return data;  // ✅ Return the response
}





//_______________________________________________
//_______________________________________________
//________________ATTEMPTS___________________
//_______________________________________________
//_______________________________________________


export async function fetch_all_attempts(){
  const token = localStorage.getItem("access_token")

  if (!token) {
    throw redirect("/login")
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_attempts/`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error("Could not load tasks");
  }

  const data = await res.json();
  // console.log("The fetched attempts from the API", data)
  return data
}



// export async function add_attempt_dependecy(
//   vortakt_attempt_id,
//   nachtakt_attempt_id
// ){
//   const token = localStorage.getItem("access_token")

//   if (!token) {
//     throw redirect("/login")
//   }

//   const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_attempts/`, {
//     headers: {
//       "Authorization": `Bearer ${token}`
//     },
//     body: JSON.stringify({ vortakt_attempt_id, nachtakt_attempt_id })
//   })

//   if (!res.ok) {
//     throw new Error("Failed to add dependency");
//   }

//   const data = await res.json();
//   return data;


// }

export async function add_attempt_dependency(
  vortakt_attempt_id,
  nachtakt_attempt_id
) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw redirect("/login");
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/add_attempt_dependency/`, {
    method: "POST",                     // 👈 important
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vortakt_attempt_id, nachtakt_attempt_id }),
  });

  if (!res.ok) {
    console.error("Backend failed:", res.status);
    throw new Error("Failed to add dependency");
  }

  const data = await res.json();
  return data;
}






export async function fetch_all_attempt_dependencies() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw redirect("/login");
  }

  const res = await fetch(
    `${BASE_URL}/api/orgarhythmus/all_attempt_dependencies/`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch attempt dependencies");
  }

  return await res.json();
}






// export async function update_attempt_slot_index(attempt_id, slot_index) {
//   const token = localStorage.getItem("access_token");

//   if (!token) {
//     throw redirect("/login");
//   }

//   const res = await fetch(
//     `${BASE_URL}/api/orgarhythmus/update_attempt_slot_index/`,
//     {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ attempt_id, slot_index }),
//     }
//   );

//   if (!res.ok) {
//     console.error("Backend failed:", res.status);
//     throw new Error("Failed to update attempt slot_index");
//   }

//   return await res.json();
// }




export async function update_attempt_slot_index(attempt_id, slot_index) {
  const token = localStorage.getItem("access_token");
  if (!token) throw redirect("/login");

  const res = await fetch(
    `${BASE_URL}/api/orgarhythmus/update_attempt_slot_index/`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attempt_id, slot_index }),
    }
  );

  if (!res.ok) {
    console.error("Backend failed:", res.status);
    throw new Error("Failed to update attempt slot_index");
  }

  return await res.json();
}



export async function delete_attempt_dependency(dependency_id) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw redirect("/login");
  }

  const res = await fetch(
    `${BASE_URL}/api/orgarhythmus/delete_attempt_dependency/`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dependency_id }),
    }
  );

  if (!res.ok) {
    console.error("Backend failed:", res.status);
    throw new Error("Failed to delete attempt dependency");
  }

  return await res.json();
}






























//_______________________________________________
//_______________________________________________
//__________________PROJECTS_____________________
//_______________________________________________
//_______________________________________________

export async function fetch_all_projects() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw redirect("/login");
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/projects/`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw redirect("/login");
  }

  if (!res.ok) {
    throw new Error("Could not load projects");
  }

  return await res.json();
}

export async function create_project_api(name, description) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw redirect("/login");
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/projects/create/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw redirect("/login");
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    console.error("Create project failed:", errorBody);
    throw new Error(errorBody.detail || "Failed to create project");
  }

  return await res.json();
}








export async function fetch_project_detail(projectId) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw redirect("/login");
  }

  const res = await fetch(`${BASE_URL}/api/orgarhythmus/projects/${projectId}/`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw redirect("/login");
  }

  if (!res.ok) {
    throw new Error("Could not load project");
  }

  return await res.json();
}


import { authFetch } from "../auth";  // Pfad ggf. anpassen





//_____*********______________ TEAMS ___________________********____

//_______________________________________________

// orgarhythmus/org_API_teams.js


export async function fetchTeamsForProject(projectId) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch teams for project");
  }

  return await res.json();
}

export async function createTeamForProject(projectId, payload) {
  const res = await authFetch(`/api/orgarhythmus/projects/${projectId}/teams/`, {
    method: "POST",
    body: JSON.stringify(payload),
    // Content-Type setzt authFetch automatisch
  });

  if (!res.ok) {
    throw new Error("Failed to create team");
  }

  return await res.json();
}





















export async function fetchTasksForProject(projectId) {
  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/tasks/`,
    {
      method: "GET",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch tasks for project");
  }

  const data = await res.json();
  // falls dein Backend { tasks: [...] } zurückgibt, nimm data.tasks
  return data.tasks || data;
}

export async function createTaskForProject(projectId, payload) {
  const res = await authFetch(
    `/api/orgarhythmus/projects/${projectId}/tasks/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      // Content-Type kommt von authFetch
    }
  );

  if (!res.ok) {
    throw new Error("Failed to create project task");
  }

  return await res.json();
}



































