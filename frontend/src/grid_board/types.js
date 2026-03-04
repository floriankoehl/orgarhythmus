/**
 * ═══════════════════════════════════════════════════════════════════
 *  DependencyGrid — Generic Prop Interface & Type Definitions
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Terminology mapping (from the original milestone-specific code):
 *
 *    OLD (domain-specific)    →   NEW (generic)
 *    ─────────────────────────────────────────────
 *    Team                     →   Lane
 *    Task                     →   Row
 *    Milestone                →   Node
 *    Dependency / Connection   →   Edge
 *    Day                      →   Column
 *    Phase                    →   Phase (unchanged)
 *    View                     →   View (unchanged)
 *    Snapshot                 →   Snapshot (unchanged)
 *
 *  Usage: <DependencyGrid nodes={...} edges={...} rows={...} lanes={...} ... />
 *  Similar to: <ReactFlow nodes={nodes} edges={edges} onNodesChange={...} />
 *
 * ═══════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════
//  CORE DATA TYPES
// ═══════════════════════════════════════════════

/**
 * @typedef {Object} GridNode
 * A positioned element on the grid (was: Milestone).
 * @property {number|string} id        - Unique identifier
 * @property {string}        name      - Display name
 * @property {string}        [description] - Optional description
 * @property {number|string} row       - ID of the row this node belongs to (was: task)
 * @property {number}        startColumn - Column index where this node starts (was: start_index)
 * @property {number}        duration  - How many columns this node spans
 * @property {string}        [display] - Display mode hint (e.g., 'default')
 * @property {string}        [color]   - Optional override color
 */

/**
 * @typedef {Object} GridEdge
 * A directional relationship between two nodes (was: Dependency/Connection).
 * @property {number|string} source    - ID of the source node
 * @property {number|string} target    - ID of the target node
 * @property {string}        [weight]  - 'strong' | 'weak' | 'suggestion'
 * @property {string}        [reason]  - Why this edge exists
 * @property {string}        [description] - Additional context
 */

/**
 * @typedef {Object} GridRow
 * A single row in the grid (was: Task).
 * @property {number|string} id        - Unique identifier
 * @property {string}        name      - Display name
 * @property {string}        [description] - Optional description
 * @property {number|string} lane      - ID of the lane this row belongs to (was: team)
 * @property {number}        [orderIndex] - Sort order within the lane
 * @property {Array}         [nodes]   - References to nodes in this row (was: milestones)
 * @property {number}        [hardDeadline] - Optional column deadline (was: hard_deadline)
 */

/**
 * @typedef {Object} GridLane
 * A grouping/classification of rows (was: Team).
 * @property {number|string} id        - Unique identifier
 * @property {string}        name      - Display name
 * @property {string}        [color]   - Lane color
 * @property {Array}         rows      - Ordered list of row IDs (was: tasks)
 * @property {boolean}       [_virtual] - True for auto-generated lanes (e.g., "Unassigned")
 */

/**
 * @typedef {Object} GridColumn
 * Metadata for a single column (was: Day).
 * @property {number}  index          - 0-based column index (was: day_index)
 * @property {string}  [label]        - Display label (was: dateStr, e.g., "1.3")
 * @property {string}  [sublabel]     - Secondary label (was: dayNameShort, e.g., "Mo")
 * @property {boolean} [isHighlighted] - Whether to highlight this column (was: isSunday)
 * @property {boolean} [isSecondaryHighlight] - Secondary highlight (was: isWeekend)
 * @property {string}  [purpose]      - Column purpose/label overlay
 * @property {Array}   [purposeLanes] - Which lanes the purpose applies to (null = all)
 * @property {boolean} [isBlocked]    - Whether this column is blocked
 */

/**
 * @typedef {Object} GridPhase
 * A named timeframe span across columns (unchanged from Phase).
 * @property {number|string} id        - Unique identifier
 * @property {string}        name      - Phase name
 * @property {number}        startColumn - Start column index (was: start_index)
 * @property {number}        duration  - Number of columns
 * @property {string}        [color]   - Phase color
 * @property {number|string} [lane]    - Specific lane ID, or null for global (was: team)
 * @property {number}        [orderIndex] - Display order
 */

// ═══════════════════════════════════════════════
//  PERSISTENCE CALLBACKS
// ═══════════════════════════════════════════════

/**
 * @typedef {Object} GridPersistCallbacks
 * Callbacks for persisting data changes to the backend.
 * The generic component performs optimistic local updates first,
 * then calls these for server-side persistence.
 * A thrown error triggers a local state revert.
 *
 * @property {Function} persistNodeMove       - (nodeId, newColumnIndex) → Promise
 * @property {Function} persistNodeResize     - (nodeId, newDuration) → Promise
 * @property {Function} persistNodeCreate     - (rowId, {name?, columnIndex?}) → Promise<{node}>
 * @property {Function} persistNodeDelete     - (nodeId) → Promise
 * @property {Function} persistNodeRename     - (nodeId, newName) → Promise
 * @property {Function} persistNodeChangeRow  - (nodeId, newRowId) → Promise
 *
 * @property {Function} persistEdgeCreate     - (sourceId, targetId, {weight?}) → Promise
 * @property {Function} persistEdgeDelete     - (sourceId, targetId) → Promise
 * @property {Function} persistEdgeUpdate     - (sourceId, targetId, data) → Promise
 *
 * @property {Function} persistLaneReorder    - (newLaneOrder) → Promise
 * @property {Function} persistRowReorder     - (laneId, newRowOrder) → Promise
 * @property {Function} persistLaneColorChange - (laneId, color) → Promise
 *
 * @property {Function} persistColumnAction   - (columnIndex, data) → Promise<columnData>
 * @property {Function} persistClearColumnAction - (columnIndex) → Promise<columnData>
 *
 * @property {Function} [persistRowDeadline]  - (rowId, columnIndex|null) → Promise
 */

