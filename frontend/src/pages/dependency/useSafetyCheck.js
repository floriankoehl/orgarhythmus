// ─────────────────────────────────────────────────────
// Safety Check — fetches fresh data and validates all
// scheduling rules against the live database state.
// ─────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import {
  get_all_milestones,
  get_all_dependencies,
  fetch_project_tasks,
  fetch_project_details,
} from '../../api/dependencies_api.js';

// ── Pure validation logic ────────────────────────────

/**
 * Detect circular dependencies using DFS.
 * Returns an array of cycles, each being an array of milestone IDs.
 */
function findCircularDependencies(milestones, dependencies) {
  // Build adjacency list: source → [target, ...]
  const adj = {};
  for (const dep of dependencies) {
    if (dep.weight === 'suggestion') continue; // suggestions don't form hard cycles
    if (!adj[dep.source]) adj[dep.source] = [];
    adj[dep.source].push({ target: dep.target, dep });
  }

  const cycles = [];
  const visited = new Set();    // globally done
  const inStack = new Set();    // current DFS path
  const pathMap = {};           // milestone → parent in current path

  function dfs(node, path) {
    if (inStack.has(node)) {
      // Found a cycle — extract it
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;

    inStack.add(node);
    path.push(node);

    for (const { target } of (adj[node] || [])) {
      dfs(target, [...path]);
    }

    inStack.delete(node);
    visited.add(node);
  }

  for (const mId of Object.keys(milestones)) {
    const id = Number(mId);
    if (!visited.has(id)) dfs(id, []);
  }
  return cycles;
}

/**
 * Run all safety checks against fresh data.
 *
 * @returns {{ categories: { key, label, severity, issues[] }[] }}
 */
export function runSafetyChecks({ milestones, dependencies, tasks, totalDays }) {
  const milestonesById = {};
  for (const m of milestones) milestonesById[m.id] = m;

  const tasksById = {};
  if (tasks && typeof tasks === 'object') {
    for (const [id, t] of Object.entries(tasks)) tasksById[id] = t;
  }

  const results = {
    dependencyBreaks:      [],
    suggestionBreaks:      [],
    circularDependencies:  [],
    beforeProjectStart:    [],
    afterProjectEnd:       [],
    afterDeadline:         [],
  };

  // 1. Dependency rule breaks (strong & weak)
  for (const dep of dependencies) {
    const src = milestonesById[dep.source];
    const tgt = milestonesById[dep.target];
    if (!src || !tgt) continue;

    const srcEnd = src.start_index + (src.duration || 1); // exclusive end
    if (srcEnd > tgt.start_index) {
      const issue = {
        type: dep.weight === 'suggestion' ? 'suggestion' : 'dependency',
        dependency: dep,
        source: src,
        target: tgt,
        sourceTask: tasksById[src.task] || null,
        targetTask: tasksById[tgt.task] || null,
        message: `"${src.name}" (day ${src.start_index}–${src.start_index + (src.duration || 1) - 1}) must finish before "${tgt.name}" (starts day ${tgt.start_index})`,
        milestoneIds: [src.id, tgt.id],
        connectionId: dep.id,
      };
      if (dep.weight === 'suggestion') {
        results.suggestionBreaks.push(issue);
      } else {
        results.dependencyBreaks.push(issue);
      }
    }
  }

  // 2. Circular dependencies
  const cycles = findCircularDependencies(milestonesById, dependencies);
  for (const cycle of cycles) {
    const names = cycle.map(id => milestonesById[id]?.name || `#${id}`);
    results.circularDependencies.push({
      type: 'circular',
      cycle,
      milestoneIds: cycle,
      message: `Circular dependency: ${names.join(' → ')} → ${names[0]}`,
    });
  }

  // 3. Milestone before project start (day 0)
  for (const m of milestones) {
    if (m.start_index < 0) {
      results.beforeProjectStart.push({
        type: 'beforeStart',
        milestone: m,
        task: tasksById[m.task] || null,
        milestoneIds: [m.id],
        message: `"${m.name}" starts at day ${m.start_index} (before project start)`,
      });
    }
  }

  // 4. Milestone after project end
  if (totalDays != null && totalDays > 0) {
    for (const m of milestones) {
      const mEnd = m.start_index + (m.duration || 1) - 1;
      if (mEnd >= totalDays) {
        results.afterProjectEnd.push({
          type: 'afterEnd',
          milestone: m,
          task: tasksById[m.task] || null,
          milestoneIds: [m.id],
          message: `"${m.name}" ends on day ${mEnd} (project has ${totalDays} days, 0–${totalDays - 1})`,
        });
      }
    }
  }

  // 5. Milestone after task's hard deadline
  for (const m of milestones) {
    const task = tasksById[m.task];
    if (!task || task.hard_deadline == null) continue;
    const mEnd = m.start_index + (m.duration || 1) - 1;
    if (mEnd > task.hard_deadline) {
      results.afterDeadline.push({
        type: 'afterDeadline',
        milestone: m,
        task,
        milestoneIds: [m.id],
        message: `"${m.name}" ends on day ${mEnd} but task "${task.name}" deadline is day ${task.hard_deadline}`,
      });
    }
  }

  // Build categorized output
  const categories = [
    {
      key: 'dependencyBreaks',
      label: 'Dependency Rule Breaks',
      severity: 'error',
      icon: '⛔',
      issues: results.dependencyBreaks,
    },
    {
      key: 'circularDependencies',
      label: 'Circular Dependencies',
      severity: 'error',
      icon: '🔄',
      issues: results.circularDependencies,
    },
    {
      key: 'afterDeadline',
      label: 'Milestone After Task Deadline',
      severity: 'error',
      icon: '⏰',
      issues: results.afterDeadline,
    },
    {
      key: 'afterProjectEnd',
      label: 'Milestone After Project End',
      severity: 'warning',
      icon: '📅',
      issues: results.afterProjectEnd,
    },
    {
      key: 'beforeProjectStart',
      label: 'Milestone Before Project Start',
      severity: 'info',
      icon: '📅',
      issues: results.beforeProjectStart,
    },
    {
      key: 'suggestionBreaks',
      label: 'Suggestion Rule Breaks',
      severity: 'info',
      icon: '💡',
      issues: results.suggestionBreaks,
    },
  ];

  const totalIssues = categories.reduce((sum, c) => sum + c.issues.length, 0);
  const hasErrors = categories.some(c => c.severity === 'error' && c.issues.length > 0);

  return { categories, totalIssues, hasErrors };
}

// ── React hook ───────────────────────────────────────

export function useSafetyCheck(projectId) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  const runCheck = useCallback(async () => {
    setIsRunning(true);
    setResults(null);
    setShowPanel(true);

    // Wait 500ms to let any pending backend writes settle
    await new Promise(r => setTimeout(r, 500));

    try {
      // Fetch everything fresh from the database
      const [resMilestones, resDeps, resTasks, resProject] = await Promise.all([
        get_all_milestones(projectId),
        get_all_dependencies(projectId),
        fetch_project_tasks(projectId),
        fetch_project_details(projectId),
      ]);

      const milestones = resMilestones.milestones || [];
      const dependencies = resDeps.dependencies || [];
      const tasks = resTasks.tasks || {};

      // Calculate total days from project dates
      const project = resProject.project;
      let totalDays = null;
      if (project.start_date && project.end_date) {
        const start = new Date(project.start_date);
        const end = new Date(project.end_date);
        totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      }

      const checkResults = runSafetyChecks({ milestones, dependencies, tasks, totalDays });
      setResults(checkResults);
    } catch (err) {
      console.error('Safety check failed:', err);
      setResults({
        categories: [],
        totalIssues: -1,
        hasErrors: false,
        error: err.message,
      });
    } finally {
      setIsRunning(false);
    }
  }, [projectId]);

  return {
    isRunning,
    results,
    showPanel,
    setShowPanel,
    runCheck,
  };
}
