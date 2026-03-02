// DependencyGrid — generic composition root.
// Wraps all hooks and sub-components into one reusable <DependencyGrid /> widget.
// All backend I/O is injected via persist/fetch callback props.

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { playSound, setMuted } from '../assets/sound_registry';

// Layout math
import {
  DEFAULT_ROWHEIGHT_NORMAL,
  DEFAULT_ROWHEIGHT_SMALL,
  ROWLABELWIDTH  as DEFAULT_ROWLABELWIDTH_CONSTANT,
  LANEWIDTH      as DEFAULT_LANEWIDTH_CONSTANT,
  DEFAULT_COLUMNWIDTH,
  HEADER_HEIGHT,
  LANE_COLLAPSED_HEIGHT,
  LANE_PHASE_ROW_HEIGHT,
  LANE_DRAG_HIGHLIGHT_HEIGHT,
  MARGIN_BETWEEN_DRAG_HIGHLIGHT,
  LANE_HEADER_LINE_HEIGHT,
  LANE_HEADER_GAP,
  MIN_LANEWIDTH,
  MAX_LANEWIDTH,
  MIN_ROWLABELWIDTH,
  MAX_ROWLABELWIDTH,
  getRowHeight            as getRowHeightBase,
  getRawLaneHeight        as getRawLaneHeightBase,
  getLaneHeightBase,
  getLaneYOffset           as getLaneYOffsetBase,
  getRowYOffset            as getRowYOffsetBase,
  getVisibleRows          as getVisibleRowsBase,
  getVisibleLaneIndex     as getVisibleLaneIndexBase,
  isLaneVisibleBase,
  getRowDropIndicatorY    as getRowDropIndicatorYBase,
  calculateContentHeight,
  isRowVisible,
} from './layoutMath';

// Defaults & context
import {
  DEFAULT_EDGE_SETTINGS,
  getDefaultViewState,
  DEFAULT_HIDE_GLOBAL_PHASES,
  DEFAULT_TOOLBAR_COLLAPSED,
} from './viewDefaults';
import { GridBoardProvider, useGridBoardContext } from './GridBoardContext.jsx';

// Hooks
import { useColumnManagement }  from './useColumnManagement';
import { useDisplaySettings }   from './useDisplaySettings';
import { usePhaseManagement }   from './usePhaseManagement';
import { useViewManagement }    from './useViewManagement';
import { useSafetyCheck }       from './useSafetyCheck';
import { useGridInteraction }   from './useGridInteraction';
import { useGridActions }       from './useGridActions';

// UI Components
import GridToolbar            from './GridToolbar';
import GridModals             from './GridModals';
import GridCanvas             from './GridCanvas';
import GridWarningToast       from './GridWarningToast';
import SafetyCheckPanel       from './SafetyCheckPanel';
import GridRowSelectionBar    from './GridRowSelectionBar';

// MUI icons for the mini chrome
import UnfoldLessIcon      from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon      from '@mui/icons-material/UnfoldMore';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VisibilityIcon      from '@mui/icons-material/Visibility';
import VisibilityOffIcon   from '@mui/icons-material/VisibilityOff';
import PaletteIcon         from '@mui/icons-material/PaletteOutlined';

// ── Default lane colours ──
const DEFAULT_LANE_COLORS = [
  '#facc15', '#3b82f6', '#ef4444', '#22c55e',
  '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#64748b', '#e2e8f0',
];

/**
 * <DependencyGrid /> — a fully generic, reusable grid board.
 *
 * The adapter is responsible for:
 *  1. Fetching data & transforming to generic shapes (lanes/rows/nodes/edges/columns/phases).
 *  2. Owning the React state for that data (useState in the adapter).
 *  3. Providing persist callbacks so the grid can sync user edits to a backend.
 */
