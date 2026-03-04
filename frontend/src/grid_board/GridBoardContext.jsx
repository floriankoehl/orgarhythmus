import { createContext, useContext, useRef, useState, useCallback } from "react";
import { playSound } from '../assets/sound_registry';

export const GridBoardContext = createContext(null);

export function useGridBoardContext() {
  const ctx = useContext(GridBoardContext);
  if (!ctx) {
    throw new Error("useGridBoardContext must be used inside GridBoardProvider");
  }
  return ctx;
}

// ── Undo/Redo history (max entries) ──
const MAX_HISTORY = 10;

/**
 * GridBoardProvider — manages transient UI state for a DependencyGrid instance.
 *
 * Props that used to come from useParams (projectId) are now injected
 * explicitly so the component is route-agnostic.
 */
export function GridBoardProvider({ children }) {
  const containerRef = useRef(null);

  // UI State - centralized here
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectedEdges, setSelectedEdges] = useState([]);
  const [viewMode, setViewMode] = useState("inspection");
  const baseViewModeRef = useRef("inspection");
  const [autoSelectBlocking, setAutoSelectBlocking] = useState(true);
  const [resizeAllSelected, setResizeAllSelected] = useState(true);
  const [warningDuration, setWarningDuration] = useState(2000); // ms
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingNodeName, setEditingNodeName] = useState("");

  // Clipboard for copy/paste nodes
  const [clipboard, setClipboard] = useState(null); // { nodes: [...], edges: [...] }

  // Row multi-select (Ctrl+Click) for bulk export/import
  const [selectedRows, setSelectedRows] = useState(new Set());

  // ── Undo/Redo History ──
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const isUndoRedoingRef = useRef(false);
  const [historyCounter, setHistoryCounter] = useState(0);

  const pushAction = useCallback((action) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), action];
    futureRef.current = [];
    setHistoryCounter(c => c + 1);
  }, []);

  const undo = useCallback(async () => {
    if (historyRef.current.length === 0 || isUndoRedoingRef.current) return;
    isUndoRedoingRef.current = true;
    const action = historyRef.current[historyRef.current.length - 1];
    try {
      await action.undo();
      historyRef.current = historyRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, action];
      setHistoryCounter(c => c + 1);
      playSound('undo');
    } catch (err) {
      console.error("Undo failed:", err);
    }
    isUndoRedoingRef.current = false;
  }, []);

  const redo = useCallback(async () => {
    if (futureRef.current.length === 0 || isUndoRedoingRef.current) return;
    isUndoRedoingRef.current = true;
    const action = futureRef.current[futureRef.current.length - 1];
    try {
      await action.redo();
      futureRef.current = futureRef.current.slice(0, -1);
      historyRef.current = [...historyRef.current, action];
      setHistoryCounter(c => c + 1);
    } catch (err) {
      console.error("Redo failed:", err);
    }
    isUndoRedoingRef.current = false;
  }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const value = {
    containerRef,
    // UI State
    hoveredNode,
    setHoveredNode,
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
    clipboard,
    setClipboard,
    selectedRows,
    setSelectedRows,
    // Undo/Redo
    pushAction,
    undo,
    redo,
    canUndo,
    canRedo,
    isUndoRedoingRef,
    historyCounter,
  };

  return (
    <GridBoardContext.Provider value={value}>
      {children}
    </GridBoardContext.Provider>
  );
}
