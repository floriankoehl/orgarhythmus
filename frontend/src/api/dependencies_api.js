import { BASE_URL } from '../config/api';
import { authFetch } from '../auth';

const API = `${BASE_URL}/api`;



export async function fetch_project_details(projectId){
    const res = await authFetch(`/api/projects/${projectId}/get_project_details/`)
    if (!res.ok) throw new Error('Failed to fetch project details');
    const answer = await res.json()
    return answer
}




export async function fetch_project_teams(projectId){
    const res = await authFetch(`/api/projects/${projectId}/fetch_project_teams/`)
    if (!res.ok) throw new Error('Failed to fetch project teams');
    const answer = await res.json()
    return answer
}

export async function safe_team_order(projectId, new_order){
    const res = await authFetch(`/api/projects/${projectId}/safe_team_order/`, {
        method: "PATCH",
        body: JSON.stringify({
            order: new_order
        })
    })
    if (!res.ok) throw new Error('Failed to save team order');
    const answer = res.json()
    return answer
}

export async function fetch_project_tasks(projectId){
    const res = await authFetch(`/api/projects/${projectId}/fetch_project_tasks/`)
    if (!res.ok) throw new Error('Failed to fetch project tasks');
    const answer = await res.json()
    return answer
}



// Milestones 


export async function get_all_milestones(projectId){
    const res = await authFetch(`/api/projects/${projectId}/get_all_milestones/`)
    if (!res.ok) throw new Error('Failed to fetch milestones');
    const answer = await res.json()
    return answer
}


export async function add_milestone(projectId, task_id) {
    const res = await authFetch(`/api/projects/${projectId}/add_milestone/`, {
        method: "POST",
        body: JSON.stringify({
            task_id: task_id
        })
    })
    if (!res.ok) throw new Error('Failed to add milestone');
    const answer = await res.json()
    return answer
}



export async function update_start_index(projectId, milestone_id, index) {
    const res = await authFetch(`/api/projects/${projectId}/update_start_index/`, {
        method: "PATCH",
        body: JSON.stringify({
            milestone_id: milestone_id,
            index: index
        })
    })
    if (!res.ok) throw new Error('Failed to update start index');
    const answer = await res.json()
    return answer
}



export async function delete_milestone(projectId, milestone_id){
    const res = await authFetch(`/api/projects/${projectId}/delete_milestones/`, {
        method: "DELETE",
        body: JSON.stringify({
            id: milestone_id
        })
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Delete failed (${res.status}): ${text}`)
    }

    if (res.status === 204) return null

    return await res.json()
}






export async function change_duration(projectId, milestone_id, duration_change){
    const res = await authFetch(`/api/projects/${projectId}/change_duration/`, {
        method: "PATCH",
        body: JSON.stringify({
            id: milestone_id,
            change: duration_change
        })
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`UPDATE failed (${res.status}): ${text}`)
    }

    if (res.status === 200) {
        return await res.json()
    }

    return null
}



// Dependencies (connections between milestones)

export async function get_all_dependencies(projectId){
    const res = await authFetch(`/api/projects/${projectId}/get_all_dependencies/`)
    if (!res.ok) throw new Error('Failed to fetch dependencies');
    const answer = await res.json()
    return answer
}

export async function create_dependency(projectId, sourceId, targetId){
    const res = await authFetch(`/api/projects/${projectId}/create_dependency/`, {
        method: "POST",
        body: JSON.stringify({
            source: sourceId,
            target: targetId
        })
    })
    if (!res.ok) throw new Error('Failed to create dependency');
    const answer = await res.json()
    return answer
}

export async function delete_dependency_api(projectId, sourceId, targetId){
    const res = await authFetch(`/api/projects/${projectId}/delete_dependency/`, {
        method: "DELETE",
        body: JSON.stringify({
            source: sourceId,
            target: targetId
        })
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Delete dependency failed (${res.status}): ${text}`)
    }

    if (res.status === 204) return null
    return await res.json()
}