export default function DependencyGrid(props) {
  return (
    <GridBoardProvider>
      <DependencyGridContent {...props} />
    </GridBoardProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Inner content — everything that needs the GridBoardContext
// ═════════════════════════════════════════════════════════════════════════════

function DependencyGridContent({
  // ── Data (controlled — adapter owns state) ──
  totalColumns = 0,
  columnLabels = [],
  lanes = {},
  laneOrder = [],
  rows = {},
  nodes = {},
  edges = [],
  phases = [],
  projectStartDate,

  // ── Data setters (adapter-provided) ──
  setLanes,
  setLaneOrder,
  setRows,
  setNodes,
  setEdges,
  setPhases,
  /** Updates column metadata (e.g. purpose/blocked). Signature: (colIdx, fields) */
  setColumnLabels,
  /** Trigger a full data reload in the adapter */
  onReloadData,

  // ── Persist callbacks ──
  persistNodeMove,
  persistNodeResize,
  persistNodeCreate,
  persistNodeDelete,
  persistNodeRename,
  persistNodeTaskChange,
  persistEdgeCreate,
  persistEdgeDelete,
  persistEdgeUpdate,
  persistLaneOrder,
  persistLaneCreate,
  persistRowOrder,
  persistRowCreate,
  persistColumnPurpose,
  persistPhaseCreate,
  persistPhaseUpdate,
  persistPhaseDelete,
  persistRowDeadline,
  persistLaneColor,

  // ── View / snapshot API ──
  fetchViews,
  createViewApi,
  updateViewApi,
  deleteViewApi,
  setDefaultViewApi,
  // Snapshots
  fetchSnapshots,
  createSnapshotApi,
  restoreSnapshotApi,
  deleteSnapshotApi,
  renameSnapshotApi,

  // ── Safety check ──
  fetchSafetyCheckData,

  // ── User shortcuts ──
  userShortcuts: userShortcutsProp = {},
  onSaveShortcuts,

  // ── Navigation callbacks ──
  onLaneNavigate,
  onRowNavigate,

  // ── Header collapse (adapter-controlled) ──
  headerCollapsed: headerCollapsedProp,
  onSetHeaderCollapsed,

  // ── Labels ──
  laneLabel = 'Lane',
  rowLabel = 'Row',
  nodeLabel = 'Node',
  edgeLabel = 'Edge',
  columnLabel = 'Column',

  // ── Optional features ──
  laneColors = DEFAULT_LANE_COLORS,
  /** Extra content rendered below the grid (e.g. refactor banner) */
  children,

  // ── Clipboard / prompt builder ──
  buildClipboardText,
  /** Bulk import handler — adapter-supplied */
  onBulkImport,

  /** Refactor drag handler — adapter-supplied for domain-specific refactor mode */
  handleRefactorDrag,
}) {

  const {
    containerRef,
    selectedNodes,
    setSelectedNodes,
    selectedEdges,
    setSelectedEdges,
    viewMode,
    setViewMode,
    baseViewModeRef,
    autoSelectBlocking,
    setAutoSelectBlocking,
    resizeAllSelected,
    setResizeAllSelected,
    warningDuration,
    setWarningDuration,
    editingNodeId,
    setEditingNodeId,
    editingNodeName,
    setEditingNodeName,
    selectedRows,
    setSelectedRows,
    pushAction,
    hoveredNode,
    setHoveredNode,
  } = useGridBoardContext();

  // ─────────────────────────
  // Transient UI state
  // ─────────────────────────
  const [openLaneSettings, setOpenLaneSettings]     = useState(null);
  const [laneColorPickerOpen, setLaneColorPickerOpen] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [hoveredColumnCell, setHoveredColumnCell]   = useState(null);
  const [isAddingNode, setIsAddingNode]             = useState(false);
  const [nodeCreateModal, setNodeCreateModal]       = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [showCreateLaneModal, setShowCreateLaneModal] = useState(false);
  const [showCreateRowModal, setShowCreateRowModal]   = useState(false);
  const [newLaneName, setNewLaneName]               = useState('');
  const [newLaneColor, setNewLaneColor]             = useState('#facc15');
  const [newRowName, setNewRowName]                 = useState('');
  const [newRowLaneId, setNewRowLaneId]             = useState(null);
  const [isCreating, setIsCreating]                 = useState(false);
  const [hideCollapsedEdges, setHideCollapsedEdges] = useState(false);
  const [hideCollapsedNodes, setHideCollapsedNodes] = useState(false);
  const [customColumnWidth, setCustomColumnWidth]   = useState(DEFAULT_COLUMNWIDTH);
  const [customRowHeightNormal, setCustomRowHeightNormal] = useState(DEFAULT_ROWHEIGHT_NORMAL);
  const [customRowHeightSmall, setCustomRowHeightSmall]   = useState(DEFAULT_ROWHEIGHT_SMALL);
  const [hideAllEdges, setHideAllEdges]             = useState(false);
  const [showEmptyLanes, setShowEmptyLanes]         = useState(true);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [expandedRowView, setExpandedRowView]       = useState(false);
  const [showPhaseColorsInGrid, setShowPhaseColorsInGrid] = useState(true);
  const [edgeSettings, setEdgeSettings]             = useState({ ...DEFAULT_EDGE_SETTINGS });
  const [edgeEditModal, setEdgeEditModal]           = useState(null);
  const [suggestionOfferModal, setSuggestionOfferModal] = useState(null);
  const [columnPurposeModal, setColumnPurposeModal] = useState(null);
  const [newColumnPurpose, setNewColumnPurpose]     = useState('');
  const [newColumnPurposeLanes, setNewColumnPurposeLanes] = useState(null);
  const [phaseEditModal, setPhaseEditModal]         = useState(null);
  const [collapsedLanePhaseRows, setCollapsedLanePhaseRows] = useState(new Set());
  const [collapseAllLanePhases, setCollapseAllLanePhases]   = useState(false);
  const [laneColumnWidth, setLaneColumnWidth]       = useState(DEFAULT_LANEWIDTH_CONSTANT);
  const [rowColumnWidth, setRowColumnWidth]         = useState(DEFAULT_ROWLABELWIDTH_CONSTANT);
  const [hideGlobalPhases, setHideGlobalPhases]     = useState(DEFAULT_HIDE_GLOBAL_PHASES);
  const [toolbarCollapsed, setToolbarCollapsed]     = useState(DEFAULT_TOOLBAR_COLLAPSED);
  const [headerCollapsedLocal, setHeaderCollapsedLocal] = useState(false);
  const headerCollapsed = headerCollapsedProp ?? headerCollapsedLocal;
  const setHeaderCollapsed = onSetHeaderCollapsed ?? setHeaderCollapsedLocal;
  const [soundEnabled, setSoundEnabled]             = useState(true);
  const [hideColumnHeader, setHideColumnHeader]     = useState(false);
  const [isFullscreen, setIsFullscreen]             = useState(!!document.fullscreenElement);
  const [popupCloseSignal, setPopupCloseSignal]     = useState(0);
  const [mode, setMode]                             = useState('drag');
  const safeMode = viewMode === 'inspection';
  const [refactorMode, setRefactorMode]             = useState(false);

  // ── Row display settings (size/hidden per row) ──
  const [rowDisplaySettings, setRowDisplaySettings]   = useState({});
  const [laneDisplaySettings, setLaneDisplaySettings] = useState({});

  // Initialise display settings when data arrives
  useEffect(() => {
    setRowDisplaySettings(prev => {
      const next = { ...prev };
      for (const rid of Object.keys(rows)) {
        if (!(rid in next)) next[rid] = { size: 'normal', hidden: false };
      }
      return next;
    });
  }, [rows]);
  useEffect(() => {
    setLaneDisplaySettings(prev => {
      const next = { ...prev };
      for (const lid of laneOrder) {
        if (!(lid in next)) next[lid] = { hidden: false, collapsed: false };
      }
      return next;
    });
  }, [laneOrder]);

  // ── User shortcuts (local mirror) ──
  const [userShortcuts, setUserShortcuts] = useState(userShortcutsProp);
  useEffect(() => { setUserShortcuts(userShortcutsProp); }, [userShortcutsProp]);
  const handleSaveShortcuts = useCallback((shortcuts) => {
    setUserShortcuts(shortcuts);
    if (onSaveShortcuts) onSaveShortcuts(shortcuts);
  }, [onSaveShortcuts]);

  // ── Fullscreen sync ──
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  // ── Sound mute sync ──
  useEffect(() => { setMuted(!soundEnabled); }, [soundEnabled]);

  // ─────────────────────────
  // Dynamic constants
  // ─────────────────────────
  const COLUMNWIDTH             = customColumnWidth;
  const LANEWIDTH               = laneColumnWidth;
  const ROWLABELWIDTH           = rowColumnWidth;
  const ROWHEIGHT_NORMAL        = customRowHeightNormal;
  const ROWHEIGHT_SMALL         = customRowHeightSmall;
  const COLLAPSED_COLUMN_WIDTH  = 6;

  // ─────────────────────────
  // Column management
  // ─────────────────────────
  const {
    selectedColumns,
    setSelectedColumns,
    collapsedColumns,
    setCollapsedColumns,
    handleColumnSelect,
    clearColumnSelection,
    collapseSelectedColumns,
    uncollapseColumns,
    uncollapseAll: uncollapseAllColumns,
    collapsePhaseRange,
    focusOnPhase,
  } = useColumnManagement(totalColumns);

  // ─────────────────────────
  // Display settings
  // ─────────────────────────
  const {
    toggleRowSize,
    setLaneRowsSmall,
    setLaneRowsNormal,
    toggleRowVisibility,
    showAllLaneRows,
    toggleLaneVisibility,
    showAllHiddenLanes,
    toggleLaneCollapsed,
    collapseAllLanes,
    expandAllLanes,
    allVisibleRowsSmall,
    laneHasHiddenRows,
  } = useDisplaySettings({
    lanes,
    laneOrder,
    rowDisplaySettings,
    setRowDisplaySettings,
    laneDisplaySettings,
    setLaneDisplaySettings,
  });

  // Reset color picker when lane settings dropdown closes
  useEffect(() => { setLaneColorPickerOpen(false); }, [openLaneSettings]);

  const handleLaneColorChange = useCallback(async (laneId, color) => {
    setLanes(prev => ({ ...prev, [laneId]: { ...prev[laneId], color } }));
    if (persistLaneColor) {
      try { await persistLaneColor(laneId, color); }
      catch (e) { console.error('Failed to update lane color', e); }
    }
  }, [setLanes, persistLaneColor]);

  // ─────────────────────────
  // Phase helpers
  // ─────────────────────────
  const globalPhases = useMemo(() => phases.filter(p => p.team == null && p.lane == null), [phases]);
  const lanePhasesMap = useMemo(() => {
    const m = {};
    for (const p of phases) {
      const lid = p.lane ?? p.team;
      if (lid != null) { if (!m[lid]) m[lid] = []; m[lid].push(p); }
    }
    return m;
  }, [phases]);

  const getLanePhaseRowHeight = useCallback((laneId) => {
    const lid = typeof laneId === 'string' ? parseInt(laneId, 10) : laneId;
    if (!lanePhasesMap[lid] || lanePhasesMap[lid].length === 0) return 0;
    if (collapseAllLanePhases || collapsedLanePhaseRows.has(lid)) return 0;
    return LANE_PHASE_ROW_HEIGHT;
  }, [lanePhasesMap, collapseAllLanePhases, collapsedLanePhaseRows]);

  // ─────────────────────────
  // Layout helpers
  // ─────────────────────────
  const LANE_MIN_HEIGHT = ROWHEIGHT_NORMAL;

  const getRowHeight = (rowId) =>
    getRowHeightBase(rowId, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL);

  const getLaneHeight = (laneId) =>
    getLaneHeightBase(lanes[laneId], laneDisplaySettings, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL, LANE_MIN_HEIGHT, LANE_COLLAPSED_HEIGHT, getLanePhaseRowHeight(laneId));

  const getRawLaneHeight = (laneId) =>
    getRawLaneHeightBase(lanes[laneId], rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL);

  const isLaneVisible = useCallback((laneId) =>
    isLaneVisibleBase(laneId, laneDisplaySettings, lanes, rowDisplaySettings, showEmptyLanes, nodes),
    [laneDisplaySettings, lanes, rowDisplaySettings, showEmptyLanes, nodes]);

  const isLaneCollapsed = (laneId) => laneDisplaySettings[laneId]?.collapsed ?? false;

  const getVisibleRows = (laneId) =>
    getVisibleRowsBase(lanes[laneId], rowDisplaySettings);

  const visibleLaneCount = laneOrder.filter(lid => isLaneVisible(lid)).length;
  const hiddenLaneCount = laneOrder.filter(lid => !isLaneVisible(lid)).length;

  const PHASE_HEADER_HEIGHT = 26;
  const hasGlobalPhases = globalPhases.length > 0;
  const effectiveHeaderHeight = (hideColumnHeader ? 0 : HEADER_HEIGHT) + (hasGlobalPhases && !hideGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const layoutConstants = { HEADER_HEIGHT: effectiveHeaderHeight, LANE_DRAG_HIGHLIGHT_HEIGHT, MARGIN_BETWEEN_DRAG_HIGHLIGHT, LANE_HEADER_LINE_HEIGHT, LANE_HEADER_GAP };

  const contentHeight = useMemo(() => {
    return calculateContentHeight(laneOrder, isLaneVisible, getLaneHeight, layoutConstants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneOrder, lanes, rowDisplaySettings, laneDisplaySettings, ROWHEIGHT_NORMAL, ROWHEIGHT_SMALL, hasGlobalPhases, hideGlobalPhases, hideColumnHeader, phases, collapseAllLanePhases, collapsedLanePhaseRows, showEmptyLanes, nodes]);

  const getVisibleLaneIndex = (laneId) =>
    getVisibleLaneIndexBase(laneId, laneOrder, isLaneVisible);

  const getLaneYOffset = (laneId) =>
    getLaneYOffsetBase(laneId, laneOrder, isLaneVisible, getLaneHeight, layoutConstants);

  const getRowYOffset = (rowId, laneId) =>
    getRowYOffsetBase(rowId, lanes[laneId], isRowVisible, getRowHeight, rowDisplaySettings);

  // ─────────────────────────
  // Column layout (variable widths for collapsed columns)
  // ─────────────────────────
  const columnLayout = useMemo(() => {
    if (!totalColumns) return { columnXOffset: () => 0, columnWidth: () => COLUMNWIDTH, totalColumnsWidth: 0, visibleColumnIndices: [], collapsedRanges: [] };
    const offsets = new Array(totalColumns);
    const widths = new Array(totalColumns);
    const visibleColumnIndices = [];
    let x = 0;
    const collapsedRanges = [];
    let rangeStart = null;
    for (let i = 0; i < totalColumns; i++) {
      const isCollapsed = collapsedColumns.has(i);
      if (isCollapsed && rangeStart === null) rangeStart = i;
      if (!isCollapsed && rangeStart !== null) { collapsedRanges.push({ start: rangeStart, end: i - 1 }); rangeStart = null; }
    }
    if (rangeStart !== null) collapsedRanges.push({ start: rangeStart, end: totalColumns - 1 });
    for (let i = 0; i < totalColumns; i++) {
      offsets[i] = x;
      const w = collapsedColumns.has(i) ? COLLAPSED_COLUMN_WIDTH : COLUMNWIDTH;
      widths[i] = w;
      if (!collapsedColumns.has(i)) visibleColumnIndices.push(i);
      x += w;
    }
    return {
      columnXOffset: (idx) => offsets[idx] ?? 0,
      columnWidth: (idx) => widths[idx] ?? COLUMNWIDTH,
      totalColumnsWidth: x,
      visibleColumnIndices,
      collapsedRanges,
      offsets,
      widths,
    };
  }, [totalColumns, collapsedColumns, COLUMNWIDTH, COLLAPSED_COLUMN_WIDTH]);

  // ─────────────────────────
  // Column header click → purpose modal
  // ─────────────────────────
  const handleColumnHeaderClick = useCallback((colIdx) => {
    const label = columnLabels[colIdx] || {};
    setColumnPurposeModal({ columnIndex: colIdx, currentPurpose: label.purpose || '', currentPurposeLanes: label.purposeLanes || null });
    setNewColumnPurpose(label.purpose || '');
    setNewColumnPurposeLanes(label.purposeLanes || null);
  }, [columnLabels]);

  // ─────────────────────────
  // Lane column / row label column resize
  // ─────────────────────────
  const handleColumnResize = useCallback((column, e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startWidth = column === 'lane' ? LANEWIDTH : ROWLABELWIDTH;
    const minW = column === 'lane' ? MIN_LANEWIDTH : MIN_ROWLABELWIDTH;
    const maxW = column === 'lane' ? MAX_LANEWIDTH : MAX_ROWLABELWIDTH;
    const setter = column === 'lane' ? setLaneColumnWidth : setRowColumnWidth;
    const onMouseMove = (moveE) => { setter(Math.min(maxW, Math.max(minW, startWidth + (moveE.clientX - startX)))); };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  }, [LANEWIDTH, ROWLABELWIDTH]);

  // ─────────────────────────
  // Lane phase row controls
  // ─────────────────────────
  const showAllLanePhases = useCallback(() => { playSound('collapse'); setCollapsedLanePhaseRows(new Set()); setCollapseAllLanePhases(false); }, []);
  const hideAllLanePhases = useCallback(() => { playSound('collapse'); setCollapseAllLanePhases(true); }, []);

  // ═════════════════════════════════════════════════════════════════════════
  //  collectViewState / applyViewState — for view save/load
  // ═════════════════════════════════════════════════════════════════════════
  const collectViewState = useCallback(() => ({
    rowDisplaySettings,
    laneDisplaySettings,
    viewMode,
    mode,
    collapsedColumns: [...collapsedColumns],
    selectedColumns: [...selectedColumns],
    edgeSettings,
    showPhaseColorsInGrid,
    expandedRowView,
    hideAllEdges,
    hideCollapsedEdges,
    hideCollapsedNodes,
    showEmptyLanes,
    customColumnWidth,
    customRowHeightNormal,
    customRowHeightSmall,
    collapsedLanePhaseRows: [...collapsedLanePhaseRows],
    collapseAllLanePhases,
    laneColumnWidth,
    rowColumnWidth,
    autoSelectBlocking,
    resizeAllSelected,
    warningDuration,
    refactorMode,
    hideGlobalPhases,
    toolbarCollapsed,
    headerCollapsed,
    soundEnabled,
    hideColumnHeader,
    isFullscreen,
  }), [
    rowDisplaySettings, laneDisplaySettings, viewMode, mode,
    collapsedColumns, selectedColumns, edgeSettings, showPhaseColorsInGrid,
    expandedRowView, hideAllEdges, hideCollapsedEdges,
    hideCollapsedNodes, showEmptyLanes, customColumnWidth,
    customRowHeightNormal, customRowHeightSmall, collapsedLanePhaseRows,
    collapseAllLanePhases, laneColumnWidth, rowColumnWidth,
    autoSelectBlocking, warningDuration, resizeAllSelected, refactorMode,
    hideGlobalPhases, toolbarCollapsed, headerCollapsed,
    soundEnabled, hideColumnHeader, isFullscreen,
  ]);

  const applyViewState = useCallback((state) => {
    if (!state) return;
    const d = getDefaultViewState();

    // Clear transient UI
    setSelectedNodes(new Set());
    setSelectedEdges([]);
    setIsAddingNode(false);
    setShowFilterDropdown(false);
    setShowSettingsDropdown(false);
    setOpenLaneSettings(null);
    setPopupCloseSignal(c => c + 1);

    // Row / lane display
    const savedRow = state.rowDisplaySettings || {};
    setRowDisplaySettings(prev => {
      const next = {};
      for (const id of Object.keys(prev)) next[id] = savedRow[id] ? { ...savedRow[id] } : { size: 'normal', hidden: false };
      for (const id of Object.keys(savedRow)) { if (!(id in next)) next[id] = { ...savedRow[id] }; }
      return next;
    });
    const savedLane = state.laneDisplaySettings || {};
    setLaneDisplaySettings(prev => {
      const next = {};
      for (const id of Object.keys(prev)) next[id] = savedLane[id] ? { ...savedLane[id] } : { hidden: false, collapsed: false };
      for (const id of Object.keys(savedLane)) { if (!(id in next)) next[id] = { ...savedLane[id] }; }
      return next;
    });

    const vm = state.viewMode ?? d.viewMode;
    setViewMode(vm); baseViewModeRef.current = vm;
    setMode(state.mode ?? d.mode);
    setCollapsedColumns(new Set(state.collapsedColumns ?? d.collapsedColumns));
    setSelectedColumns(new Set(state.selectedColumns ?? d.selectedColumns));
    setEdgeSettings({ ...d.edgeSettings, ...(state.edgeSettings ?? {}) });
    setShowPhaseColorsInGrid(state.showPhaseColorsInGrid ?? d.showPhaseColorsInGrid);
    setExpandedRowView(state.expandedRowView ?? d.expandedRowView);
    setHideAllEdges(state.hideAllEdges ?? d.hideAllEdges);
    setHideCollapsedEdges(state.hideCollapsedEdges ?? d.hideCollapsedEdges);
    setHideCollapsedNodes(state.hideCollapsedNodes ?? d.hideCollapsedNodes);
    setShowEmptyLanes(state.showEmptyLanes ?? d.showEmptyLanes);
    setCustomColumnWidth(state.customColumnWidth ?? d.customColumnWidth);
    setCustomRowHeightNormal(state.customRowHeightNormal ?? d.customRowHeightNormal);
    setCustomRowHeightSmall(state.customRowHeightSmall ?? d.customRowHeightSmall);
    setLaneColumnWidth(state.laneColumnWidth ?? d.laneColumnWidth);
    setRowColumnWidth(state.rowColumnWidth ?? d.rowColumnWidth);
    setCollapsedLanePhaseRows(new Set(state.collapsedLanePhaseRows ?? d.collapsedLanePhaseRows));
    setCollapseAllLanePhases(state.collapseAllLanePhases ?? d.collapseAllLanePhases);
    setAutoSelectBlocking(state.autoSelectBlocking ?? d.autoSelectBlocking);
    setResizeAllSelected(state.resizeAllSelected ?? d.resizeAllSelected);
    setWarningDuration(state.warningDuration ?? d.warningDuration);
    setRefactorMode(state.refactorMode ?? d.refactorMode);
    setHideGlobalPhases(state.hideGlobalPhases ?? d.hideGlobalPhases);
    setToolbarCollapsed(state.toolbarCollapsed ?? d.toolbarCollapsed);
    setHeaderCollapsed(state.headerCollapsed ?? d.headerCollapsed);
    setSoundEnabled(state.soundEnabled ?? d.soundEnabled);
    setHideColumnHeader(state.hideColumnHeader ?? d.hideColumnHeader);
    const wantFs = state.isFullscreen ?? d.isFullscreen;
    if (wantFs && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else if (!wantFs && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────
  //  View management
  // ─────────────────────────
  const {
    savedViews,
    setSavedViews,
    activeViewId,
    setActiveViewId,
    activeViewName,
    setActiveViewName,
    viewTransition,
    viewFlashName,
    handleLoadView,
    handleNextView,
    handlePrevView,
    handleSaveView,
    handleCreateView,
    handleRenameView,
    handleDeleteView,
    handleSetDefaultView,
  } = useViewManagement({ collectViewState, applyViewState, fetchViews, createViewApi, updateViewApi, deleteViewApi, setDefaultViewApi });

  // ── Per-user view shortcuts ──
  const viewShortcuts = useMemo(() => userShortcuts?._viewShortcuts?.['_grid'] || {}, [userShortcuts]);
  const handleUpdateViewShortcut = useCallback((viewId, keys) => {
    setUserShortcuts(prev => {
      const next = { ...prev };
      const projMap = { ...(next._viewShortcuts || {}) };
      const viewMap = { ...(projMap['_grid'] || {}) };
      if (!keys || keys.length === 0) delete viewMap[viewId]; else viewMap[viewId] = keys;
      projMap['_grid'] = viewMap;
      next._viewShortcuts = projMap;
      if (onSaveShortcuts) onSaveShortcuts(next);
      return next;
    });
    playSound('uiClick');
  }, [onSaveShortcuts]);

  // ─────────────────────────
  //  Snapshot management (inline — no separate hook needed since it's all callbacks)
  // ─────────────────────────
  const [snapshots, setSnapshots]           = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // Auto-fetch snapshots on mount
  useEffect(() => {
    if (!fetchSnapshots) return;
    fetchSnapshots().then(data => setSnapshots(data || [])).catch(() => {});
  }, [fetchSnapshots]);

  const handleCreateSnapshot = useCallback(async (name, desc) => {
    if (!createSnapshotApi) return;
    setSnapshotsLoading(true);
    try {
      const snap = await createSnapshotApi(name, desc, collectViewState());
      setSnapshots(prev => [snap, ...prev]);
      playSound('snapshotSave');
    } finally { setSnapshotsLoading(false); }
  }, [createSnapshotApi, collectViewState]);

  const handleQuickSaveSnapshot = useCallback(async () => {
    if (!createSnapshotApi) return;
    const name = `Quick ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    try {
      const snap = await createSnapshotApi(name, '', collectViewState());
      setSnapshots(prev => [snap, ...prev]);
      playSound('snapshotSave');
    } catch { /* silent */ }
  }, [createSnapshotApi, collectViewState]);

  const handleRestoreSnapshot = useCallback(async (snapId) => {
    if (!restoreSnapshotApi) return;
    setSnapshotsLoading(true);
    try {
      const result = await restoreSnapshotApi(snapId);
      if (result?.viewState) applyViewState(result.viewState);
      if (onReloadData) onReloadData();
      // Refresh views
      if (fetchViews) {
        const views = await fetchViews();
        setSavedViews(views || []);
        setActiveViewId(null);
        setActiveViewName('Default');
      }
      playSound('snapshotRestore');
    } finally { setSnapshotsLoading(false); }
  }, [restoreSnapshotApi, applyViewState, onReloadData, fetchViews, setSavedViews, setActiveViewId, setActiveViewName]);

  const handleDeleteSnapshot = useCallback(async (snapId) => {
    if (!deleteSnapshotApi) return;
    setSnapshots(prev => prev.filter(s => s.id !== snapId));
    try { await deleteSnapshotApi(snapId); } catch { /* silent */ }
  }, [deleteSnapshotApi]);

  const handleRenameSnapshot = useCallback(async (snapId, name) => {
    if (!renameSnapshotApi) return;
    setSnapshots(prev => prev.map(s => s.id === snapId ? { ...s, name } : s));
    try { await renameSnapshotApi(snapId, name); } catch { /* silent */ }
  }, [renameSnapshotApi]);

  // ─────────────────────────
  //  Safety check
  // ─────────────────────────
  const {
    isRunning: safetyCheckRunning,
    results: safetyCheckResults,
    showPanel: showSafetyPanel,
    setShowPanel: setShowSafetyPanel,
    runCheck: runSafetyCheck,
  } = useSafetyCheck(fetchSafetyCheckData);

  // ─────────────────────────
  //  Phase management
  // ─────────────────────────
  const {
    phasesRef,
    handleCreatePhase,
    handleUpdatePhase,
    handleDeletePhase,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    wouldPhaseOverlap,
  } = usePhaseManagement({ phases, setPhases, COLUMNWIDTH, persistPhaseCreate, persistPhaseUpdate, persistPhaseDelete });

  // ═════════════════════════════════════════════════════════════════════════
  //  Interaction orchestrator hook
  // ═════════════════════════════════════════════════════════════════════════
  const {
    handleLaneDrag,
    handleRowDrag,
    handleNodeMouseDown,
    handleNodeEdgeResize,
    handleNodeClick,
    handleEdgeClick,
    handleNodeDelete,
    handleNodeDoubleClick,
    handleNodeRenameSubmit,
    handleColumnCellClick,
    handleConnectionDragStart,
    handleDeleteEdge,
    handleUpdateEdge,
    validateNodeMove,
    validateMultiNodeMove,
    checkNodeOverlap,
    findNodeAtPosition,
    getNodeHandlePosition,
    showBlockingFeedback,
    addWarning,
    warningMessages,
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    rowGhost,
    setRowGhost,
    rowDropTarget,
    setRowDropTarget,
    isDraggingConnection,
    setIsDraggingConnection,
    connectionStart,
    setConnectionStart,
    connectionEnd,
    setConnectionEnd,
    justDraggedRef,
    moveModal,
    setMoveModal,
    blockedMoveHighlight,
    setBlockedMoveHighlight,
    marqueeRect,
    handleMarqueeStart,
    weakEdgeModal,
    setWeakEdgeModal,
  } = useGridInteraction({
    nodes, lanes, rows, laneOrder, edges,
    openLaneSettings, showFilterDropdown,
    rowDisplaySettings, laneDisplaySettings,
    setMode, setNodes, setLanes, setLaneOrder, setEdges,
    setDeleteConfirmModal, setOpenLaneSettings, setShowFilterDropdown,
    setRowDisplaySettings, setLaneDisplaySettings,
    setNodeCreateModal, setIsAddingNode, setRows,
    COLUMNWIDTH, LANEWIDTH, ROWLABELWIDTH,
    getRowHeight, getLaneHeight: getLaneHeight, isLaneVisible, getVisibleLaneIndex, getLaneYOffset, getRowYOffset, getVisibleRows,
    columnLayout, collapsedColumns,
    safeMode,
    onSuggestionOffer: setSuggestionOfferModal,
    defaultEdgeWeight: edgeSettings.defaultEdgeWeight || 'strong',
    getLanePhaseRowHeight,
    layoutConstants,
    savedViews, viewShortcuts,
    onLoadView: handleLoadView, onSaveView: handleSaveView, onNextView: handleNextView, onPrevView: handlePrevView,
    refactorMode, setRefactorMode,
    setToolbarCollapsed, setHeaderCollapsed, toggleFullscreen,
    userShortcuts,
    setCustomColumnWidth, setCustomRowHeightNormal, setCustomRowHeightSmall,
    setHideColumnHeader, setSoundEnabled, setShowEmptyLanes, setShowPhaseColorsInGrid,
    setHideAllEdges, setHideCollapsedEdges, setHideCollapsedNodes,
    setExpandedRowView, setHideGlobalPhases,
    uncollapseAll: uncollapseAllColumns,
    setAutoSelectBlocking,
    hideAllEdges, hideCollapsedEdges, hideCollapsedNodes,
    isLaneCollapsed,
    snapshots, onQuickSaveSnapshot: handleQuickSaveSnapshot,
    setShowCreateLaneModal, setShowCreateRowModal, setPhaseEditModal,
    onLoadDefaultView: () => handleLoadView(null),
    // Persist callbacks
    persistNodeCreate, persistNodeMove, persistNodeResize, persistNodeDelete,
    persistNodeRename,
    persistEdgeCreate, persistEdgeDelete, persistEdgeUpdate, persistNodeTaskChange,
    persistLaneOrder, persistRowOrder,
  });

  const getRowDropIndicatorY = () =>
    getRowDropIndicatorYBase(rowDropTarget, getLaneYOffset, getVisibleRows, getRowHeight, rowDisplaySettings, layoutConstants, getLanePhaseRowHeight);

  // ═════════════════════════════════════════════════════════════════════════
  //  Actions hook (CRUD)
  // ═════════════════════════════════════════════════════════════════════════
  const {
    handleSaveColumnPurpose,
    handleClearColumnPurpose,
    addNodeLocal,
    confirmNodeCreate,
    handleConfirmMove,
    handleConfirmDelete,
    handleDeleteSelected,
    handleCreateLane,
    handleCreateRow,
    handleSetDeadline,
    handleSuggestionOfferAccept,
    handleBulkUpdateEdges,
    handleWeakEdgeConvert,
  } = useGridActions({
    lanes, rowDisplaySettings,
    columnPurposeModal, nodeCreateModal, moveModal, deleteConfirmModal,
    newColumnPurpose, newColumnPurposeLanes,
    newLaneName, newLaneColor, newRowName, newRowLaneId,
    setColumns: setColumnLabels, setNodes, setRows, setLanes,
    setReloadData: onReloadData,
    setColumnPurposeModal, setNodeCreateModal, setMoveModal, setDeleteConfirmModal,
    setIsAddingNode,
    setNewColumnPurpose, setNewColumnPurposeLanes,
    setNewLaneName, setNewLaneColor, setNewRowName, setNewRowLaneId,
    setShowCreateLaneModal, setShowCreateRowModal, setIsCreating,
    getVisibleRows,
    handleDeleteEdge, handleNodeDelete, handleUpdateEdge,
    suggestionOfferModal, setSuggestionOfferModal,
    setEdges, safeMode,
    // Persist
    persistColumnPurpose, persistNodeCreate, persistNodeMove, persistNodeDelete,
    persistNodeResize, persistEdgeCreate, persistEdgeDelete, persistEdgeUpdate,
    persistRowReorder: persistRowOrder, persistRowDeadline: persistRowDeadline,
    persistNodeTaskChange, persistLaneCreate, persistRowCreate,
  });

  // ── Auto-block weak edge conflicts when prompt disabled ──
  useEffect(() => {
    if (weakEdgeModal && !edgeSettings.weakEdgePrompt) {
      const modalData = weakEdgeModal;
      setWeakEdgeModal(null);
      if (autoSelectBlocking) {
        const blockIds = modalData.blockingNodeIds || modalData.blockingMilestoneIds || [];
        const moveOrResizeIds = modalData.nodesToMove || modalData.milestonesToMove || modalData.nodesToResize || modalData.milestonesToResize || [];
        setSelectedNodes(prev => {
          const newSet = new Set(prev);
          for (const id of moveOrResizeIds) newSet.add(id);
          for (const id of blockIds) newSet.add(id);
          return newSet;
        });
      }
      const blockIds = modalData.blockingNodeIds || modalData.blockingMilestoneIds || [];
      const weakConns = modalData.weakEdges || modalData.weakConnections || [];
      setTimeout(() => { for (let i = 0; i < blockIds.length; i++) showBlockingFeedback(blockIds[i], weakConns[i]); }, 50);
    }
  }, [weakEdgeModal, edgeSettings.weakEdgePrompt, autoSelectBlocking, setSelectedNodes, setWeakEdgeModal, showBlockingFeedback]);

  // ═════════════════════════════════════════════════════════════════════════
  //  Build structured props for canvas
  // ═════════════════════════════════════════════════════════════════════════
  const layout = {
    isLaneVisible,
    isLaneCollapsed,
    getVisibleLaneIndex,
    getLaneHeight,
    getRawLaneHeight,
    getVisibleRows,
    getRowHeight,
    getLaneYOffset,
    getRowYOffset,
    getRowDropIndicatorY,
    getNodeHandlePosition,
    getLanePhaseRowHeight,
    LANEWIDTH, ROWLABELWIDTH, COLUMNWIDTH,
    COLLAPSED_COLUMN_WIDTH,
    LANE_DRAG_HIGHLIGHT_HEIGHT,
    MARGIN_BETWEEN_DRAG_HIGHLIGHT,
    LANE_HEADER_LINE_HEIGHT,
    LANE_HEADER_GAP,
    columnLayout,
  };

  const data = {
    laneOrder, lanes, rows, nodes, edges,
    columnLabels,
    phases,
    lanePhasesMap,
  };

  const displayState = {
    rowDisplaySettings, laneDisplaySettings,
    hideAllEdges, hideCollapsedEdges, hideCollapsedNodes,
    selectedColumns, collapsedColumns,
    hoveredNode, selectedNodes, selectedEdges,
    editingNodeId, editingNodeName,
    blockedMoveHighlight,
    viewMode, mode, safeMode,
    ghost, dropIndex,
    rowGhost, rowDropTarget,
    isDraggingConnection, connectionStart, connectionEnd,
    openLaneSettings,
    isAddingNode,
    hoveredColumnCell,
    visibleLaneCount, hiddenLaneCount,
    refactorMode,
    expandedRowView,
    edgeSettings,
    showPhaseColorsInGrid,
    collapsedLanePhaseRows,
    hideGlobalPhases,
    hideColumnHeader,
    marqueeRect,
  };

  const handlers = {
    handleColumnHeaderClick,
    handleLaneDrag,
    handleRowDrag,
    handleEdgeClick,
    handleNodeMouseDown,
    handleNodeClick,
    handleNodeEdgeResize,
    handleConnectionDragStart,
    handleNodeRenameSubmit,
    handleColumnCellClick,
    toggleRowSize,
    toggleRowVisibility,
    toggleLaneCollapsed,
    addNodeLocal,
    showAllHiddenLanes,
    toggleLaneVisibility,
    handleColumnResize,
    setHoveredNode,
    setEditingNodeName,
    setEditingNodeId,
    setDeleteConfirmModal,
    setOpenLaneSettings,
    setHoveredColumnCell,
    handleMarqueeStart,
    handleRefactorDrag,
    onSetDeadline: handleSetDeadline,
    setEdgeEditModal,
    setPhaseEditModal,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    setCollapsedLanePhaseRows,
    collapsePhaseRange,
    focusOnPhase,
    onColumnSelect: handleColumnSelect,
    onUncollapseColumns: uncollapseColumns,
    // Navigation (adapter-injected)
    onLaneNavigate,
    onRowNavigate,
  };

  // ═════════════════════════════════════════════════════════════════════════
  //  Render
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <>
      <GridModals
        columnPurposeModal={columnPurposeModal}
        setColumnPurposeModal={setColumnPurposeModal}
        columnLabels={columnLabels}
        newColumnPurpose={newColumnPurpose}
        setNewColumnPurpose={setNewColumnPurpose}
        newColumnPurposeLanes={newColumnPurposeLanes}
        setNewColumnPurposeLanes={setNewColumnPurposeLanes}
        handleSaveColumnPurpose={handleSaveColumnPurpose}
        handleClearColumnPurpose={handleClearColumnPurpose}
        laneOrder={laneOrder}
        allLanes={lanes}
        showCreateLaneModal={showCreateLaneModal}
        setShowCreateLaneModal={setShowCreateLaneModal}
        newLaneName={newLaneName}
        setNewLaneName={setNewLaneName}
        newLaneColor={newLaneColor}
        setNewLaneColor={setNewLaneColor}
        isCreating={isCreating}
        handleCreateLane={handleCreateLane}
        showCreateRowModal={showCreateRowModal}
        setShowCreateRowModal={setShowCreateRowModal}
        newRowName={newRowName}
        setNewRowName={setNewRowName}
        newRowLaneId={newRowLaneId}
        setNewRowLaneId={setNewRowLaneId}
        lanes={lanes}
        handleCreateRow={handleCreateRow}
        moveModal={moveModal}
        setMoveModal={setMoveModal}
        handleConfirmMove={handleConfirmMove}
        nodeCreateModal={nodeCreateModal}
        setNodeCreateModal={setNodeCreateModal}
        rows={rows}
        confirmNodeCreate={confirmNodeCreate}
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        handleConfirmDelete={handleConfirmDelete}
        weakEdgeModal={weakEdgeModal}
        setWeakEdgeModal={setWeakEdgeModal}
        handleWeakEdgeConvert={handleWeakEdgeConvert}
        handleWeakEdgeBlock={(modalData) => {
          setWeakEdgeModal(null);
          if (autoSelectBlocking && modalData) {
            const blockIds = modalData.blockingNodeIds || modalData.blockingMilestoneIds || [];
            const moveOrResizeIds = modalData.nodesToMove || modalData.milestonesToMove || modalData.nodesToResize || modalData.milestonesToResize || [];
            setSelectedNodes(prev => {
              const n = new Set(prev);
              for (const id of moveOrResizeIds) n.add(id);
              for (const id of blockIds) n.add(id);
              return n;
            });
          }
          if (modalData) {
            const blockIds = modalData.blockingNodeIds || modalData.blockingMilestoneIds || [];
            const weakConns = modalData.weakEdges || modalData.weakConnections || [];
            setTimeout(() => { for (let i = 0; i < blockIds.length; i++) showBlockingFeedback(blockIds[i], weakConns[i]); }, 50);
          }
        }}
        edgeEditModal={edgeEditModal}
        setEdgeEditModal={setEdgeEditModal}
        handleUpdateEdge={handleUpdateEdge}
        suggestionOfferModal={suggestionOfferModal}
        setSuggestionOfferModal={setSuggestionOfferModal}
        handleSuggestionOfferAccept={handleSuggestionOfferAccept}
        phaseEditModal={phaseEditModal}
        setPhaseEditModal={setPhaseEditModal}
        handleCreatePhase={handleCreatePhase}
        handleUpdatePhase={handleUpdatePhase}
        handleDeletePhase={handleDeletePhase}
        totalColumns={totalColumns}
        projectStartDate={projectStartDate}
        phases={phases}
        laneLabel={laneLabel}
        rowLabel={rowLabel}
        nodeLabel={nodeLabel}
        edgeLabel={edgeLabel}
        columnLabel={columnLabel}
      />

      {/* Lane Settings Dropdown */}
      {openLaneSettings && lanes[openLaneSettings] && (() => {
        const btn = document.getElementById(`lane-settings-btn-${openLaneSettings}`);
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const lid = openLaneSettings;
        return (
          <div
            className="fixed w-52 rounded-lg border border-slate-200 bg-white shadow-xl"
            style={{ top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: 9999 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 space-y-1">
              {!isLaneCollapsed(lid) && (
                <button
                  onClick={() => { allVisibleRowsSmall(lid) ? setLaneRowsNormal(lid) : setLaneRowsSmall(lid); setOpenLaneSettings(null); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
                >
                  {allVisibleRowsSmall(lid)
                    ? <><UnfoldMoreIcon style={{ fontSize: 14 }} /><span>Expand all {rowLabel.toLowerCase()}s</span></>
                    : <><UnfoldLessIcon style={{ fontSize: 14 }} /><span>Collapse all {rowLabel.toLowerCase()}s</span></>
                  }
                </button>
              )}
              {!isLaneCollapsed(lid) && laneHasHiddenRows(lid) && (
                <button onClick={() => { showAllLaneRows(lid); setOpenLaneSettings(null); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left text-blue-700"
                >
                  <VisibilityIcon style={{ fontSize: 14 }} />
                  <span>Show hidden {rowLabel.toLowerCase()}s</span>
                </button>
              )}
              {!isLaneCollapsed(lid) && lanePhasesMap[lid]?.length > 0 && (
                <button
                  onClick={() => {
                    if (collapseAllLanePhases) {
                      const allIds = Object.keys(lanePhasesMap).filter(k => lanePhasesMap[k]?.length > 0).map(Number);
                      const newSet = new Set(allIds.filter(id => id !== (typeof lid === 'string' ? parseInt(lid, 10) : lid)));
                      setCollapsedLanePhaseRows(newSet);
                      setCollapseAllLanePhases(false);
                    } else {
                      setCollapsedLanePhaseRows(prev => { const n = new Set(prev); if (n.has(lid)) n.delete(lid); else n.add(lid); return n; });
                    }
                    setOpenLaneSettings(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
                >
                  {(collapseAllLanePhases || collapsedLanePhaseRows.has(lid))
                    ? <><VisibilityIcon style={{ fontSize: 14 }} /><span>Show {laneLabel.toLowerCase()} phases</span></>
                    : <><VisibilityOffIcon style={{ fontSize: 14 }} /><span>Hide {laneLabel.toLowerCase()} phases</span></>
                  }
                </button>
              )}
              <div className="border-t border-slate-100 my-1" />
              {/* Change color */}
              <button onClick={(e) => { e.stopPropagation(); setLaneColorPickerOpen(p => !p); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
              >
                <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0" style={{ backgroundColor: lanes[lid]?.color || '#94a3b8' }} />
                <span>Change color</span>
                <PaletteIcon style={{ fontSize: 13, marginLeft: 'auto', opacity: 0.4 }} />
              </button>
              {laneColorPickerOpen && (
                <div className="px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {laneColors.map(color => (
                      <button key={color} onClick={() => handleLaneColorChange(lid, color)}
                        className="w-5 h-5 rounded-full transition hover:scale-110 flex-shrink-0"
                        style={{ backgroundColor: color, outline: (lanes[lid]?.color || '#94a3b8') === color ? '2px solid #1e293b' : '2px solid transparent', outlineOffset: '1px' }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={lanes[lid]?.color || '#94a3b8'} onChange={(e) => handleLaneColorChange(lid, e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0.5" />
                    <span className="text-xs text-slate-400 font-mono">{lanes[lid]?.color || '#94a3b8'}</span>
                  </div>
                </div>
              )}
              <div className="border-t border-slate-100 my-1" />
              <button onClick={() => { toggleLaneVisibility(lid); setOpenLaneSettings(null); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-red-50 transition text-left text-red-700"
              >
                <VisibilityOffIcon style={{ fontSize: 14 }} />
                <span>Hide {laneLabel.toLowerCase()}</span>
              </button>
            </div>
          </div>
        );
      })()}

      <GridWarningToast warningMessages={warningMessages} />

      {/* Page wrapper */}
      <div
        className="p-10 w-full min-w-0 select-none"
        style={{
          background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)',
          ...(viewTransition === 'out' ? { transition: 'transform 0.2s ease-in, opacity 0.2s ease-in', transform: 'translateX(-50px)', opacity: 0 }
            : viewTransition === 'in-start' ? { transform: 'translateX(50px)', opacity: 0 }
            : viewTransition === 'in' ? { transition: 'transform 0.25s ease-out, opacity 0.25s ease-out', transform: 'translateX(0)', opacity: 1 }
            : {}),
        }}
        onClick={() => {
          if (justDraggedRef.current) return;
          setSelectedEdges([]);
          setOpenLaneSettings(null);
          setShowSettingsDropdown(false);
          setShowFilterDropdown(false);
          setSelectedNodes(new Set());
          setIsAddingNode(false);
          setPopupCloseSignal(c => c + 1);
        }}
      >
        <div className="mb-4">
          <div className="flex items-end gap-0.5 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); setToolbarCollapsed(!toolbarCollapsed); playSound('uiClick'); }}
              className="px-3 py-1 flex items-center gap-1 rounded-t-md bg-white border border-b-0 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 text-xs transition"
              title={toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar'}
            >
              {toolbarCollapsed ? <UnfoldMoreIcon style={{ fontSize: 14 }} /> : <UnfoldLessIcon style={{ fontSize: 14 }} />}
              <span className="text-[10px]">{toolbarCollapsed ? 'Show' : 'Hide'}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setHeaderCollapsed(!headerCollapsed); playSound('uiClick'); }}
              className={`px-3 py-1 flex items-center gap-1 rounded-t-md border border-b-0 text-xs transition ${
                headerCollapsed ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              title={headerCollapsed ? 'Show header' : 'Hide header'}
            >
              <VerticalAlignTopIcon style={{ fontSize: 14 }} />
              <span className="text-[10px]">Header</span>
            </button>
            {toolbarCollapsed && <span className="ml-2 text-[11px] text-slate-400 pb-0.5">{typeof activeViewName === 'string' ? activeViewName : 'Default'}</span>}
          </div>

          {!toolbarCollapsed && (
            <GridToolbar
              laneLabel={laneLabel}
              rowLabel={rowLabel}
              nodeLabel={nodeLabel}
              edgeLabel={edgeLabel}
              columnLabel={columnLabel}
              laneOrder={laneOrder}
              lanes={lanes}
              laneDisplaySettings={laneDisplaySettings}
              setLaneDisplaySettings={setLaneDisplaySettings}
              showFilterDropdown={showFilterDropdown}
              setShowFilterDropdown={setShowFilterDropdown}
              viewMode={viewMode}
              setViewMode={setViewMode}
              mode={mode}
              baseViewModeRef={baseViewModeRef}
              autoSelectBlocking={autoSelectBlocking}
              setAutoSelectBlocking={setAutoSelectBlocking}
              resizeAllSelected={resizeAllSelected}
              setResizeAllSelected={setResizeAllSelected}
              warningDuration={warningDuration}
              setWarningDuration={setWarningDuration}
              showSettingsDropdown={showSettingsDropdown}
              setShowSettingsDropdown={setShowSettingsDropdown}
              hideAllEdges={hideAllEdges}
              setHideAllEdges={setHideAllEdges}
              hideCollapsedEdges={hideCollapsedEdges}
              setHideCollapsedEdges={setHideCollapsedEdges}
              hideCollapsedNodes={hideCollapsedNodes}
              setHideCollapsedNodes={setHideCollapsedNodes}
              showEmptyLanes={showEmptyLanes}
              setShowEmptyLanes={setShowEmptyLanes}
              customColumnWidth={customColumnWidth}
              setCustomColumnWidth={setCustomColumnWidth}
              customRowHeightNormal={customRowHeightNormal}
              setCustomRowHeightNormal={setCustomRowHeightNormal}
              customRowHeightSmall={customRowHeightSmall}
              setCustomRowHeightSmall={setCustomRowHeightSmall}
              setShowCreateLaneModal={setShowCreateLaneModal}
              setShowCreateRowModal={setShowCreateRowModal}
              setNewRowLaneId={setNewRowLaneId}
              isAddingNode={isAddingNode}
              setIsAddingNode={setIsAddingNode}
              safeMode={safeMode}
              hiddenLaneCount={hiddenLaneCount}
              isLaneVisible={isLaneVisible}
              setLaneRowsSmall={setLaneRowsSmall}
              setLaneRowsNormal={setLaneRowsNormal}
              showAllHiddenLanes={showAllHiddenLanes}
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              onDeleteSelected={handleDeleteSelected}
              onBulkUpdateEdges={handleBulkUpdateEdges}
              refactorMode={refactorMode}
              setRefactorMode={setRefactorMode}
              expandedRowView={expandedRowView}
              setExpandedRowView={setExpandedRowView}
              collapseAllLanes={collapseAllLanes}
              expandAllLanes={expandAllLanes}
              edgeSettings={edgeSettings}
              setEdgeSettings={setEdgeSettings}
              allEdges={edges}
              handleUpdateEdge={handleUpdateEdge}
              setEdgeEditModal={setEdgeEditModal}
              selectedColumns={selectedColumns}
              collapsedColumns={collapsedColumns}
              collapseSelectedColumns={collapseSelectedColumns}
              uncollapseAllColumns={uncollapseAllColumns}
              clearColumnSelection={clearColumnSelection}
              phases={phases}
              setPhaseEditModal={setPhaseEditModal}
              showPhaseColorsInGrid={showPhaseColorsInGrid}
              setShowPhaseColorsInGrid={setShowPhaseColorsInGrid}
              collapsedLanePhaseRows={collapsedLanePhaseRows}
              collapseAllLanePhases={collapseAllLanePhases}
              showAllLanePhases={showAllLanePhases}
              hideAllLanePhases={hideAllLanePhases}
              lanePhasesMap={lanePhasesMap}
              savedViews={savedViews}
              activeViewId={activeViewId}
              activeViewName={activeViewName}
              onLoadView={handleLoadView}
              onSaveView={handleSaveView}
              onCreateView={handleCreateView}
              onRenameView={handleRenameView}
              onDeleteView={handleDeleteView}
              onSetDefaultView={handleSetDefaultView}
              onUpdateViewShortcut={handleUpdateViewShortcut}
              viewShortcuts={viewShortcuts}
              snapshots={snapshots}
              snapshotsLoading={snapshotsLoading}
              onCreateSnapshot={handleCreateSnapshot}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onRenameSnapshot={handleRenameSnapshot}
              hideGlobalPhases={hideGlobalPhases}
              setHideGlobalPhases={setHideGlobalPhases}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              hideColumnHeader={hideColumnHeader}
              setHideColumnHeader={setHideColumnHeader}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              allRowsSmall={laneOrder.every(lid => {
                if (!isLaneVisible(lid)) return true;
                const lane = lanes[lid];
                if (!lane) return true;
                const visible = (lane.rows || lane.tasks || []).filter(r => isRowVisible(r, rowDisplaySettings));
                return visible.length === 0 || visible.every(r => rowDisplaySettings[r]?.size === 'small');
              })}
              allLanesCollapsed={laneOrder.every(lid => !isLaneVisible(lid) || laneDisplaySettings[lid]?.collapsed)}
              popupCloseSignal={popupCloseSignal}
              userShortcuts={userShortcuts}
              onSaveShortcuts={handleSaveShortcuts}
              onRunSafetyCheck={runSafetyCheck}
              safetyCheckRunning={safetyCheckRunning}
            />
          )}
        </div>

        <GridCanvas
          containerRef={containerRef}
          totalColumns={totalColumns}
          contentHeight={contentHeight}
          layout={layout}
          data={data}
          displayState={displayState}
          handlers={handlers}
        />
      </div>

      {/* Row multi-select bar */}
      <GridRowSelectionBar
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        rows={rows}
        onImport={onBulkImport}
        buildClipboardText={buildClipboardText}
      />

      {/* Safety check panel */}
      {showSafetyPanel && (
        <SafetyCheckPanel
          results={safetyCheckResults}
          isRunning={safetyCheckRunning}
          onClose={() => setShowSafetyPanel(false)}
          onLocateIssue={(issue) => {
            handleLoadView(null);
            setTimeout(() => {
              if (issue.nodeIds?.length || issue.milestoneIds?.length) {
                const ids = issue.nodeIds || issue.milestoneIds;
                setSelectedNodes(new Set(ids));
                ids.forEach(id => showBlockingFeedback(id));
              }
            }, 300);
            setShowSafetyPanel(false);
          }}
        />
      )}

      {/* View name flash overlay */}
      {viewFlashName && (
        <div
          key={viewFlashName.key}
          style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 99999, pointerEvents: 'none', animation: 'viewFlashFade 1.2s ease-out forwards' }}
          className="px-8 py-4 rounded-2xl bg-black/60 backdrop-blur-sm text-white text-2xl font-bold tracking-wide shadow-2xl"
        >
          {viewFlashName.name}
        </div>
      )}

      {/* Adapter-supplied extra content (refactor banner, etc.) */}
      {children}
    </>
  );
}
