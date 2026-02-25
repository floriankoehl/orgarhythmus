import { Users } from "lucide-react";

/**
 * Reform-category-to-team modal overlay.
 * Multi-step wizard:
 *   1. confirm     – "Are you sure?"
 *   2. project     – pick which project (only when NOT on a project page)
 *   3. ideas       – "Take ideas with you?" (transform each into a task)
 *   4. cleanup     – "Delete category & archive ideas, or keep them?"
 *
 * Rendered absolutely inside the IdeaBin floating window.
 */
export default function IdeaBinReformCategoryModal({
  reformModal,
  onClose,
  onExecute,
  setReformModal,
  reformLoading,
}) {
  if (!reformModal) return null;

  const { catData, step, projects, selectedProjectId } = reformModal;

  /* Whether the user needs to pick a project (not already inside one) */
  const needsProjectPick = !reformModal.autoProjectId;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 z-[50] rounded-b-lg" onClick={onClose} />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[51] min-w-[280px] max-w-[90%] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-400 to-blue-400 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
            <Users size={14} /> Reform to Team
          </span>
          <button onClick={onClose} className="text-indigo-800 hover:text-indigo-950 text-sm font-bold">
            ✕
          </button>
        </div>

        {/* Category preview */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700">{catData.name}</p>
        </div>

        <div className="p-4">
          {/* ── Step 1: Confirm ── */}
          {step === "confirm" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to reform the category{" "}
                <span className="font-semibold">"{catData.name}"</span> into a team?
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    setReformModal((prev) => ({
                      ...prev,
                      step: needsProjectPick ? "project" : "ideas",
                    }))
                  }
                  className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs font-medium"
                >
                  Yes, reform
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Pick project (only when not in a project URL) ── */}
          {step === "project" && (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-gray-600 leading-relaxed">
                Select the project for the new team:
              </p>
              <div className="max-h-[180px] overflow-y-auto border border-gray-200 rounded">
                {(!projects || projects.length === 0) && (
                  <p className="text-[10px] text-gray-400 p-2 italic">
                    No projects found. Connect a project to this context first.
                  </p>
                )}
                {projects?.map((p) => (
                  <div
                    key={p.id}
                    onClick={() =>
                      setReformModal((prev) => ({
                        ...prev,
                        selectedProjectId: p.id,
                      }))
                    }
                    className={`px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      selectedProjectId === p.id
                        ? "bg-indigo-100 text-indigo-900 font-medium"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() =>
                    setReformModal((prev) => ({ ...prev, step: "confirm" }))
                  }
                  className="text-[10px] text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <button
                  onClick={() =>
                    setReformModal((prev) => ({ ...prev, step: "ideas" }))
                  }
                  disabled={!selectedProjectId}
                  className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Take ideas? ── */}
          {step === "ideas" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Do you want to take the ideas with you?
                <br />
                <span className="text-[10px] text-gray-400">
                  Every idea in this category will be transformed into a task
                  assigned to the new team.
                </span>
              </p>
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() =>
                    setReformModal((prev) => ({
                      ...prev,
                      step: needsProjectPick ? "project" : "confirm",
                    }))
                  }
                  className="text-[10px] text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      onExecute({ takeIdeas: false, deleteAndArchive: false })
                    }
                    disabled={reformLoading}
                    className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    {reformLoading ? "Working..." : "No, just create the team"}
                  </button>
                  <button
                    onClick={() =>
                      setReformModal((prev) => ({ ...prev, step: "cleanup" }))
                    }
                    className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs font-medium"
                  >
                    Yes, take ideas
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Delete category & archive ideas? ── */}
          {step === "cleanup" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Do you want to delete the category and archive the ideas?
                <br />
                <span className="text-[10px] text-gray-400">
                  If yes, the category will be removed and the original ideas
                  will be archived. If no, the category and ideas stay exactly
                  as they are.
                </span>
              </p>
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() =>
                    setReformModal((prev) => ({ ...prev, step: "ideas" }))
                  }
                  className="text-[10px] text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      onExecute({ takeIdeas: true, deleteAndArchive: false })
                    }
                    disabled={reformLoading}
                    className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    {reformLoading ? "Working..." : "Keep category & ideas"}
                  </button>
                  <button
                    onClick={() =>
                      onExecute({ takeIdeas: true, deleteAndArchive: true })
                    }
                    disabled={reformLoading}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs font-medium disabled:opacity-40"
                  >
                    {reformLoading ? "Working..." : "Delete & archive"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
