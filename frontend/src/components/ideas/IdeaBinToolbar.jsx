import { useState, useRef } from "react";
import { Layers, ListOrdered, Globe, Lock, Merge, Download, Upload, Sparkles, Loader } from "lucide-react";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { fetchArchivedIdeasApi, deleteAllArchivedIdeasApi } from "./api/ideaApi";

// ─── Toolbar strip between title bar and content area ───
// Houses mode toggles and view switcher — sits in a thin bar.
export default function IdeaBinToolbar({
  // modes
  refactorMode, setRefactorMode,
  headlineModeCategoryId, setHeadlineModeCategoryId,
  headlineModeIdeaId, setHeadlineModeIdeaId,
  // view
  viewMode, setViewMode,
  // data (for label text)
  ideas, categories,
  // context color theming
  activeContext,
  // category creation
  displayCategoryForm, setDisplayCategoryForm,
  newCategoryName, setNewCategoryName,
  newCategoryPublic, setNewCategoryPublic,
  create_category_api,
  // draw-to-create
  drawCategoryMode, setDrawCategoryMode,
  // order numbers
  showOrderNumbers, setShowOrderNumbers,
  activeCategories,
  // archive
  toggle_archive_idea,
  delete_meta_idea,
  fetch_all_ideas,
  // merge
  selectedIdeaCount,
  onMergeClick,
  // export
  onExportBackup,
  // import
  onImportBackup,
  // multi-category export
  selectedCategoryCount,
  onExportSelectedCategories,
  // AI generate
  onAiGenerate,
  aiGenerating,
}) {
  const ctxColor = activeContext?.color;
  const importInputRef = useRef(null);

  // Derived: are ALL active categories showing order numbers?
  const allOrderVisible = activeCategories.length > 0 && activeCategories.every(([k]) => showOrderNumbers.has(k));
  const anyOrderVisible = showOrderNumbers.size > 0;

  // ── Archived ideas dropdown ──
  const [showArchive, setShowArchive] = useState(false);
  const [archivedIdeas, setArchivedIdeas] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // idea id pending permanent delete
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const openArchive = async () => {
    setShowArchive(true);
    setArchiveLoading(true);
    try {
      const list = await fetchArchivedIdeasApi();
      setArchivedIdeas(list);
    } catch (e) { console.error("Failed to fetch archived ideas", e); }
    setArchiveLoading(false);
  };

  const restoreIdea = async (ideaId) => {
    await toggle_archive_idea([ideaId]);
    // Refresh the archived list
    try { setArchivedIdeas(await fetchArchivedIdeasApi()); } catch {}
  };

  const permanentlyDeleteIdea = async (ideaId) => {
    await delete_meta_idea(ideaId);
    setConfirmDeleteId(null);
    try { setArchivedIdeas(await fetchArchivedIdeasApi()); } catch {}
  };

  const deleteAllArchived = async () => {
    await deleteAllArchivedIdeasApi();
    setArchivedIdeas([]);
    setConfirmDeleteAll(false);
    fetch_all_ideas();
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 flex-shrink-0 border-b border-gray-200 bg-gray-50/80"
    >
      {/* ── LEFT: View mode switcher ── */}
      <div
        className="flex items-center rounded-full p-0.5"
        style={{ backgroundColor: ctxColor ? `color-mix(in srgb, ${ctxColor} 15%, transparent)` : "rgba(217,119,6,0.15)" }}
      >
        <button
          onClick={() => setViewMode("ideas")}
          className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
            viewMode === "ideas" ? "bg-white shadow-sm" : ""
          }`}
          style={{ color: ctxColor ? `color-mix(in srgb, ${ctxColor} 70%, #333)` : "#92400e" }}
          title="Ideas & Categories"
        >
          Ideas
        </button>
        <button
          onClick={() => setViewMode("contexts")}
          className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors flex items-center gap-0.5 ${
            viewMode === "contexts" ? "bg-white shadow-sm" : ""
          }`}
          style={{ color: ctxColor ? `color-mix(in srgb, ${ctxColor} 70%, #333)` : "#92400e" }}
          title="Categories & Contexts"
        >
          <Layers size={10} />
          Contexts
        </button>
      </div>

      {/* ── + Category button / form ── */}
      {viewMode === "ideas" && (
        displayCategoryForm ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { create_category_api(); setDrawCategoryMode(false); }
                else if (e.key === "Escape") { setDisplayCategoryForm(false); setNewCategoryName(""); setNewCategoryPublic(false); setDrawCategoryMode(false); }
              }}
              placeholder="Category name…"
              className="text-xs px-2 py-0.5 border border-gray-300 rounded outline-none w-28"
              style={{ borderColor: ctxColor ? `color-mix(in srgb, ${ctxColor} 30%, #ccc)` : undefined }}
            />
            <button
              onClick={() => setNewCategoryPublic(p => !p)}
              title={newCategoryPublic ? "Public – visible to everyone" : "Private – only you"}
              className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded border transition-colors ${
                newCategoryPublic
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-gray-100 text-gray-600 border-gray-300"
              }`}
            >
              {newCategoryPublic ? <Globe size={9} /> : <Lock size={9} />}
            </button>
            <button
              onClick={() => { create_category_api(); setDrawCategoryMode(false); }}
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: ctxColor ? `color-mix(in srgb, ${ctxColor} 35%, #fff)` : "#fbbf24",
                color: ctxColor ? `color-mix(in srgb, ${ctxColor} 70%, #333)` : undefined,
              }}
            >
              ✓
            </button>
            <button onClick={() => { setDisplayCategoryForm(false); setNewCategoryName(""); setNewCategoryPublic(false); setDrawCategoryMode(false); }} className="text-[9px] px-1 py-0.5 bg-gray-200 rounded hover:bg-gray-300">
              ✕
            </button>
            <span className="text-[9px] text-amber-600 font-medium ml-0.5">
              or draw on canvas ↗
            </span>
          </div>
        ) : (
          <button
            onClick={() => { setDisplayCategoryForm(true); setDrawCategoryMode(true); }}
            className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 border"
            style={{
              backgroundColor: ctxColor ? `color-mix(in srgb, ${ctxColor} 15%, #fff)` : "#fef3c7",
              color: ctxColor ? `color-mix(in srgb, ${ctxColor} 70%, #333)` : "#92400e",
              borderColor: ctxColor ? `color-mix(in srgb, ${ctxColor} 25%, #ddd)` : "#fcd34d",
            }}
          >
            + Cat
          </button>
        )
      )}

      {/* ── Order numbers global toggle ── */}
      {viewMode === "ideas" && (
        <button
          onClick={() => {
            if (allOrderVisible) {
              setShowOrderNumbers(new Set());
            } else {
              setShowOrderNumbers(new Set(activeCategories.map(([k]) => k)));
            }
          }}
          className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded border flex-shrink-0 transition-colors ${
            allOrderVisible
              ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
              : anyOrderVisible
                ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
          }`}
          title={allOrderVisible ? "Hide all order numbers" : "Show all order numbers"}
        >
          <ListOrdered size={10} />
          <span className="hidden sm:inline">#</span>
        </button>
      )}

      {/* ── Archived ideas dropdown ── */}
      {viewMode === "ideas" && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => showArchive ? setShowArchive(false) : openArchive()}
            className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-0.5"
            title="View archived ideas"
          >
            <ArchiveIcon style={{ fontSize: 12 }} />
          </button>
          {showArchive && (
            <>
              <div className="fixed inset-0 z-[39]" onClick={() => { setShowArchive(false); setConfirmDeleteId(null); }} />
              <div className="absolute left-0 top-full mt-1 z-40 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[240px] max-w-[320px] max-h-[260px] overflow-y-auto">
                <h3 className="text-[10px] font-semibold mb-1 text-gray-500 flex items-center gap-1">
                  <ArchiveIcon style={{ fontSize: 11 }} /> Archived Ideas
                </h3>
                {archiveLoading ? (
                  <p className="text-[10px] text-gray-400 py-2 text-center">Loading…</p>
                ) : archivedIdeas.length === 0 ? (
                  <p className="text-[10px] text-gray-400 py-2 text-center">No archived ideas</p>
                ) : (
                  <>
                  {/* Delete All bar */}
                  <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-gray-100">
                    {confirmDeleteAll ? (
                      <div className="flex items-center gap-1 w-full">
                        <span className="text-[9px] text-red-600 flex-1">Delete all {archivedIdeas.length} archived ideas?</span>
                        <button
                          onClick={deleteAllArchived}
                          className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Yes, delete all
                        </button>
                        <button
                          onClick={() => setConfirmDeleteAll(false)}
                          className="text-[9px] px-1.5 py-0.5 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteAll(true)}
                        className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 flex items-center gap-0.5 ml-auto"
                      >
                        <DeleteForeverIcon style={{ fontSize: 11 }} />
                        Delete All ({archivedIdeas.length})
                      </button>
                    )}
                  </div>
                  {archivedIdeas.map(idea => (
                    <div key={idea.id} className="flex justify-between items-center p-1 rounded hover:bg-gray-50 mb-0.5 text-[10px] gap-1">
                      <span className="font-medium truncate flex-1" title={idea.title}>
                        {idea.title}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {confirmDeleteId === idea.id ? (
                          <>
                            <span className="text-[9px] text-red-600 mr-0.5">Delete?</span>
                            <button
                              onClick={() => permanentlyDeleteIdea(idea.id)}
                              className="text-[9px] px-1 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[9px] px-1 py-0.5 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <UnarchiveIcon
                              onClick={() => restoreIdea(idea.id)}
                              className="hover:text-green-600! cursor-pointer"
                              style={{ fontSize: 14 }}
                              titleAccess="Restore"
                            />
                            <DeleteForeverIcon
                              onClick={() => setConfirmDeleteId(idea.id)}
                              className="hover:text-red-500! cursor-pointer"
                              style={{ fontSize: 14 }}
                              titleAccess="Permanently delete"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Merge button (visible when 2+ ideas selected) ── */}
      {viewMode === "ideas" && selectedIdeaCount >= 2 && (
        <button
          onClick={onMergeClick}
          className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 border flex items-center gap-0.5 bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100 transition-colors"
          title={`Merge ${selectedIdeaCount} selected ideas`}
        >
          <Merge size={10} />
          Merge ({selectedIdeaCount})
        </button>
      )}

      {/* spacer */}
      <div className="flex-1" />

      {/* ── AI Generate button ── */}
      {viewMode === "ideas" && (
        <button
          onClick={onAiGenerate}
          disabled={aiGenerating}
          className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 border flex items-center gap-0.5 transition-colors bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-wait"
          title="Generate new ideas with AI (uses existing context)"
        >
          {aiGenerating
            ? <Loader size={10} className="animate-spin" />
            : <Sparkles size={10} />
          }
          {aiGenerating ? "Generating…" : "Generate"}
        </button>
      )}

      {/* ── Export selected categories ── */}
      {selectedCategoryCount >= 2 && (
        <button
          onClick={onExportSelectedCategories}
          className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 border flex items-center gap-0.5 bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100 hover:text-blue-800 transition-colors"
          title={`Export ${selectedCategoryCount} selected categories as JSON`}
        >
          <Download size={10} />
          Export Selected ({selectedCategoryCount})
        </button>
      )}

      {/* ── Export backup ── */}
      <button
        onClick={onExportBackup}
        className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 border flex items-center gap-0.5 bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        title={activeContext ? `Export backup for "${activeContext.name}" context` : "Export full IdeaBin backup"}
      >
        <Download size={10} />
        Export
      </button>

      {/* ── Import backup ── */}
      <button
        onClick={() => importInputRef.current?.click()}
        className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 border flex items-center gap-0.5 bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        title={activeContext ? `Import backup into "${activeContext.name}" context` : "Import full IdeaBin backup (replaces all data)"}
      >
        <Upload size={10} />
        Import
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImportBackup(file);
            e.target.value = ""; // reset so same file can be selected again
          }
        }}
      />

      {/* ── RIGHT: Refactor mode toggle ── */}
      <button
        className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-wide cursor-pointer transition-all ${
          refactorMode
            ? "bg-orange-600 text-white animate-pulse"
            : "bg-gray-200 text-gray-400 hover:bg-gray-300 hover:text-gray-500"
        }`}
        onClick={() => setRefactorMode(prev => !prev)}
        title={refactorMode ? "Refactor mode ON (R to toggle)" : "Refactor mode OFF (R to toggle)"}
      >
        REFACTOR
      </button>

      {/* ── Title mode toggle ── */}
      <button
        className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-wide cursor-pointer transition-all ${
          (headlineModeCategoryId || headlineModeIdeaId)
            ? "bg-purple-600 text-white animate-pulse"
            : "bg-gray-200 text-gray-400 hover:bg-gray-300 hover:text-gray-500"
        }`}
        onClick={() => {
          if (headlineModeCategoryId || headlineModeIdeaId) {
            setHeadlineModeCategoryId(null);
            setHeadlineModeIdeaId(null);
          }
        }}
        title={headlineModeIdeaId
          ? `Title mode for "${(ideas[headlineModeIdeaId]?.title || '...').slice(0, 30)}" (H to toggle)`
          : headlineModeCategoryId
          ? `Title mode for "${categories[headlineModeCategoryId]?.name || '...'}" (H to toggle)`
          : "Title mode OFF (H to toggle)"
        }
      >
        TITLE{headlineModeIdeaId
          ? ` · ${(ideas[headlineModeIdeaId]?.title || '').slice(0, 20)}${(ideas[headlineModeIdeaId]?.title || '').length > 20 ? '…' : ''}`
          : headlineModeCategoryId && categories[headlineModeCategoryId] ? ` · ${categories[headlineModeCategoryId].name}` : ''}
      </button>
    </div>
  );
}
