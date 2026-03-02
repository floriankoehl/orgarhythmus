// Pure validation functions for grid node operations.
// No React hooks — just data in, result out.
// Portable: can be reused on any page that needs scheduling validation.

/**
 * Compute a cascade of node pushes caused by resizing/moving a set of
 * "origin" nodes.  Each origin has a proposed new position.  Any
 * downstream node that would be violated (edge constraint or same-row
 * overlap) is pushed forward by the minimum amount needed.  The push
 * propagates recursively.
 *
 * Returns { valid: true, pushes: { nodeId: newStartColumn, ... } }
 * or      { valid: false, reason: string }  when a hard deadline blocks.
 *
 * "pushes" contains ONLY the nodes that need to move (not the origins).
 */
export function computeCascadePush(nodes, rows, edges, originPositions) {
  // Working copy of positions
  const pos = {};
  for (const [id, n] of Object.entries(nodes)) {
    pos[id] = { startColumn: n.startColumn, duration: n.duration || 1 };
  }
  for (const [id, p] of Object.entries(originPositions)) {
    pos[id] = { startColumn: p.startColumn, duration: p.duration };
  }

  const originSet = new Set(Object.keys(originPositions).map(String));
  const pushes = {};

  const queue = [...originSet];
  const MAX_ITERATIONS = Object.keys(nodes).length * 3 + 100;
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const currentId = queue.shift();

    const cur = pos[currentId];
    if (!cur) continue;
    const curEnd = cur.startColumn + cur.duration - 1;

    // 1) Push successors via outgoing edges
    const outgoing = edges.filter(c => String(c.source) === String(currentId));
    for (const edge of outgoing) {
      const targetId = String(edge.target);
      const tp = pos[targetId];
      if (!tp) continue;

      if (curEnd >= tp.startColumn) {
        const newStart = curEnd + 1;
        tp.startColumn = newStart;

        if (!originSet.has(targetId)) {
          pushes[targetId] = newStart;
        }

        // Deadline check
        const targetNode = nodes[targetId];
        if (targetNode) {
          const row = rows[targetNode.row];
          if (row && row.hardDeadline !== null && row.hardDeadline !== undefined) {
            const newEnd = newStart + tp.duration - 1;
            if (newEnd > row.hardDeadline) {
              return { valid: false, reason: 'hard_deadline', nodeId: targetId };
            }
          }
        }

        queue.push(targetId);
      }
    }

    // 2) Push same-row nodes that overlap with current
    const currentNode = nodes[currentId];
    if (currentNode) {
      const rowId = currentNode.row;
      const row = rows[rowId];
      if (row && row.nodes) {
        for (const nRef of row.nodes) {
          const otherId = String(nRef.id);
          if (otherId === String(currentId)) continue;
          const op = pos[otherId];
          if (!op) continue;

          if (curEnd >= op.startColumn && cur.startColumn <= (op.startColumn + op.duration - 1)) {
            const newStart = curEnd + 1;
            if (newStart > op.startColumn) {
              op.startColumn = newStart;

              if (!originSet.has(otherId)) {
                pushes[otherId] = newStart;
              }

              const otherNode = nodes[otherId];
              if (otherNode) {
                const otherRow = rows[otherNode.row];
                if (otherRow && otherRow.hardDeadline !== null && otherRow.hardDeadline !== undefined) {
                  const newEnd = newStart + op.duration - 1;
                  if (newEnd > otherRow.hardDeadline) {
                    return { valid: false, reason: 'hard_deadline', nodeId: otherId };
                  }
                }
              }

              queue.push(otherId);
            }
          }
        }
      }
    }
  }

  return { valid: true, pushes };
}

/**
 * Check if a node would overlap with other nodes in the same row.
 * Returns { valid: true } or { valid: false, overlapping: [...nodeIds] }
 */
export function checkNodeOverlap(nodes, rows, nodeId, newStartColumn, newDuration, excludeIds = new Set()) {
  const node = nodes[nodeId];
  if (!node) return { valid: true };

  const rowId = node.row;
  const row = rows[rowId];
  if (!row) return { valid: true };

  const newEnd = newStartColumn + newDuration - 1;
  const overlapping = [];

  const rowNodes = row.nodes || [];
  for (const nRef of rowNodes) {
    if (nRef.id === nodeId) continue;
    if (excludeIds.has(nRef.id)) continue;

    const other = nodes[nRef.id];
    if (!other) continue;

    const otherStart = other.startColumn;
    const otherEnd = otherStart + (other.duration || 1) - 1;

    if (newStartColumn <= otherEnd && newEnd >= otherStart) {
      overlapping.push({
        blockingNodeId: nRef.id,
        blockingEdge: null,
        reason: 'overlap',
      });
    }
  }

  if (overlapping.length > 0) {
    return { valid: false, overlapping };
  }
  return { valid: true };
}

/**
 * Check overlap for multiple nodes being moved by the same delta.
 */
