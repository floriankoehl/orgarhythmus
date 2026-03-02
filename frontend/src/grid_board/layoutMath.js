// ==========================================
// Layout Constants (defaults)
// ==========================================
export const DEFAULT_ROWHEIGHT_NORMAL = 32;
export const DEFAULT_ROWHEIGHT_SMALL = 22;
export const ROWLABELWIDTH = 200;
export const LANEWIDTH = 150;
export const LANE_DRAG_HIGHLIGHT_HEIGHT = 5;
export const MARGIN_BETWEEN_DRAG_HIGHLIGHT = 5;
export const LANE_HEADER_LINE_HEIGHT = 3;
export const LANE_HEADER_GAP = 2;
export const DEFAULT_COLUMNWIDTH = 60;
export const HEADER_HEIGHT = 48;
export const ROW_DROP_INDICATOR_HEIGHT = 3;
export const CONNECTION_RADIUS = 20;
export const COLUMN_LABEL_WIDTH_THRESHOLD = 45;
export const LANE_COLLAPSED_HEIGHT = 32;
export const LANE_PHASE_ROW_HEIGHT = 20;  // height of per-lane phase bar row

// Column resize limits
export const MIN_LANEWIDTH = 80;
export const MAX_LANEWIDTH = 400;
export const MIN_ROWLABELWIDTH = 100;
export const MAX_ROWLABELWIDTH = 500;

// ==========================================
// Pure Utility Functions
// ==========================================

// Helper to determine high-contrast text color (black or white) for a given background hex color
export const getContrastTextColor = (hex) => {
  if (!hex || !hex.startsWith('#')) return '#000';
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000' : '#fff';
};

// Helper function to lighten a hex color while keeping high opacity
export const lightenColor = (hex, amount = 0.9) => {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  
  return `rgba(${newR}, ${newG}, ${newB}, 0.95)`;
};

// Helper to check if row is visible
export const isRowVisible = (rowId, rowDisplaySettings) => {
  const settings = rowDisplaySettings[rowId];
  return settings ? !settings.hidden : true;
};

// Calculate days between two dates
export function daysBetween(start, end) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    const diffMs = endDate - startDate
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    return diffDays
}

// ==========================================
// row Height Functions
// ==========================================

export const getRowHeight = (rowId, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL) => {
    const settings = rowDisplaySettings[rowId];
    if (!settings || settings.hidden) return 0;
    return settings.size === 'small' ? ROWHEIGHT_SMALL : ROWHEIGHT_NORMAL;
};

export const getRawLaneHeight = (lane, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL) => {
    if (!lane) return 0;
    
    let height = 0;
    for (const rowId of lane.rows) {
      height += getRowHeight(rowId, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL);
    }
    return height;
};

// ==========================================
// lane Height and Offset Functions
// ==========================================

export const getLaneHeightBase = (lane, laneDisplaySettings, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL, LANE_MIN_HEIGHT, LANE_COLLAPSED_HEIGHT_VAL, lanePhaseRowHeight = 0) => {
    if (!lane) return LANE_MIN_HEIGHT;
    
    if (laneDisplaySettings[lane.id]?.collapsed) {
      return LANE_COLLAPSED_HEIGHT_VAL;
    }
    
    let height = 0;
    for (const rowId of lane.rows) {
      height += getRowHeight(rowId, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL);
    }
    return Math.max(height, LANE_MIN_HEIGHT) + lanePhaseRowHeight;
};

export const getLaneYOffset = (laneId, laneOrder, isLaneVisibleFn, getLaneHeightFn, layoutConstants) => {
    const { HEADER_HEIGHT, LANE_DRAG_HIGHLIGHT_HEIGHT, MARGIN_BETWEEN_DRAG_HIGHLIGHT, LANE_HEADER_LINE_HEIGHT, LANE_HEADER_GAP } = layoutConstants;
    let offset = HEADER_HEIGHT;
    for (const tid of laneOrder) {
      if (tid === laneId) break;
      if (!isLaneVisibleFn(tid)) continue;
      offset += LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
      offset += LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
      offset += getLaneHeightFn(tid);
    }
    return offset;
};

export const getRowYOffset = (rowId, lane, isRowVisibleFn, getRowHeightFn, rowDisplaySettings) => {
    if (!lane) return 0;
    let offset = 0;
    for (const tid of lane.rows) {
      if (tid === rowId) break;
      if (!isRowVisibleFn(tid, rowDisplaySettings)) continue;
      offset += getRowHeightFn(tid, rowDisplaySettings);
    }
    return offset;
};

// ==========================================
// Visibility and Filtering Functions
// ==========================================

export const getVisibleRows = (lane, rowDisplaySettings) => {
    if (!lane) return [];
    return lane.rows.filter(rowId => isRowVisible(rowId, rowDisplaySettings));
};

export const getVisibleLaneIndex = (laneId, laneOrder, isLaneVisibleFn) => {
    let index = 0;
    for (const tid of laneOrder) {
      if (tid === laneId) return index;
      if (isLaneVisibleFn(tid)) index++;
    }
    return index;
};

export const isLaneVisibleBase = (laneId, laneDisplaySettings, lanes, rowDisplaySettings, showEmptyLanes = true, nodes = null) => {
    const settings = laneDisplaySettings[laneId];
    if (settings?.hidden) return false;
    
    // Hide empty lanes (lanes with no nodes) when showEmptyLanes is off
    if (!showEmptyLanes && nodes) {
      const lane = lanes[laneId];
      if (lane) {
        const laneRows = lane.rows || [];
        const hasNode = laneRows.some(rowKey => {
          const rowSetting = rowDisplaySettings[rowKey];
          // Check if any node belongs to this row
          return Object.values(nodes).some(m => String(m.row) === String(rowKey));
        });
        if (!hasNode) return false;
      }
    }

    return true;
};

