// ─────────────────────────────────────────────────────
// Safety Check — validates all scheduling rules.
// Generic version — data-fetching extracted into a callback.
// ─────────────────────────────────────────────────────
import { useState, useCallback } from 'react';

// ── Pure validation logic ────────────────────────────

/**
 * Detect circular edges using DFS.
 * Returns an array of cycles, each being an array of node IDs.
 */
function findCircularEdges(nodesById, edges) {
  const adj = {};
  for (const edge of edges) {
    if (edge.weight === 'suggestion') continue;
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push({ target: edge.target, edge });
  }

  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, path) {
    if (inStack.has(node)) {
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

  for (const nId of Object.keys(nodesById)) {
    const id = Number(nId);
    if (!visited.has(id)) dfs(id, []);
  }
  return cycles;
}

/**
 * Run all safety checks against fresh data.
 *
 * @param {Object} params
 * @param {Array}  params.nodes        - array of node objects
 * @param {Array}  params.edges        - array of edge objects
 * @param {Object} params.rows         - rows (tasks) keyed by id
 * @param {number|null} params.totalColumns - total columns (days) in the project
 * @returns {{ categories: { key, label, severity, issues[] }[] }}
 */
export function runSafetyChecks({ nodes, edges, rows, totalColumns }) {
  const nodesById = {};
  for (const n of nodes) nodesById[n.id] = n;

  const rowsById = {};
  if (rows && typeof rows === 'object') {
    for (const [id, r] of Object.entries(rows)) rowsById[id] = r;
  }

  const results = {
    edgeBreaks:            [],
    suggestionBreaks:      [],
    circularEdges:         [],
    beforeGridStart:       [],
    afterGridEnd:          [],
    afterDeadline:         [],
  };

  // 1. Edge rule breaks (strong & weak)
  for (const edge of edges) {
    const src = nodesById[edge.source];
    const tgt = nodesById[edge.target];
    if (!src || !tgt) continue;

    const srcEnd = src.startColumn + (src.duration || 1);
    if (srcEnd > tgt.startColumn) {
      const issue = {
        type: edge.weight === 'suggestion' ? 'suggestion' : 'edge',
        edge,
        source: src,
        target: tgt,
        sourceRow: rowsById[src.row] || null,
        targetRow: rowsById[tgt.row] || null,
        message: `"${src.name}" (col ${src.startColumn}–${src.startColumn + (src.duration || 1) - 1}) must finish before "${tgt.name}" (starts col ${tgt.startColumn})`,
        nodeIds: [src.id, tgt.id],
        edgeId: edge.id,
      };
      if (edge.weight === 'suggestion') {
        results.suggestionBreaks.push(issue);
      } else {
        results.edgeBreaks.push(issue);
      }
    }
  }

  // 2. Circular edges
  const cycles = findCircularEdges(nodesById, edges);
  for (const cycle of cycles) {
    const names = cycle.map(id => nodesById[id]?.name || `#${id}`);
    results.circularEdges.push({
      type: 'circular',
      cycle,
      nodeIds: cycle,
      message: `Circular edge: ${names.join(' → ')} → ${names[0]}`,
    });
  }

  // 3. Node before grid start (column 0)
  for (const n of nodes) {
    if (n.startColumn < 0) {
      results.beforeGridStart.push({
        type: 'beforeStart',
        node: n,
        row: rowsById[n.row] || null,
        nodeIds: [n.id],
        message: `"${n.name}" starts at column ${n.startColumn} (before grid start)`,
      });
    }
  }

  // 4. Node after grid end
  if (totalColumns != null && totalColumns > 0) {
    for (const n of nodes) {
      const nEnd = n.startColumn + (n.duration || 1) - 1;
      if (nEnd >= totalColumns) {
        results.afterGridEnd.push({
          type: 'afterEnd',
          node: n,
          row: rowsById[n.row] || null,
          nodeIds: [n.id],
          message: `"${n.name}" ends on column ${nEnd} (grid has ${totalColumns} columns, 0–${totalColumns - 1})`,
        });
      }
    }
  }

  // 5. Node after row's hard deadline
  for (const n of nodes) {
    const row = rowsById[n.row];
    if (!row || row.hard_deadline == null) continue;
    const nEnd = n.startColumn + (n.duration || 1) - 1;
    if (nEnd > row.hard_deadline) {
      results.afterDeadline.push({
        type: 'afterDeadline',
        node: n,
        row,
        nodeIds: [n.id],
        message: `"${n.name}" ends on column ${nEnd} but row "${row.name}" deadline is column ${row.hard_deadline}`,
      });
    }
  }

  // Build categorized output
  const categories = [
    {
      key: 'edgeBreaks',
      label: 'Edge Rule Breaks',
      severity: 'error',
      icon: '⛔',
      issues: results.edgeBreaks,
    },
    {
      key: 'circularEdges',
      label: 'Circular Edges',
      severity: 'error',
      icon: '🔄',
      issues: results.circularEdges,
    },
    {
      key: 'afterDeadline',
      label: 'Node After Row Deadline',
      severity: 'error',
      icon: '⏰',
      issues: results.afterDeadline,
    },
    {
      key: 'afterGridEnd',
      label: 'Node After Grid End',
      severity: 'warning',
      icon: '📅',
      issues: results.afterGridEnd,
    },
    {
      key: 'beforeGridStart',
      label: 'Node Before Grid Start',
      severity: 'info',
      icon: '📅',
      issues: results.beforeGridStart,
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

/**
 * @param {Function} fetchSafetyCheckData - async () => { nodes[], edges[], rows{}, totalColumns }
 *   Adapter-supplied callback that fetches all data fresh from the backend.
 */
export function useSafetyCheck(fetchSafetyCheckData) {
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
      const data = fetchSafetyCheckData
        ? await fetchSafetyCheckData()
        : { nodes: [], edges: [], rows: {}, totalColumns: null };

      const checkResults = runSafetyChecks({
        nodes: data.nodes || [],
        edges: data.edges || [],
        rows: data.rows || {},
        totalColumns: data.totalColumns ?? null,
      });
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
  }, [fetchSafetyCheckData]);

  return {
    isRunning,
    results,
    showPanel,
    setShowPanel,
    runCheck,
  };
}
