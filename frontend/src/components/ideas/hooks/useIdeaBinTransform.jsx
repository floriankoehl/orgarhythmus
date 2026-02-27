import { useState, useEffect, useCallback } from "react";
import { createTaskForProject, createTeamForProject, fetchTeamsForProject, fetch_all_projects } from "../../../api/org_API";
import { add_milestone, fetch_project_tasks, delete_task, delete_team, delete_milestone } from "../../../api/dependencies_api";
import { playSound } from "../../../assets/sound_registry";
import { authFetch, API } from "../api/authFetch";
import { batchSetArchiveApi } from "../api/ideaApi";

/**
 * Manages the Transform (idea → task/milestone) and Reform (category → team)
 * modals, including the dep-refactor-drop event listener that converts
 * milestones/tasks/teams back into ideas.
 *
 * @param {object} deps
 * @returns transform/reform state + actions
 */
export default function useIdeaBinTransform(deps) {
  const {
    projectId,
    ideas,
    categories,
    categoryOrders,
    selectedCategoryIds,
    setConfirmModal,
    fetch_all_ideas,
    delete_idea,
    delete_category,
  } = deps;

  // ───── Transform modal state ─────
  const [transformModal, setTransformModal] = useState(null);
  const [transformName, setTransformName] = useState("");
  const [transformTeamId, setTransformTeamId] = useState(null);
  const [transformTaskId, setTransformTaskId] = useState(null);
  const [transformTaskSearch, setTransformTaskSearch] = useState("");
  const [projectTeams, setProjectTeams] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [transformLoading, setTransformLoading] = useState(false);

  // ───── Reform category → team modal state ─────
  const [reformCategoryModal, setReformCategoryModal] = useState(null);
  const [reformLoading, setReformLoading] = useState(false);

  // ── Fetch teams & tasks when transform modal opens ──
  useEffect(() => {
    if (transformModal && projectId) {
      fetchTeamsForProject(projectId).then(data => {
        const teams = data?.teams || data || [];
        setProjectTeams(teams);
      }).catch(() => {});
      fetch_project_tasks(projectId).then(data => {
        const raw = data?.tasks || data || [];
        const tasks = Array.isArray(raw) ? raw : Object.values(raw);
        setProjectTasks(tasks);
      }).catch(() => {});
    }
  }, [transformModal, projectId]);

  // ── Listen for dep-refactor-drop events (Dependencies → IdeaBin reverse transform) ──
  useEffect(() => {
    const handleRefactorDrop = (e) => {
      const { type, id, name, description, color, taskIds, milestones: milestonesPayload } = e.detail || {};
      if (!type || !id) return;

      if (type === "milestone") {
        const mName = name || "Milestone";
        const mDesc = description || "";
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">🏁 Refactor Milestone → Idea?</p>
              <p className="text-xs text-gray-600">
                Convert milestone <span className="font-semibold">"{mName}"</span> into an idea.
                The milestone will be <span className="text-red-600 font-semibold">deleted</span> from the dependency view.
              </p>
            </div>
          ),
          confirmLabel: "Convert to Idea",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: async () => {
            try {
              await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idea_name: mName, description: mDesc }),
              });
              await delete_milestone(projectId, id);
              playSound('ideaRefactor');
              window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              fetch_all_ideas();
            } catch (err) {
              console.error("Refactor milestone failed:", err);
            }
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      } else if (type === "task") {
        const tName = name || "Task";
        const tDesc = description || "";
        const mList = milestonesPayload || [];
        let ideaDesc = tDesc;
        if (mList.length > 0) {
          const msText = mList.map(m => `${m.name || "Milestone"}${m.description ? ": " + m.description : ""}`).join("\n\n");
          ideaDesc = ideaDesc ? `${ideaDesc}\n\nMilestones:\n${msText}` : `Milestones:\n${msText}`;
        }
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">📋 Refactor Task → Idea?</p>
              <p className="text-xs text-gray-600">
                Convert task <span className="font-semibold">"{tName}"</span> into an idea.
                The task and its <span className="font-semibold">{mList.length} milestone{mList.length !== 1 ? "s" : ""}</span> will be <span className="text-red-600 font-semibold">deleted</span>.
              </p>
            </div>
          ),
          confirmLabel: "Convert to Idea",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: async () => {
            try {
              await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idea_name: tName, description: ideaDesc }),
              });
              await delete_task(projectId, id);
              playSound('ideaRefactor');
              window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              fetch_all_ideas();
            } catch (err) {
              console.error("Refactor task failed:", err);
            }
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      } else if (type === "team") {
        const teamName = name || "Team";
        const tIds = taskIds || [];
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">🏢 Refactor Team → Idea?</p>
              <p className="text-xs text-gray-600">
                Convert team <span className="font-semibold" style={{ color: color || "#94a3b8" }}>"{teamName}"</span> into an idea.
                The team will be <span className="text-red-600 font-semibold">deleted</span>.
                {tIds.length > 0 && <> Its <span className="font-semibold">{tIds.length} task{tIds.length !== 1 ? "s" : ""}</span> will become unassigned.</>}
              </p>
            </div>
          ),
          confirmLabel: "Convert to Idea",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: async () => {
            try {
              await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idea_name: teamName,
                  description: tIds.length > 0 ? `Team with ${tIds.length} task(s)` : "",
                }),
              });
              await delete_team(projectId, id);
              playSound('ideaRefactor');
              window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              fetch_all_ideas();
            } catch (err) {
              console.error("Refactor team failed:", err);
            }
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      }
    };
    window.addEventListener("dep-refactor-drop", handleRefactorDrop);
    return () => window.removeEventListener("dep-refactor-drop", handleRefactorDrop);
  }, [projectId]);

  // ── Transform handlers ──
  const openTransform = (idea) => {
    setTransformModal({ idea, step: 'choose' });
    setTransformName(idea.title.split(/\s+/).slice(0, 6).join(" "));
    setTransformTeamId(null);
    setTransformTaskId(null);
    setTransformTaskSearch("");
  };

  const closeTransform = () => {
    setTransformModal(null);
    setTransformName("");
    setTransformTeamId(null);
    setTransformTaskId(null);
    setTransformTaskSearch("");
    setTransformLoading(false);
  };

  const executeTransformToTask = async () => {
    if (!transformName.trim() || !transformTeamId) return;
    setTransformLoading(true);
    try {
      await createTaskForProject(projectId, {
        name: transformName.trim(),
        description: transformModal.idea.description || "",
        team_id: transformTeamId,
      });
      await delete_idea(transformModal.idea.id);
      playSound('ideaTransform');
      closeTransform();
    } catch (err) {
      console.error("Transform to task failed:", err);
      setTransformLoading(false);
    }
  };

  const executeTransformToMilestone = async () => {
    if (!transformName.trim() || !transformTaskId) return;
    setTransformLoading(true);
    try {
      await add_milestone(projectId, transformTaskId, {
        name: transformName.trim(),
        description: transformModal.idea.description || "",
      });
      await delete_idea(transformModal.idea.id);
      playSound('ideaTransform');
      closeTransform();
    } catch (err) {
      console.error("Transform to milestone failed:", err);
      setTransformLoading(false);
    }
  };

  // ── Reform category → team ──
  const openReformCategory = async (catKey, catData) => {
    const isInSelection = selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey));
    let catList;
    if (isInSelection && selectedCategoryIds.size > 1) {
      catList = [...selectedCategoryIds].map(id => {
        const cat = categories[id];
        return cat ? { id, name: cat.name } : null;
      }).filter(Boolean);
    } else {
      catList = [{ id: catKey, name: catData.name }];
    }

    let autoProjectId = null;
    let projects = null;

    if (projectId) {
      autoProjectId = projectId;
    } else {
      try {
        const allProjects = await fetch_all_projects();
        projects = (allProjects || []).map(p => ({ id: p.id, name: p.name }));
      } catch {
        projects = [];
      }
    }

    setReformCategoryModal({
      categories: catList,
      step: 'confirm',
      autoProjectId,
      selectedProjectId: null,
      projects,
    });
  };

  const closeReformCategory = () => {
    setReformCategoryModal(null);
    setReformLoading(false);
  };

  const executeReformCategory = async ({ takeIdeas, deleteAndArchive }) => {
    if (!reformCategoryModal) return;
    const { categories: catList, autoProjectId, selectedProjectId } = reformCategoryModal;
    const targetProjectId = autoProjectId || selectedProjectId;
    if (!targetProjectId) return;
    if (!catList || catList.length === 0) return;
    setReformLoading(true);
    try {
      for (const cat of catList) {
        const team = await createTeamForProject(targetProjectId, { name: cat.name });

        if (takeIdeas) {
          const ideaIds = categoryOrders[cat.id] || [];
          for (const ideaId of ideaIds) {
            const idea = ideas[ideaId];
            if (idea) {
              await createTaskForProject(targetProjectId, {
                name: idea.title || "Untitled",
                description: idea.description || "",
                team_id: team.id,
              });
            }
          }
        }

        if (deleteAndArchive) {
          const ideaIds = categoryOrders[cat.id] || [];
          if (ideaIds.length > 0) {
            await batchSetArchiveApi(ideaIds, true);
          }
          await delete_category(cat.id);
        }
      }

      playSound('ideaTransform');
      closeReformCategory();
      await fetch_all_ideas();
    } catch (err) {
      console.error("Reform category to team failed:", err);
      setReformLoading(false);
    }
  };

  return {
    // Transform state
    transformModal, setTransformModal,
    transformName, setTransformName,
    transformTeamId, setTransformTeamId,
    transformTaskId, setTransformTaskId,
    transformTaskSearch, setTransformTaskSearch,
    projectTeams, projectTasks,
    transformLoading,
    // Transform actions
    openTransform, closeTransform,
    executeTransformToTask, executeTransformToMilestone,
    // Reform state
    reformCategoryModal, setReformCategoryModal,
    reformLoading,
    // Reform actions
    openReformCategory, closeReformCategory, executeReformCategory,
  };
}
