import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchTeamsForProject,
  createTeamForProject,
  deleteTeamForProject,
  updateTeam,
  reorder_project_teams,
} from "../../../api/org_API";
import { emitDataEvent, useDataRefresh } from "../../../api/dataEvents";

/**
 * Manages team CRUD, canvas positioning, and reordering for the Task Structure page.
 *
 * Teams on canvas have spatial positions (x, y, width, height) stored in localStorage
 * keyed by projectId, since positions are a UI concern not persisted in the backend.
 */
const CANVAS_STORAGE_KEY = (projectId) => `ts_team_canvas_${projectId}`;

function loadCanvasState(projectId) {
  try {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY(projectId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCanvasState(projectId, positions) {
  try {
    localStorage.setItem(CANVAS_STORAGE_KEY(projectId), JSON.stringify(positions));
  } catch { /* ignore */ }
}

export default function useTaskTeams({ projectId, selectedTeamIds, tasksRef }) {
  const [teams, setTeams] = useState({});            // { id: teamObj }
  const [teamOrder, setTeamOrder] = useState([]);     // ordered team ids
  const [teamPositions, setTeamPositions] = useState({});  // { id: {x,y,w,h,z} }
  const [loading, setLoading] = useState(false);
  const nextZ = useRef(1);
  const _mutingRef = useRef(false);

  // Ref for selected team IDs (used in drag/resize closures)
  const selectedTeamIdsRef = useRef(new Set());
  useEffect(() => { selectedTeamIdsRef.current = selectedTeamIds || new Set(); }, [selectedTeamIds]);

  // ── Fetch teams ──
  const fetchTeams = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchTeamsForProject(projectId);
      const list = res.teams || res || [];
      const map = {};
      const order = [];
      for (const t of list) {
        map[t.id] = t;
        order.push(t.id);
      }
      setTeams(map);
      setTeamOrder(order);

      // Load canvas positions from localStorage, create defaults for new teams
      const stored = loadCanvasState(projectId);
      const positions = {};
      let col = 0;
      for (const t of list) {
        if (stored[t.id]) {
          positions[t.id] = stored[t.id];
          if (stored[t.id].z >= nextZ.current) nextZ.current = stored[t.id].z + 1;
        } else {
          positions[t.id] = {
            x: 20 + col * 260,
            y: 20,
            w: 240,
            h: 300,
            z: nextZ.current++,
          };
          col++;
        }
      }
      setTeamPositions(positions);
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
    setLoading(false);
  }, [projectId]);

  // ── Create team ──
  const createTeam = useCallback(async (name, color) => {
    if (!projectId) return null;
    try {
      const res = await createTeamForProject(projectId, { name, color: color || "#6366f1" });
      const team = res.team || res;
      setTeams((prev) => ({ ...prev, [team.id]: team }));
      setTeamOrder((prev) => [...prev, team.id]);

      // Place new team in the visible area using a wrapping grid layout
      const TEAM_W = 240, TEAM_H = 300, GAP = 20, VISIBLE_W = 900;
      const cols = Math.max(1, Math.floor((VISIBLE_W - GAP) / (TEAM_W + GAP)));
      const idx = Object.keys(teamPositions).length;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = GAP + col * (TEAM_W + GAP);
      const y = GAP + row * (TEAM_H + GAP);

      setTeamPositions((prev) => {
        const next = { ...prev, [team.id]: { x, y, w: TEAM_W, h: TEAM_H, z: nextZ.current++ } };
        saveCanvasState(projectId, next);
        return next;
      });
      _mutingRef.current = true;
      emitDataEvent('teams');
      return team;
    } catch (err) {
      console.error("Failed to create team:", err);
      return null;
    }
  }, [projectId, teamPositions]);

  // ── Update team ──
  const updateTeamApi = useCallback(async (teamId, payload) => {
    if (!projectId) return null;
    try {
      const res = await updateTeam(projectId, teamId, payload);
      const updated = res.team || res;
      setTeams((prev) => ({ ...prev, [teamId]: { ...prev[teamId], ...updated } }));
      _mutingRef.current = true;
      emitDataEvent('teams');
      return updated;
    } catch (err) {
      console.error("Failed to update team:", err);
      return null;
    }
  }, [projectId]);

  // ── Create team at a specific canvas position (for draw-to-create) ──
  const createTeamAt = useCallback(async (name, color, pos) => {
    if (!projectId) return null;
    try {
      const res = await createTeamForProject(projectId, { name, color: color || "#6366f1" });
      const team = res.team || res;
      setTeams((prev) => ({ ...prev, [team.id]: team }));
      setTeamOrder((prev) => [...prev, team.id]);
      setTeamPositions((prev) => {
        const next = {
          ...prev,
          [team.id]: {
            x: pos.x,
            y: pos.y,
            w: Math.max(180, pos.w || 240),
            h: Math.max(120, pos.h || 300),
            z: nextZ.current++,
          },
        };
        saveCanvasState(projectId, next);
        return next;
      });
      _mutingRef.current = true;
      emitDataEvent('teams');
      return team;
    } catch (err) {
      console.error("Failed to create team at position:", err);
      return null;
    }
  }, [projectId]);

  // ── Delete team (tasks become unassigned) ──
  const deleteTeam = useCallback(async (teamId) => {
    if (!projectId) return;
    try {
      await deleteTeamForProject(projectId, teamId);
      setTeams((prev) => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
      setTeamOrder((prev) => prev.filter((id) => id !== teamId));
      setTeamPositions((prev) => {
        const next = { ...prev };
        delete next[teamId];
        saveCanvasState(projectId, next);
        return next;
      });
      _mutingRef.current = true;
      emitDataEvent('teams');
    } catch (err) {
      console.error("Failed to delete team:", err);
    }
  }, [projectId]);

  // ── Canvas position helpers ──
  const setTeamPosition = useCallback((teamId, pos) => {
    setTeamPositions((prev) => {
      const next = { ...prev, [teamId]: { ...prev[teamId], ...pos } };
      saveCanvasState(projectId, next);
      return next;
    });
  }, [projectId]);

  const bringToFront = useCallback((teamId) => {
    setTeamPositions((prev) => {
      const next = { ...prev, [teamId]: { ...prev[teamId], z: nextZ.current++ } };
      saveCanvasState(projectId, next);
      return next;
    });
  }, [projectId]);

  // ── Drag team on canvas (supports multi-team + click detection) ──
  const handleTeamDrag = useCallback((e, teamId, onClickCallback) => {
    e.preventDefault();
    bringToFront(teamId);
    const startX = e.clientX;
    const startY = e.clientY;

    // Determine which teams to move
    const selected = selectedTeamIdsRef.current;
    const ids = selected?.has(teamId) && selected.size > 1
      ? [...selected] : [teamId];

    // Capture start positions for all affected teams
    const startPositions = {};
    for (const id of ids) {
      startPositions[id] = { ...(teamPositions[id] || { x: 0, y: 0 }) };
    }

    let didMove = false;
    let overIdeaBin = false;

    // Pipeline ghost (DOM element that floats above both windows)
    let pipelineGhost = null;
    const pipelineActive = document.querySelector("[data-pipeline-active]");
    if (pipelineActive && ids.length === 1) {
      const team = teams[teamId];
      pipelineGhost = document.createElement("div");
      pipelineGhost.style.cssText = `position:fixed;z-index:100000;pointer-events:none;padding:6px 14px;border-radius:8px;background:rgba(245,158,11,0.92);color:#fff;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.25);transform:translate(12px,12px);`;
      pipelineGhost.textContent = `\ud83d\udc65 ${team?.name || "Team"}`;
      pipelineGhost.style.left = `${startX}px`;
      pipelineGhost.style.top = `${startY}px`;
      document.body.appendChild(pipelineGhost);
    }

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove = true;
      if (!didMove) return;

      // Update pipeline ghost position
      if (pipelineGhost) {
        pipelineGhost.style.left = `${ev.clientX}px`;
        pipelineGhost.style.top = `${ev.clientY}px`;
      }

      // When pipeline ghost is active, only move the ghost — don't move the canvas container
      if (!pipelineGhost) {
        setTeamPositions((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            const sp = startPositions[id];
            next[id] = { ...next[id], x: Math.max(0, sp.x + dx), y: Math.max(0, sp.y + dy) };
          }
          saveCanvasState(projectId, next);
          return next;
        });
      }

      // Pipeline: detect IdeaBin window
      const pa = document.querySelector("[data-pipeline-active]");
      const ibWin = document.querySelector("[data-ideabin-window]");
      if (pa && ibWin) {
        const r = ibWin.getBoundingClientRect();
        const over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        overIdeaBin = over;
        ibWin.style.outline = over ? "3px solid #f59e0b" : "";
        ibWin.style.outlineOffset = over ? "-3px" : "";
      } else {
        overIdeaBin = false;
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // Remove pipeline ghost
      if (pipelineGhost) { pipelineGhost.remove(); pipelineGhost = null; }
      // Clean up highlight
      const ibWin = document.querySelector("[data-ideabin-window]");
      if (ibWin) { ibWin.style.outline = ""; ibWin.style.outlineOffset = ""; }

      if (overIdeaBin && ids.length === 1) {
        const team = teams[teamId];
        // Gather full task data from tasksRef
        const allTasks = tasksRef?.current || {};
        const taskData = Object.values(allTasks)
          .filter((t) => (t.team?.id ?? t.team) === teamId)
          .map((t) => ({
            name: t.name,
            description: t.description || "",
            acceptance_criteria: t.acceptance_criteria || [],
          }));
        window.dispatchEvent(new CustomEvent("pipeline-team-to-category", {
          detail: { teamId, name: team?.name || "Team", tasks: taskData },
        }));
        return;
      }
      if (!didMove && onClickCallback) onClickCallback();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [teamPositions, teams, bringToFront, projectId, tasksRef]);

  // ── Resize team container (supports multi-team) ──
  const handleTeamResize = useCallback((e, teamId) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;

    // Determine which teams to resize
    const selected = selectedTeamIdsRef.current;
    const ids = selected?.has(teamId) && selected.size > 1
      ? [...selected] : [teamId];

    const startPositions = {};
    for (const id of ids) {
      startPositions[id] = { ...(teamPositions[id] || { w: 240, h: 300 }) };
    }

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setTeamPositions((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          const sp = startPositions[id];
          next[id] = { ...next[id],
            w: Math.max(180, (sp.w || 240) + dx),
            h: Math.max(120, (sp.h || 300) + dy),
          };
        }
        saveCanvasState(projectId, next);
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [teamPositions, projectId]);

  // ── Cross-window sync: refetch when another window mutates teams ──
  useDataRefresh(['teams'], fetchTeams, _mutingRef);

  // Initial fetch
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    setTeams,
    teamOrder,
    setTeamOrder,
    teamPositions,
    setTeamPositions,
    loading,
    fetchTeams,
    createTeam,
    createTeamAt,
    updateTeamApi,
    deleteTeam,
    setTeamPosition,
    bringToFront,
    handleTeamDrag,
    handleTeamResize,
  };
}