// ==========================================
// Drop Indicator Functions
// ==========================================

export const getRowDropIndicatorY = (rowDropTarget, getLaneYOffsetFn, getVisibleRowsFn, getRowHeightFn, rowDisplaySettings, layoutConstants, getLanePhaseRowHeightFn) => {
    if (!rowDropTarget) return 0;
    const { LANE_DRAG_HIGHLIGHT_HEIGHT, MARGIN_BETWEEN_DRAG_HIGHLIGHT, LANE_HEADER_LINE_HEIGHT, LANE_HEADER_GAP } = layoutConstants;
    const { laneId, insertIndex } = rowDropTarget;
    const laneYOffset = getLaneYOffsetFn(laneId);
    const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
    const phaseRowOffset = getLanePhaseRowHeightFn ? getLanePhaseRowHeightFn(laneId) : 0;
    
    const visibleRows = getVisibleRowsFn(laneId);
    let rowOffset = 0;
    for (let i = 0; i < insertIndex && i < visibleRows.length; i++) {
      rowOffset += getRowHeightFn(visibleRows[i], rowDisplaySettings);
    }
    
    return laneYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + rowOffset;
};

// ==========================================
// Content Height Calculation
// ==========================================

export const calculateContentHeight = (laneOrder, isLaneVisibleFn, getLaneHeightFn, layoutConstants) => {
    const { HEADER_HEIGHT, LANE_DRAG_HIGHLIGHT_HEIGHT, MARGIN_BETWEEN_DRAG_HIGHLIGHT, LANE_HEADER_LINE_HEIGHT, LANE_HEADER_GAP } = layoutConstants;
    let height = HEADER_HEIGHT;
    for (const laneId of laneOrder) {
      if (!isLaneVisibleFn(laneId)) continue;
      height += LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
      height += LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
      height += getLaneHeightFn(laneId);
    }
    height += LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
    return height;
};

// ==========================================
// SVG Path Functions
// ==========================================

export const getConnectionPath = (x1, y1, x2, y2) => {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
};

export const getStraightPath = (x1, y1, x2, y2) => {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
};

// ==========================================
// node Position Computation
// ==========================================

/**
 * Compute the 2D pixel position of every node in the layout.
 *
 * Returns an array of node objects enriched with:
 *   x         — left edge (px) in content-space (includes LANEWIDTH + ROWLABELWIDTH offset)
 *   y         — top edge (px) aligned to the row's top
 *   w         — pixel width of the node block
 *   h         — pixel height (equals the full row row height)
 *   laneColor — color of the owning lane
 *
 * Callers convert (x, y, w, h) to whatever coordinate space they need:
 *   2D rendering : use x, y + 2, w, h - 4  (standard 2px margin)
 *   3D projection: center = (x + w/2, y + h/2), then apply board transform
 *
 * This is the single source of truth for node layout coordinates.
 * Both the 2D node overlay and the 3D projection layer must call this
 * function instead of re-deriving positions independently.
 */
export function computeNodePixelPositions({
    laneOrder,
    lanes,
    nodes,
    rowDisplaySettings,
    laneDisplaySettings = {},
    lanePhasesMap,
    effectiveHeaderH,
    LANEWIDTH,
    ROWLABELWIDTH,
    COLUMNWIDTH,
    ROWHEIGHT_SMALL = DEFAULT_ROWHEIGHT_SMALL,
    ROWHEIGHT_NORMAL = DEFAULT_ROWHEIGHT_NORMAL,
}) {
    const result = [];
    let yOffset = effectiveHeaderH;

    for (const laneId of laneOrder) {
        const lane = lanes[laneId];
        if (!lane) continue;

        // Skip hidden lanes entirely
        const laneSettings = laneDisplaySettings[laneId];
        if (laneSettings?.hidden) continue;

        yOffset += LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
        yOffset += LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;

        const lanePhases = lanePhasesMap ? (lanePhasesMap[laneId] || []) : [];
        const phaseRowH = lanePhases.length > 0 ? LANE_PHASE_ROW_HEIGHT : 0;

        // Collapsed lanes: accumulate collapsed height, skip node rendering
        if (laneSettings?.collapsed) {
            yOffset += phaseRowH + LANE_COLLAPSED_HEIGHT;
            continue;
        }

        const rowsStartY = yOffset + phaseRowH;

        const visibleRowIds = getVisibleRows(lane, rowDisplaySettings);
        for (const rowId of visibleRowIds) {
            const th = getRowHeight(rowId, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL);
            const rowYOff = getRowYOffset(
                rowId,
                lane,
                isRowVisible,
                (id, ds) => getRowHeight(id, ds, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL),
                rowDisplaySettings,
            );
            const rowY = rowsStartY + rowYOff;

            const rowNodes = Object.values(nodes).filter(
                (ms) => String(ms.row) === String(rowId),
            );
            for (const m of rowNodes) {
                result.push({
                    ...m,
                    x: LANEWIDTH + ROWLABELWIDTH + m.startColumn * COLUMNWIDTH,
                    y: rowY,
                    w: (m.duration || 1) * COLUMNWIDTH,
                    h: th,
                    laneColor: lane.color || '#94a3b8',
                });
            }
        }

        const rawH = getRawLaneHeight(lane, rowDisplaySettings, ROWHEIGHT_SMALL, ROWHEIGHT_NORMAL);
        yOffset += phaseRowH + Math.max(rawH, LANE_COLLAPSED_HEIGHT);
    }

    return result;
}
