import { BASE_URL } from "../config/api"
import { redirect } from "react-router-dom";



export async function fetch_all_teams() {
    const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_teams/`)

    if (!res.ok) {
        console.log("Something went wrong")
        return
    }

    const data = await res.json()

    console.log("Called sucesfully and here is data: ", data)
    return data.teams

}





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
    console.log("The fetched tasks from the API", data.tasks)
    // const dummy = {"task1": "task1 data", "task2": "task2 data"}
    return data.tasks
}





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