export function checkMultiNodeOverlap(nodes, rows, nodeIds, deltaColumn) {
  const movingSet = new Set(nodeIds);
  const allOverlapping = [];

  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    if (!node) continue;

    const newStart = node.startColumn + deltaColumn;
    const newDuration = node.duration || 1;

    const result = checkNodeOverlap(nodes, rows, nodeId, newStart, newDuration, movingSet);
    if (!result.valid) {
      allOverlapping.push(...result.overlapping);
    }
  }

  if (allOverlapping.length > 0) {
    const seen = new Set();
    const unique = allOverlapping.filter(b => {
      if (seen.has(b.blockingNodeId)) return false;
      seen.add(b.blockingNodeId);
      return true;
    });
    return { valid: false, allBlocking: unique };
  }
  return { valid: true };
}

/**
 * Check if a single node move would violate edge constraints.
 */
export function validateNodeMove(nodes, edges, nodeId, newStartColumn) {
  const node = nodes[nodeId];
  if (!node) return { valid: true };

  const allBlocking = [];

  const incomingEdges = edges.filter(c => c.target === nodeId);
  for (const edge of incomingEdges) {
    const sourceNode = nodes[edge.source];
    if (!sourceNode) continue;

    const sourceEndColumn = sourceNode.startColumn + (sourceNode.duration || 1) - 1;
    if (sourceEndColumn >= newStartColumn) {
      allBlocking.push({ blockingNodeId: edge.source, blockingEdge: edge, weight: edge.weight || 'strong' });
    }
  }

  const outgoingEdges = edges.filter(c => c.source === nodeId);
  const newEndColumn = newStartColumn + (node.duration || 1) - 1;

  for (const edge of outgoingEdges) {
    const targetNode = nodes[edge.target];
    if (!targetNode) continue;

    if (newEndColumn >= targetNode.startColumn) {
      allBlocking.push({ blockingNodeId: edge.target, blockingEdge: edge, weight: edge.weight || 'strong' });
    }
  }

  if (allBlocking.length > 0) {
    const seen = new Set();
    const unique = allBlocking.filter(b => {
      if (seen.has(b.blockingNodeId)) return false;
      seen.add(b.blockingNodeId);
      return true;
    });
    return {
      valid: false,
      allBlocking: unique,
      blockingEdge: unique[0].blockingEdge,
      blockingNodeId: unique[0].blockingNodeId,
    };
  }
  return { valid: true };
}

/**
 * Check if moving multiple nodes by a delta would violate edge constraints.
 * Edges between co-moving nodes are excluded from checks.
 */
export function validateMultiNodeMove(nodes, edges, nodeIds, deltaColumn) {
  const movingSet = new Set(nodeIds);
  const allBlocking = [];

  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    if (!node) continue;

    const newStartColumn = node.startColumn + deltaColumn;
    if (newStartColumn < 0) {
      return { valid: false, reason: "Cannot move before start", blockingNodeIds: [nodeId], allBlocking: [] };
    }

    const incomingEdges = edges.filter(c => c.target === nodeId);
    for (const edge of incomingEdges) {
      if (movingSet.has(edge.source)) continue;

      const sourceNode = nodes[edge.source];
      if (!sourceNode) continue;

      const sourceEndColumn = sourceNode.startColumn + (sourceNode.duration || 1) - 1;
      if (sourceEndColumn >= newStartColumn) {
        allBlocking.push({ blockingNodeId: edge.source, blockingEdge: edge, weight: edge.weight || 'strong' });
      }
    }

    const outgoingEdges = edges.filter(c => c.source === nodeId);
    const newEndColumn = newStartColumn + (node.duration || 1) - 1;

    for (const edge of outgoingEdges) {
      if (movingSet.has(edge.target)) continue;

      const targetNode = nodes[edge.target];
      if (!targetNode) continue;

      if (newEndColumn >= targetNode.startColumn) {
        allBlocking.push({ blockingNodeId: edge.target, blockingEdge: edge, weight: edge.weight || 'strong' });
      }
    }
  }

  if (allBlocking.length > 0) {
    const seen = new Set();
    const unique = allBlocking.filter(b => {
      if (seen.has(b.blockingNodeId)) return false;
      seen.add(b.blockingNodeId);
      return true;
    });
    return {
      valid: false,
      allBlocking: unique,
      blockingEdge: unique[0].blockingEdge,
      blockingNodeId: unique[0].blockingNodeId,
    };
  }
  return { valid: true };
}

/**
 * Check if a node move/resize would violate the row's hard deadline.
 */
export function checkDeadlineViolation(nodes, rows, nodeId, newStartColumn, newDuration) {
  const node = nodes[nodeId];
  if (!node) return { valid: true };

  const rowId = node.row;
  const row = rows[rowId];
  if (!row) return { valid: true };

  const deadline = row.hardDeadline;
  if (deadline === null || deadline === undefined) return { valid: true };

  const newEnd = newStartColumn + newDuration - 1;
  if (newEnd > deadline) {
    return { valid: false, rowId, deadline, endColumn: newEnd };
  }
  return { valid: true };
}

/**
 * Check deadline violations for multiple nodes being moved by the same delta.
 */
export function checkMultiDeadlineViolation(nodes, rows, nodeIds, deltaColumn) {
  const violations = [];

  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    if (!node) continue;

    const newStart = node.startColumn + deltaColumn;
    const newDuration = node.duration || 1;
    const result = checkDeadlineViolation(nodes, rows, nodeId, newStart, newDuration);
    if (!result.valid) {
      violations.push({ nodeId, ...result });
    }
  }

  if (violations.length > 0) {
    return { valid: false, violations };
  }
  return { valid: true };
}
