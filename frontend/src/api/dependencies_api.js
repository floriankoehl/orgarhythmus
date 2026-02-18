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


export async function add_milestone(projectId, task_id, { name, description, start_index } = {}) {
    const res = await authFetch(`/api/projects/${projectId}/add_milestone/`, {
        method: "POST",
        body: JSON.stringify({
            task_id: task_id,
            ...(name ? { name } : {}),
            ...(description ? { description } : {}),
            ...(start_index !== undefined ? { start_index } : {}),
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


export async function rename_milestone(projectId, milestone_id, new_name) {
    const res = await authFetch(`/api/projects/${projectId}/rename_milestone/`, {
        method: "PATCH",
        body: JSON.stringify({
            id: milestone_id,
            name: new_name
        })
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Rename failed (${res.status}): ${text}`)
    }

    return await res.json()
}


// Dependencies (connections between milestones)

export async function get_all_dependencies(projectId){
    const res = await authFetch(`/api/projects/${projectId}/get_all_dependencies/`)
    if (!res.ok) throw new Error('Failed to fetch dependencies');
    const answer = await res.json()
    return answer
}

export async function create_dependency(projectId, sourceId, targetId, { weight, reason } = {}){
    const body = {
        source: sourceId,
        target: targetId,
    };
    if (weight) body.weight = weight;
    if (reason !== undefined) body.reason = reason;

    const res = await authFetch(`/api/projects/${projectId}/create_dependency/`, {
        method: "POST",
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error('Failed to create dependency');
    const answer = await res.json()
    return answer
}

export async function update_dependency(projectId, sourceId, targetId, updates = {}){
    const body = {
        source: sourceId,
        target: targetId,
        ...updates,
    };
    const res = await authFetch(`/api/projects/${projectId}/update_dependency/`, {
        method: "PATCH",
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error('Failed to update dependency');
    const answer = await res.json()
    return answer
}

export async function delete_dependency_api(projectId, source_milestone_id, target_milestone_id) {
    const response = await authFetch(`/api/projects/${projectId}/delete_dependency/`, {
        method: 'DELETE',
        body: JSON.stringify({
            source: source_milestone_id,
            target: target_milestone_id
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete dependency: ${errorText}`);
    }
    
    // Backend returns 204 No Content on success
    if (response.status === 204) {
        return { deleted: true };
    }
    
    return response.json();
}

export async function reorder_team_tasks(projectId, taskId, targetTeamId, order) {
    const res = await authFetch(`/api/projects/${projectId}/reorder_team_tasks/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            task_id: taskId,
            target_team_id: targetTeamId,
            order: order,
        }),
    });
    if (!res.ok) throw new Error('Failed to reorder tasks');
    return await res.json();
}


// Task deadlines

export async function set_task_deadline(projectId, taskId, hardDeadline) {
    const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/set_deadline/`, {
        method: "PATCH",
        body: JSON.stringify({
            hard_deadline: hardDeadline  // integer day index or null to clear
        })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to set deadline');
    }
    return await res.json();
}


// Days

export async function get_project_days(projectId) {
    const res = await authFetch(`/api/projects/${projectId}/days/`)
    if (!res.ok) throw new Error('Failed to fetch project days');
    return await res.json()
}

export async function update_day(projectId, dayIndex, data) {
    const res = await authFetch(`/api/projects/${projectId}/days/${dayIndex}/`, {
        method: "PATCH",
        body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to update day');
    return await res.json()
}

export async function set_day_purpose(projectId, dayIndex, purpose, purposeTeams = null) {
    const res = await authFetch(`/api/projects/${projectId}/days/set_purpose/`, {
        method: "POST",
        body: JSON.stringify({
            day_index: dayIndex,
            purpose: purpose,
            purpose_teams: purposeTeams
        })
    })
    if (!res.ok) throw new Error('Failed to set day purpose');
    return await res.json()
}

export async function validate_project_dates(projectId, startDate, endDate) {
    const res = await authFetch(`/api/projects/${projectId}/validate_dates/`, {
        method: "POST",
        body: JSON.stringify({
            start_date: startDate,
            end_date: endDate
        })
    })
    if (!res.ok) throw new Error('Failed to validate dates');
    return await res.json()
}

export async function sync_project_days(projectId) {
    const res = await authFetch(`/api/projects/${projectId}/sync_days/`, {
        method: "POST"
    })
    if (!res.ok) throw new Error('Failed to sync days');
    return await res.json()
}


// ── Refactor mode: delete task / delete team ──

export async function delete_task(projectId, taskId) {
    const res = await authFetch(`/api/projects/${projectId}/tasks/${taskId}/delete/`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Delete task failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return null;
    return await res.json();
}

export async function delete_team(projectId, teamId) {
    const res = await authFetch(`/api/projects/${projectId}/teams/${teamId}/`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Delete team failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return null;
    return await res.json();
}


// ════════════════════════════════════════════
// Phases (timeline phases / named timeframes)
// ════════════════════════════════════════════

export async function get_all_phases(projectId) {
    const res = await authFetch(`/api/projects/${projectId}/phases/`);
    if (!res.ok) throw new Error('Failed to fetch phases');
    return await res.json();
}

export async function create_phase(projectId, data) {
    const res = await authFetch(`/api/projects/${projectId}/phases/create/`, {
        method: "POST",
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create phase');
    return await res.json();
}

export async function update_phase(projectId, phaseId, updates) {
    const res = await authFetch(`/api/projects/${projectId}/phases/${phaseId}/`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update phase');
    return await res.json();
}

export async function delete_phase(projectId, phaseId) {
    const res = await authFetch(`/api/projects/${projectId}/phases/${phaseId}/delete/`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error('Failed to delete phase');
    return await res.json();
}


// ════════════════════════════════════════════
// Dependency Views (saved frontend state)
// ════════════════════════════════════════════

export async function get_all_views(projectId) {
    const res = await authFetch(`/api/projects/${projectId}/views/`);
    if (!res.ok) throw new Error('Failed to fetch views');
    const data = await res.json();
    return data.views || data;
}

export async function create_view(projectId, { name, state }) {
    const res = await authFetch(`/api/projects/${projectId}/views/create/`, {
        method: "POST",
        body: JSON.stringify({ name, state }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create view');
    }
    const data = await res.json();
    return data.view || data;
}

export async function update_view(projectId, viewId, updates) {
    const res = await authFetch(`/api/projects/${projectId}/views/${viewId}/`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update view');
    }
    const data = await res.json();
    return data.view || data;
}

export async function delete_view(projectId, viewId) {
    const res = await authFetch(`/api/projects/${projectId}/views/${viewId}/delete/`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error('Failed to delete view');
    return await res.json();
}

export async function set_default_view(projectId, viewId) {
    const res = await authFetch(`/api/projects/${projectId}/views/set-default/`, {
        method: "POST",
        body: JSON.stringify({ view_id: viewId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to set default view');
    }
    const data = await res.json();
    return data.views || data;
}


// ═══════════════════════ Project Snapshots ═══════════════════════

export async function list_snapshots(projectId) {
    const res = await authFetch(`/api/projects/${projectId}/snapshots/`);
    if (!res.ok) throw new Error('Failed to list snapshots');
    return await res.json();
}

export async function create_snapshot(projectId, { name, description } = {}) {
    const res = await authFetch(`/api/projects/${projectId}/snapshots/create/`, {
        method: "POST",
        body: JSON.stringify({ name, description: description || "" }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create snapshot');
    }
    return await res.json();
}

export async function get_snapshot(projectId, snapshotId) {
    const res = await authFetch(`/api/projects/${projectId}/snapshots/${snapshotId}/`);
    if (!res.ok) throw new Error('Failed to get snapshot');
    return await res.json();
}

export async function restore_snapshot(projectId, snapshotId) {
    const res = await authFetch(`/api/projects/${projectId}/snapshots/${snapshotId}/restore/`, {
        method: "POST",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to restore snapshot');
    }
    return await res.json();
}

export async function delete_snapshot(projectId, snapshotId) {
    const res = await authFetch(`/api/projects/${projectId}/snapshots/${snapshotId}/delete/`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error('Failed to delete snapshot');
    return await res.json();
}

export async function rename_snapshot(projectId, snapshotId, { name, description } = {}) {
    const res = await authFetch(`/api/projects/${projectId}/snapshots/${snapshotId}/rename/`, {
        method: "PATCH",
        body: JSON.stringify({ ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to rename snapshot');
    }
    return await res.json();
}