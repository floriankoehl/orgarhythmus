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
  const [viewMode, setViewMode] = useState("schedule");
  const baseViewModeRef = useRef("schedule");
  const [autoSelectBlocking, setAutoSelectBlocking] = useState(true);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editingMilestoneName, setEditingMilestoneName] = useState("");

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
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
  };

  return (
    <DependencyContext.Provider value={value}>
      {children}
    </DependencyContext.Provider>
  );
}
