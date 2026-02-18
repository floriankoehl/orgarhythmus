

// Data loading and initialization logic for dependencies timeline
import { useState, useEffect } from 'react';
import {
  fetch_project_details,
  fetch_project_teams,
  fetch_project_tasks,
  get_all_milestones,
  get_all_dependencies,
  get_project_days,
  get_all_phases,
} from '../../api/dependencies_api.js';
import { daysBetween } from './layoutMath';

/**
 * Custom hook for loading and managing dependency timeline data.
 * Handles API fetching, data transformation, and state initialization.
 */
export function useDependencyData(projectId) {
  // Core project data
  const [days, setDays] = useState(null);
  const [projectStartDate, setProjectStartDate] = useState(null);
  const [projectDays, setProjectDays] = useState({}); // { dayIndex: { purpose, is_sunday, day_name_short, ... } }

  // Phases (named timeline spans)
  const [phases, setPhases] = useState([]); // array of { id, name, start_index, duration, color, order_index }

  // Entity data
  const [milestones, setMilestones] = useState({});
  const [teamOrder, setTeamOrder] = useState([]);
  const [teams, setTeams] = useState({});
  const [tasks, setTasks] = useState({});
  const [connections, setConnections] = useState([]);

  // Display settings (initialized from data)
  const [taskDisplaySettings, setTaskDisplaySettings] = useState({});
  const [teamDisplaySettings, setTeamDisplaySettings] = useState({});

  // Reload trigger
  const [reloadData, setReloadData] = useState(false);

  // ________________Loading_________________
  // ________________________________________

  useEffect(() => {
    const load_all = async () => {
        const resProjcet = await fetch_project_details(projectId);
        const project = resProjcet.project
        const start_date = project.start_date
        const end_date = project.end_date

        const num_days = daysBetween(start_date, end_date)
        setDays(num_days)
        setProjectStartDate(new Date(start_date))

      const resTeams = await fetch_project_teams(projectId);
      const fetched_teams = resTeams.teams;

      const newTeamOrder = [];
      const teamObject = {};
      const initialTeamDisplaySettings = {};

      for (const team of fetched_teams) {
        newTeamOrder.push(team.id);
        teamObject[team.id] = {
          ...team,
          tasks: [],
        };
        initialTeamDisplaySettings[team.id] = { hidden: false };
      }

      const resTasks = await fetch_project_tasks(projectId);
      const initialTaskDisplaySettings = {};

      for (const team_id in teamObject) {
        const teamTasks = resTasks.taskOrder?.[String(team_id)] || [];
        teamObject[team_id].tasks = teamTasks;
        
        // Initialize display settings for each task
        for (const taskId of teamTasks) {
          initialTaskDisplaySettings[taskId] = { size: 'normal', hidden: false };
        }
      }

      // ── Unassigned tasks (team_id = null) ──
      const unassignedTaskIds = resTasks.taskOrder?.["null"] || [];
      if (unassignedTaskIds.length > 0) {
        const UNASSIGNED_ID = "__unassigned__";
        teamObject[UNASSIGNED_ID] = {
          id: UNASSIGNED_ID,
          name: "Unassigned",
          color: "#94a3b8",
          tasks: unassignedTaskIds,
          _virtual: true,   // flag so UI can treat it specially
        };
        newTeamOrder.push(UNASSIGNED_ID);
        initialTeamDisplaySettings[UNASSIGNED_ID] = { hidden: false };
        for (const taskId of unassignedTaskIds) {
          initialTaskDisplaySettings[taskId] = { size: 'normal', hidden: false };
        }
      }

      const resMilestones = await get_all_milestones(projectId);
      const fetched_Milestones = resMilestones.milestones;

      const updated_milestones = {}
      if (Array.isArray(fetched_Milestones)) {
        for (let i = 0; i < fetched_Milestones.length; i++) {
          const milestone = fetched_Milestones[i]
          updated_milestones[milestone.id] = {
            ...milestone, 
            display: "default"
          }
        }
      }

      // Load project days
      try {
        const resDays = await get_project_days(projectId);
        setProjectDays(resDays.days || {});
      } catch (err) {
        console.error("Failed to load project days:", err);
        setProjectDays({});
      }

      // Load phases
      try {
        const resPhases = await get_all_phases(projectId);
        setPhases(resPhases.phases || []);
      } catch (err) {
        console.error("Failed to load phases:", err);
        setPhases([]);
      }

      setTeamOrder(newTeamOrder);
      setTeams(teamObject);
      setTasks(resTasks.tasks);
      setMilestones(updated_milestones);
      setTaskDisplaySettings(initialTaskDisplaySettings);
      setTeamDisplaySettings(initialTeamDisplaySettings);

      try {
        const resDeps = await get_all_dependencies(projectId);
        const fetched_deps = resDeps.dependencies;
        if (Array.isArray(fetched_deps)) {
          setConnections(fetched_deps.map(d => ({ source: d.source, target: d.target, weight: d.weight || 'strong', reason: d.reason || null })));
        }
      } catch (err) {
        console.error("Failed to load dependencies:", err);
        setConnections([]);
      }
    };

    load_all();
    setReloadData(false)
  }, [reloadData, projectId]);

  return {
    // Project data
    days,
    projectStartDate,
    projectDays,
    setProjectDays,
    phases,
    setPhases,

    // Entity data
    milestones,
    setMilestones,
    teamOrder,
    setTeamOrder,
    teams,
    setTeams,
    tasks,
    setTasks,
    connections,
    setConnections,

    // Display settings
    taskDisplaySettings,
    setTaskDisplaySettings,
    teamDisplaySettings,
    setTeamDisplaySettings,

    // Reload trigger
    setReloadData,
  };
}


