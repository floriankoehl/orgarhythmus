import { authFetch } from '../auth';

/**
 * Fetch current user's prompt settings.
 * Auto-creates the record if it doesn't exist yet.
 */
export async function fetchPromptSettings() {
  const res = await authFetch('/api/user/prompt-settings/');
  if (!res.ok) throw new Error('Failed to fetch prompt settings');
  return res.json();
}

/**
 * Patch (partial update) the user's prompt settings.
 * @param {Object} updates – any subset of { auto_add_system_prompt, auto_add_json_format, auto_add_scenario_prompt, system_prompt, scenario_prompts }
 */
export async function updatePromptSettings(updates) {
  const res = await authFetch('/api/user/prompt-settings/update/', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update prompt settings');
  }
  return res.json();
}
