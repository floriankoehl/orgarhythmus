import { createContext, useContext, useRef, useState } from "react";
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

export function DependencyProvider({ children }) {
  const { projectId } = useParams();
  const teamContainerRef = useRef(null);

  // UI State - centralized here
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [selectedMilestones, setSelectedMilestones] = useState(new Set());
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [viewMode, setViewMode] = useState("inspection");
  const baseViewModeRef = useRef("inspection");
  const [autoSelectBlocking, setAutoSelectBlocking] = useState(true);
  const [warningDuration, setWarningDuration] = useState(2000); // ms
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editingMilestoneName, setEditingMilestoneName] = useState("");

  // Clipboard for copy/paste milestones
  const [clipboard, setClipboard] = useState(null); // { milestones: [...], connections: [...] }

  const value = {
    projectId,
    teamContainerRef,
    // UI State
    hoveredMilestone,
    setHoveredMilestone,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnection,
    setSelectedConnection,
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
  };

  return (
    <DependencyContext.Provider value={value}>
      {children}
    </DependencyContext.Provider>
  );
}
