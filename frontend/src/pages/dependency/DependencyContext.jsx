import { createContext, useContext, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";

export const DependencyContext = createContext(null);

export function useDependencyContext() {
  const ctx = useContext(DependencyContext);
  if (!ctx) {
    throw new Error("useDependencyContext must be used inside DependencyProvider");
  }
  return ctx;
}

export function useDependency() {
  const ctx = useContext(DependencyContext);
  if (!ctx) {
    throw new Error("useDependency must be used inside DependencyProvider");
  }
  return ctx;
}

// ── Undo/Redo history (max entries) ──
const MAX_HISTORY = 10;

export function DependencyProvider({ children }) {
  const { projectId } = useParams();
  const teamContainerRef = useRef(null);

  // UI State - centralized here
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [selectedMilestones, setSelectedMilestones] = useState(new Set());
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [viewMode, setViewMode] = useState("inspection");
  const baseViewModeRef = useRef("inspection");
  const [autoSelectBlocking, setAutoSelectBlocking] = useState(true);
  const [warningDuration, setWarningDuration] = useState(2000); // ms
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editingMilestoneName, setEditingMilestoneName] = useState("");

  // Clipboard for copy/paste milestones
  const [clipboard, setClipboard] = useState(null); // { milestones: [...], connections: [...] }

  // ── Undo/Redo History ──
  // Use refs for the stacks to avoid stale closures in event handlers
  const historyRef = useRef([]);   // undo stack: [{ undo: async fn, redo: async fn, description: string }]
  const futureRef = useRef([]);    // redo stack
  const isUndoRedoingRef = useRef(false);
  const [historyCounter, setHistoryCounter] = useState(0); // trigger re-renders for canUndo/canRedo

  const pushAction = useCallback((action) => {
    // action: { undo: async () => {}, redo: async () => {}, description: string }
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
    projectId,
    teamContainerRef,
    // UI State
    hoveredMilestone,
    setHoveredMilestone,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnections,
    setSelectedConnections,
    viewMode,
    setViewMode,
    baseViewModeRef,
    autoSelectBlocking,
    setAutoSelectBlocking,
    warningDuration,
    setWarningDuration,
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
    clipboard,
    setClipboard,
    // Undo/Redo
    pushAction,
    undo,
    redo,
    canUndo,
    canRedo,
    isUndoRedoingRef,
    historyCounter, // used to trigger re-reads of canUndo/canRedo
  };

  return (
    <DependencyContext.Provider value={value}>
      {children}
    </DependencyContext.Provider>
  );
}