/**
 * @typedef {Object} GridPhaseCallbacks
 * @property {Function} createPhase  - (phaseData) → Promise<phase>
 * @property {Function} updatePhase  - (phaseId, data) → Promise<phase>
 * @property {Function} deletePhase  - (phaseId) → Promise
 */

/**
 * @typedef {Object} GridViewCallbacks
 * @property {Function} getViews       - () → Promise<view[]>
 * @property {Function} createView     - ({name, state}) → Promise<view>
 * @property {Function} updateView     - (viewId, {name?, state?}) → Promise<view>
 * @property {Function} deleteView     - (viewId) → Promise
 * @property {Function} setDefaultView - (viewId) → Promise<view[]>
 */

/**
 * @typedef {Object} GridSnapshotCallbacks
 * @property {Function} listSnapshots    - () → Promise<{snapshots: snapshot[]}>
 * @property {Function} createSnapshot   - ({name, description}) → Promise<{snapshot}>
 * @property {Function} restoreSnapshot  - (snapshotId) → Promise
 * @property {Function} deleteSnapshot   - (snapshotId) → Promise
 * @property {Function} renameSnapshot   - (snapshotId, {name, description}) → Promise<{snapshot}>
 */

/**
 * @typedef {Object} GridShortcutCallbacks
 * @property {Function} getShortcuts  - () → Promise<{shortcuts}>
 * @property {Function} saveShortcuts - (shortcuts) → Promise
 */

/**
 * @typedef {Object} GridSafetyCheckCallbacks
 * @property {Function} runCheck - () → Promise<{categories, totalIssues, hasErrors}>
 */

// ═══════════════════════════════════════════════
//  DISPLAY SETTINGS
// ═══════════════════════════════════════════════

/**
 * @typedef {Object} RowDisplaySettings
 * Per-row display options (was: taskDisplaySettings).
 * @property {string}  [size]   - 'normal' | 'small'
 * @property {boolean} [hidden] - Whether this row is hidden
 */

/**
 * @typedef {Object} LaneDisplaySettings
 * Per-lane display options (was: teamDisplaySettings).
 * @property {boolean} [hidden]    - Whether this lane is hidden
 * @property {boolean} [collapsed] - Whether this lane is collapsed
 */

// ═══════════════════════════════════════════════
//  MAIN COMPONENT PROPS
// ═══════════════════════════════════════════════

/**
 * @typedef {Object} DependencyGridProps
 *
 * Core data (managed by adapter, passed as props):
 * @property {Object<string, GridNode>} nodes       - All nodes keyed by ID
 * @property {Function}                 setNodes    - State setter for nodes
 * @property {GridEdge[]}               edges       - All edges
 * @property {Function}                 setEdges    - State setter for edges
 * @property {Object<string, GridRow>}  rows        - All rows keyed by ID
 * @property {Function}                 setRows     - State setter for rows
 * @property {Object<string, GridLane>} lanes       - All lanes keyed by ID
 * @property {Function}                 setLanes    - State setter for lanes
 * @property {Array<string|number>}     laneOrder   - Ordered lane IDs
 * @property {Function}                 setLaneOrder - State setter for lane order
 * @property {number}                   columns     - Total number of columns
 * @property {GridColumn[]}             [columnLabels] - Column metadata/labels
 * @property {Object}                   [columnData]  - Per-column extra data (was: projectDays)
 * @property {Function}                 [setColumnData] - State setter for column data
 * @property {GridPhase[]}              [phases]    - Timeline phases
 * @property {Function}                 [setPhases] - State setter for phases
 *
 * Display settings (managed by adapter for view persistence):
 * @property {Object<string, RowDisplaySettings>}  rowDisplaySettings
 * @property {Function}                            setRowDisplaySettings
 * @property {Object<string, LaneDisplaySettings>} laneDisplaySettings
 * @property {Function}                            setLaneDisplaySettings
 *
 * Callbacks:
 * @property {GridPersistCallbacks}     callbacks   - Persistence callbacks
 * @property {GridPhaseCallbacks}       [phaseCallbacks] - Phase CRUD
 * @property {GridViewCallbacks}        [viewCallbacks]  - View CRUD
 * @property {GridSnapshotCallbacks}    [snapshotCallbacks] - Snapshot CRUD
 * @property {GridShortcutCallbacks}    [shortcutCallbacks] - Shortcuts
 * @property {GridSafetyCheckCallbacks} [safetyCheckCallbacks] - Safety checks
 *
 * Extension slots:
 * @property {React.ReactNode} [toolbarCreateSection]  - Custom create buttons for toolbar
 * @property {Function}        [renderAdapterModals]    - (state) => ReactNode for adapter-specific modals
 * @property {Function}        [onReloadData]          - Trigger full data reload
 * @property {string}          [navigateTo3D]          - URL for secret 3D shortcut
 *
 * Configuration:
 * @property {string}          [instanceId]  - Unique ID for this instance (view scoping)
 */

export default {};
