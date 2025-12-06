import "reactflow/dist/style.css";
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  useReactFlow,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  Position,
} from "reactflow";
import {
  add_dependency,
  fetch_all_tasks,
  all_dependencies,
  delete_dependency,
} from "../org_API";
import dagre from "@dagrejs/dagre";
import Button from "@mui/material/Button";
import { Plus, BarChart3, SlidersHorizontal, X } from "lucide-react";
import CreateTaskForm from "../org_components/CreateTaskForm";
import SMTaskCard from "../org_components/TaskCardSM";

// -----------------------------------------------------------------------------
// Layout helper
// -----------------------------------------------------------------------------
const nodeWidth = 180;
const nodeHeight = 60;

export function getLayoutedNodes(nodes, edges, direction = "TB") {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // TB = top-bottom, LR = left-right
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const { x, y } = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x, y },
    };
  });
}

// -----------------------------------------------------------------------------
// Custom Task Node
// -----------------------------------------------------------------------------
function TaskNode({ data }) {
  const teamColor = data.team?.color || "#0f172a";

  return (
    <div
      className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-150 px-3 py-2 text-xs cursor-pointer"
      style={{
        borderColor: teamColor + "55",
      }}
    >
      {/* Handles for edges */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{data.name}</p>
          {data.team && (
            <div className="mt-1 flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: teamColor }}
              />
              <span className="text-[10px] text-slate-600 truncate">
                {data.team.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[1px]">
          P: <span className="ml-1 font-semibold">{data.priority}</span>
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[1px]">
          D: <span className="ml-1 font-semibold">{data.difficulty}</span>
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { task: TaskNode };

// -----------------------------------------------------------------------------
// Small stats bar for dependencies view
// -----------------------------------------------------------------------------
function DependencyStats({ tasks, edges }) {
  const totalTasks = tasks.length;
  const totalDeps = edges.length;
  const avgFanOut =
    totalTasks > 0 ? (totalDeps / totalTasks).toFixed(2) : "-";

  const rootTasks = tasks.filter(
    (t) => !edges.some((e) => String(e.target) === String(t.id))
  ).length;
  const leafTasks = tasks.filter(
    (t) => !edges.some((e) => String(e.source) === String(t.id))
  ).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-sm shadow-sm p-3 sm:p-4 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Tasks
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {totalTasks}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Nodes in your graph
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Dependencies
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {totalDeps}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Directed edges (Vortakt → Nachtakt)
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Avg. fan-out
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {avgFanOut}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Dependencies per task
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Roots / Leaves
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {rootTasks} / {leafTasks}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            No parents / no children
          </p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function Dependencies() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [activePanel, setActivePanel] = useState(null); // "create" | "stats" | "settings" | null
  const [layoutDirection, setLayoutDirection] = useState("TB"); // "TB" or "LR"

  const { fitView } = useReactFlow();

  // Reusable data loader
  const loadData = useCallback(async () => {
    // 1. Load dependencies
    const fetched_dependencies = await all_dependencies();
    const safeDeps = fetched_dependencies || [];

    const DepEdges = safeDeps.map((dep) => ({
      id: String(dep.id),
      source: String(dep.vortakt),
      target: String(dep.nachtakt),
    }));

    // 2. Load tasks
    const fetched_tasks = await fetch_all_tasks();
    const safeTasks = fetched_tasks || [];
    setTasks(safeTasks);

    const tasknodes = safeTasks.map((task) => ({
      id: String(task.id),
      type: "task",
      position: { x: 0, y: 0 },
      data: { ...task, name: task.name },
    }));

    // 3. Layout with current direction
    const layouted = getLayoutedNodes(tasknodes, DepEdges, layoutDirection);
    setNodes(layouted);
    setEdges(DepEdges);

    // 4. Fit
    setTimeout(() => fitView({ padding: 0.2 }), 0);
  }, [fitView, layoutDirection]);

  // Load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Add dependency
  const onConnect = useCallback(
    async (connection) => {
      if (!connection.source || !connection.target) return;

      const created = await add_dependency(
        connection.source,
        connection.target
      );

      const newEdge = {
        id: String(created.id),
        source: String(created.vortakt),
        target: String(created.nachtakt),
      };

      setEdges((eds) => {
        const nextEdges = [...eds, newEdge];
        setNodes((nds) =>
          getLayoutedNodes(nds, nextEdges, layoutDirection)
        );
        setTimeout(() => fitView({ padding: 0.2 }), 0);
        return nextEdges;
      });
    },
    [fitView, layoutDirection]
  );

  // Connection validation
  const isValidConnection = useCallback((connection) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    // later: prevent circular deps etc.
    return true;
  }, []);

  // Draggable nodes
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Edge click → select & show settings
  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setActivePanel((prev) => (prev === "settings" ? prev : "settings"));
  }, []);

  // Node double click → open TaskCard panel
  const onNodeDoubleClick = useCallback(
    (event, node) => {
      event.stopPropagation();
      const taskId = Number(node.id);
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        setSelectedTask(found);
      }
    },
    [tasks]
  );

  // Delete dependency
  async function handle_dep_deletion() {
    if (!selectedEdge) return;
    const ok = window.confirm("Delete this dependency?");
    if (!ok) return;

    try {
      await delete_dependency(selectedEdge.id);

      setEdges((eds) => {
        const nextEdges = eds.filter((e) => e.id !== selectedEdge.id);
        setNodes((nds) =>
          getLayoutedNodes(nds, nextEdges, layoutDirection)
        );
        setTimeout(() => fitView({ padding: 0.2 }), 0);
        return nextEdges;
      });

      setSelectedEdge(null);
    } catch (err) {
      console.error("Could not delete dependency", err);
    }
  }

  // Layout direction change
  const handleLayoutChange = (dir) => {
    setLayoutDirection(dir);
    setNodes((nds) => getLayoutedNodes(nds, edges, dir));
    setTimeout(() => fitView({ padding: 0.2 }), 0);
  };

  const showStats = activePanel === "stats";
  const showCreate = activePanel === "create";
  const showSettings = activePanel === "settings";

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-8 flex flex-col gap-4">
        {/* Top bar */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              Dependency Graph
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Visualize how your tasks depend on each other and fine-tune the
              rhythm.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
            <Button
              variant={showStats ? "contained" : "outlined"}
              size="small"
              onClick={() =>
                setActivePanel((prev) => (prev === "stats" ? null : "stats"))
              }
              style={{
                textTransform: "none",
                display: "flex",
                gap: "0.35rem",
                alignItems: "center",
                borderRadius: "9999px",
              }}
            >
              <BarChart3 size={16} />
              Stats
            </Button>

            <Button
              variant={showSettings ? "contained" : "outlined"}
              size="small"
              onClick={() =>
                setActivePanel((prev) =>
                  prev === "settings" ? null : "settings"
                )
              }
              style={{
                textTransform: "none",
                display: "flex",
                gap: "0.35rem",
                alignItems: "center",
                borderRadius: "9999px",
              }}
            >
              <SlidersHorizontal size={16} />
              Settings
            </Button>

            <Button
              variant="contained"
              size="medium"
              onClick={() =>
                setActivePanel((prev) =>
                  prev === "create" ? null : "create"
                )
              }
              style={{
                textTransform: "none",
                display: "flex",
                gap: "0.4rem",
                alignItems: "center",
                borderRadius: "9999px",
                paddingInline: "1.1rem",
              }}
            >
              <Plus size={18} />
              New Task
            </Button>
          </div>
        </header>

        {/* Panels row */}
        {(showStats || showCreate || showSettings) && (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: stats or settings or empty */}
            <div className="flex-1 min-w-0 space-y-3">
              {showStats && <DependencyStats tasks={tasks} edges={edges} />}

              {showSettings && (
                <div className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-sm shadow-sm p-4 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold tracking-[0.16em] uppercase text-slate-500">
                      Graph settings
                    </h2>
                  </div>

                  {/* Layout direction */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-600 mb-1">
                      Layout direction
                    </p>
                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs">
                      <button
                        onClick={() => handleLayoutChange("TB")}
                        className={`px-3 py-1 rounded-full ${
                          layoutDirection === "TB"
                            ? "bg-white shadow-sm text-slate-900"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Top → Bottom
                      </button>
                      <button
                        onClick={() => handleLayoutChange("LR")}
                        className={`px-3 py-1 rounded-full ${
                          layoutDirection === "LR"
                            ? "bg-white shadow-sm text-slate-900"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Left → Right
                      </button>
                    </div>
                  </div>

                  {/* Selected edge controls */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1">
                      Selected dependency
                    </p>
                    {selectedEdge ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          {selectedEdge.source} → {selectedEdge.target}
                        </p>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={handle_dep_deletion}
                          style={{ textTransform: "none" }}
                        >
                          Delete dependency
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Click an edge in the graph to edit or delete it.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: create panel */}
            {showCreate && (
              <div className="lg:w-[340px] w-full">
                <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-md p-4 relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-xs font-semibold tracking-[0.16em] uppercase text-slate-500">
                        Create task
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        New tasks will appear as nodes in the graph.
                      </p>
                    </div>
                    <button
                      onClick={() => setActivePanel(null)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <CreateTaskForm
                    onTaskCreated={() => {
                      loadData();
                      setActivePanel(null);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main graph + side task details */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[400px]">
          <div className="flex-1 min-h-[400px] rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgeClick={onEdgeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              fitView
            >
              <Background variant="dots" gap={16} size={1} />
              <Controls />
            </ReactFlow>
          </div>

          {/* Task detail panel when you double click a node */}
          {selectedTask && (
            <div className="lg:w-[340px] w-full rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-md p-4 relative">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xs font-semibold tracking-[0.16em] uppercase text-slate-500">
                    Task details
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Double-click another node to switch tasks.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <SMTaskCard
                task={selectedTask}
                onTaskDeleted={() => {
                  setSelectedTask(null);
                  loadData();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
