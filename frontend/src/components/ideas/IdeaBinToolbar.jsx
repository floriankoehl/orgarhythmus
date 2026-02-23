import { Layers } from "lucide-react";

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
}) {
  const ctxColor = activeContext?.color;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 flex-shrink-0 border-b border-gray-200 bg-gray-50/80"
    >
      {/* ── Refactor mode toggle ── */}
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

      {/* ── Headline mode toggle ── */}
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
          ? `Headline mode for "${(ideas[headlineModeIdeaId]?.headline || ideas[headlineModeIdeaId]?.title || '...').slice(0, 30)}" (H to toggle)`
          : headlineModeCategoryId
          ? `Headline mode for "${categories[headlineModeCategoryId]?.name || '...'}" (H to toggle)`
          : "Headline mode OFF (H to toggle)"
        }
      >
        HEADLINE{headlineModeIdeaId
          ? ` · ${(ideas[headlineModeIdeaId]?.headline || ideas[headlineModeIdeaId]?.title || '').slice(0, 20)}${(ideas[headlineModeIdeaId]?.headline || ideas[headlineModeIdeaId]?.title || '').length > 20 ? '…' : ''}`
          : headlineModeCategoryId && categories[headlineModeCategoryId] ? ` · ${categories[headlineModeCategoryId].name}` : ''}
      </button>

      {/* spacer */}
      <div className="flex-1" />

      {/* ── View mode switcher ── */}
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
    </div>
  );
}
