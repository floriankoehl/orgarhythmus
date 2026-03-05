import { authFetch } from '../auth';
import { BASE_URL } from '../config/api';

/**
 * Call the backend OpenAI proxy to generate an AI response from an assembled prompt.
 * Returns the parsed JSON object from the AI response.
 *
 * @param {string} promptText – assembled prompt text
 * @returns {Promise<object>} – parsed JSON from the AI response
 */
export async function aiGenerate(promptText) {
  const res = await authFetch(`${BASE_URL}/api/ai/generate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  const { content } = await res.json();

  // Strip markdown code fences, then JSON.parse
  let jsonStr = (content || "").trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${e.message}`);
  }

  return parsed;
}

// ── localStorage helpers for "Direct AI" mode toggle ──

const DIRECT_MODE_KEY = "ai_direct_mode";

export function getDirectMode() {
  return localStorage.getItem(DIRECT_MODE_KEY) === "true";
}

export function setDirectMode(enabled) {
  localStorage.setItem(DIRECT_MODE_KEY, String(enabled));
}
