import { useGridBoardContext } from './GridBoardContext.jsx';

// Thin accessor layer - UI state is owned by GridBoardContext
export function useGridUIState() {
  const {
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
  } = useGridBoardContext();

  return {
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
  };
}
