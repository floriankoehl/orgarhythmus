import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { Copy, Settings, Globe, Lock, UserRound, LinkIcon, PanelTopDashed, Pencil } from "lucide-react";

/**
 * RIGHT panel – category toolbar + draggable/resizable category cards.
 * Pure presentational; all mutation callbacks come from props.
 */
export default function IdeaBinCategoryCanvas({
  categoryContainerRef,
  displayCategoryForm, setDisplayCategoryForm,
  newCategoryName, setNewCategoryName,
  newCategoryPublic, setNewCategoryPublic,
  create_category_api,
  archivedCategories,
  dockedCategories, setDockedCategories,
  showArchive, setShowArchive,
  toggle_archive_category,
  toggle_public_category,
  drop_adopted_category,
  delete_category,
  setConfirmModal,
  activeCategories,
  categoryOrders,
  dragging,
  hoverCategory,
  selectedCategoryId, setSelectedCategoryId,
  bring_to_front_category,
  handleCategoryDrag,
  editingCategoryId, setEditingCategoryId,
  editingCategoryName, setEditingCategoryName,
  rename_category_api,
  copiedIdeaId,
  paste_idea,
  categorySettingsOpen, setCategorySettingsOpen,
  collapsedIdeas, setCollapsedIdeas,
  minimizedCategories, setMinimizedCategories,
  categories, setCategories,
  set_area_category,
  categoryRefs,
  globalTypeFilter,
  passesAllFilters,
  ideas,
  dims,
  renderIdeaItem,
  handleCategoryResize,
  refactorMode,
  mergeCategoryTarget,
  contextColor,
}) {
  return (
    <div
      ref={categoryContainerRef}
      className="flex-1 relative overflow-auto bg-gray-50"
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center gap-2 p-2">
          {displayCategoryForm ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                autoFocus
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") create_category_api();
                  else if (e.key === "Escape") { setDisplayCategoryForm(false); setNewCategoryName(""); setNewCategoryPublic(false); }
                }}
                placeholder="Category name..."
                className="text-xs px-2 py-1 border border-gray-300 rounded outline-none flex-1 focus:border-amber-400"
              />
              <button
                onClick={() => setNewCategoryPublic(p => !p)}
                title={newCategoryPublic ? "Public – visible to everyone" : "Private – only you"}
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded border transition-colors ${
                  newCategoryPublic
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200"
                    : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                }`}
              >
                {newCategoryPublic ? <Globe size={10} /> : <Lock size={10} />}
                {newCategoryPublic ? "Public" : "Private"}
              </button>
              <button onClick={create_category_api} className="text-[10px] px-2 py-1 bg-amber-400 rounded hover:bg-amber-500 font-medium">
                Create
              </button>
              <button onClick={() => { setDisplayCategoryForm(false); setNewCategoryName(""); setNewCategoryPublic(false); }} className="text-[10px] px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDisplayCategoryForm(true)}
              className="text-[10px] px-2 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded hover:bg-amber-200 font-medium flex-shrink-0"
            >
              + Category
            </button>
          )}
          {archivedCategories.length > 0 && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="text-[10px] px-2 py-1 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1"
              >
                <ArchiveIcon style={{ fontSize: 12 }} />
                {archivedCategories.length}
              </button>
              {/* Archive dropdown */}
              {showArchive && (
                <>
                  <div className="fixed inset-0 z-[39]" onClick={() => setShowArchive(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[180px] max-h-[200px] overflow-y-auto">
                    <h3 className="text-[10px] font-semibold mb-1 text-gray-500">Archived</h3>
                    {archivedCategories.map(cat => (
                      <div key={cat.id} className="flex justify-between items-center p-1 rounded hover:bg-gray-50 mb-0.5 text-[10px]">
                        <span className="font-medium truncate flex-1">{cat.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <UnarchiveIcon
                            onClick={() => toggle_archive_category(cat.id)}
                            className="hover:text-green-600! cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                          <DeleteForeverIcon
                            onClick={() => setConfirmModal({
                              message: `Delete "${cat.name}"?`,
                              onConfirm: () => { delete_category(cat.id); setConfirmModal(null); },
                              onCancel: () => setConfirmModal(null),
                            })}
                            className="hover:text-red-500! cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Docked categories chips (inline with buttons) ── */}
          {dockedCategories.length > 0 && (
            <div
              className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
              onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}
            >
              {dockedCategories.map(catId => {
                const cat = categories[catId];
                if (!cat || cat.archived) return null;
                const isAdopted = cat.adopted;
                return (
                  <button
                    key={catId}
                    onClick={() => setDockedCategories(prev => prev.filter(id => id !== catId))}
                    title={`Click to restore "${cat.name}" to canvas`}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 ${
                      isAdopted
                        ? "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                        : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                    }`}
                  >
                    {cat.name}
                    {isAdopted && (
                      <span className="text-[8px] text-indigo-400">
                        <UserRound size={7} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category cards */}
      {activeCategories.map(([catKey, catData]) => {
        const catIdeas = categoryOrders[catKey] || [];
        const isHovered = dragging && String(hoverCategory) === String(catKey);
        const isSelected = String(selectedCategoryId) === String(catKey);
        const isAdopted = catData.adopted;
        const isMergeTarget = refactorMode && mergeCategoryTarget === catKey;

        return (
          <div
            key={catKey}
            style={{
              left: catData.x, top: catData.y + 36,
              width: catData.width, height: catData.height,
              zIndex: catData.z_index || 0,
              backgroundColor: "#ffffff",
              backgroundImage: isMergeTarget
                ? "linear-gradient(135deg, #fed7aa, #fed7aa)"
                : contextColor && isSelected
                  ? `linear-gradient(135deg, ${contextColor}, ${contextColor}cc)`
                  : contextColor && isHovered
                    ? `linear-gradient(135deg, ${contextColor}cc, ${contextColor}aa)`
                    : isAdopted
                      ? (isHovered ? "linear-gradient(135deg, #c7d2fe, #c7d2fe)" : isSelected ? "linear-gradient(135deg, #e0e7ff, #e0e7ff)" : "linear-gradient(135deg, #eef2ff, #eef2ff)")
                      : (isHovered ? "linear-gradient(135deg, #fde68a, #fde68a)" : isSelected ? "linear-gradient(135deg, #fef9c3, #fef9c3)" : contextColor ? `linear-gradient(135deg, ${contextColor}, ${contextColor}cc)` : "linear-gradient(135deg, #fef08a, #fef08a)"),
              transition: "background-color 150ms ease",
            }}
            className={`absolute shadow-lg rounded p-1.5 flex flex-col ${isSelected ? "ring-2 ring-indigo-400 ring-offset-1" : ""} ${isAdopted ? "border border-indigo-300" : ""} ${isMergeTarget ? "ring-2 ring-orange-500 ring-offset-1" : ""}`}
            onMouseDown={() => {
              bring_to_front_category(catKey);
              setSelectedCategoryId(prev => String(prev) === String(catKey) ? null : catKey);
            }}
          >
            {/* Merge overlay when this category is a merge target */}
            {isMergeTarget && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-orange-500/20 rounded pointer-events-none">
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded shadow">
                  Merge here
                </span>
              </div>
            )}
            {/* Category header */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                bring_to_front_category(catKey);
                setSelectedCategoryId(prev => String(prev) === String(catKey) ? null : catKey);
                handleCategoryDrag(e, catKey);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Double-click → dock to header (most recent = leftmost)
                setDockedCategories(prev => [String(catKey), ...prev.filter(id => id !== String(catKey))]);
              }}
              className={`flex justify-between items-center mb-0.5 flex-shrink-0 rounded-t px-1 py-0.5 cursor-grab active:cursor-grabbing border-b ${
                isAdopted ? "bg-indigo-200/50 border-indigo-300/40" : "bg-amber-300/50 border-amber-400/40"
              }`}
            >
              {editingCategoryId === catKey && !isAdopted ? (
                <input
                  autoFocus
                  value={editingCategoryName}
                  onChange={e => setEditingCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { rename_category_api(catKey, editingCategoryName); setEditingCategoryId(null); }
                    else if (e.key === "Escape") setEditingCategoryId(null);
                  }}
                  onBlur={() => { rename_category_api(catKey, editingCategoryName); setEditingCategoryId(null); }}
                  onMouseDown={e => e.stopPropagation()}
                  className="bg-white text-[11px] font-semibold px-1 py-0.5 rounded outline-none border border-blue-400 flex-1 mr-1"
                />
              ) : (
                <span className="font-semibold text-[11px] truncate flex items-center gap-1">
                  {catData.name}
                  {isAdopted && (
                    <span className="text-[9px] font-normal text-indigo-500 flex items-center gap-0.5" title={`By ${catData.owner_username}`}>
                      <UserRound size={8} />{catData.owner_username}
                    </span>
                  )}
                  {catData.is_public && !isAdopted && (
                    <Globe size={9} className="text-emerald-600 flex-shrink-0" title="Public category" />
                  )}
                </span>
              )}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Paste into this category — available for owned AND adopted */}
                {copiedIdeaId && (
                  <Copy
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      paste_idea(parseInt(catKey));
                    }}
                    className="text-indigo-400 hover:text-indigo-600! cursor-pointer"
                    title="Paste copied idea here"
                  />
                )}
                {isAdopted ? (
                  /* Adopted category: settings with unadopt */
                  <div className="relative">
                    <Settings
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategorySettingsOpen(prev => prev === catKey ? null : catKey);
                      }}
                      className="text-indigo-500 hover:text-indigo-700 cursor-pointer"
                    />
                    {categorySettingsOpen === catKey && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setCategorySettingsOpen(null)} />
                        <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-xl border border-gray-200 z-[61] min-w-[140px] py-1">
                          {/* Collapse all ideas */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const allCollapsed = catIdeas.every(id => collapsedIdeas[id] ?? true);
                              const newState = {};
                              catIdeas.forEach(id => { newState[id] = allCollapsed ? false : true; });
                              setCollapsedIdeas(prev => ({ ...prev, ...newState }));
                              setCategorySettingsOpen(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <span style={{
                              display: "inline-block", width: 0, height: 0, borderStyle: "solid",
                              ...(catIdeas.every(id => collapsedIdeas[id] ?? true)
                                ? { borderWidth: "4px 3px 0 3px", borderColor: "currentColor transparent transparent transparent" }
                                : { borderWidth: "0 3px 4px 3px", borderColor: "transparent transparent currentColor transparent" })
                            }} />
                            {catIdeas.every(id => collapsedIdeas[id] ?? true) ? "Show full ideas" : "Show headlines only"}
                          </button>
                          {/* Unadopt */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategorySettingsOpen(null);
                              setConfirmModal({
                                message: `Stop following "${catData.name}" from ${catData.owner_username}?`,
                                onConfirm: () => { drop_adopted_category(catKey); setConfirmModal(null); },
                                onCancel: () => setConfirmModal(null),
                              });
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <LinkIcon size={11} />
                            Unadopt category
                          </button>
                          {/* Dock to header */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategorySettingsOpen(null);
                              setDockedCategories(prev => [String(catKey), ...prev.filter(id => id !== String(catKey))]);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <PanelTopDashed size={11} />
                            Dock to header
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                {/* Archive */}
                <ArchiveIcon
                  onClick={(e) => { e.stopPropagation(); toggle_archive_category(catKey); }}
                  className="hover:text-amber-700! cursor-pointer" style={{ fontSize: 13 }}
                />
                {/* Settings dropdown */}
                <div className="relative">
                  <Settings
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategorySettingsOpen(prev => prev === catKey ? null : catKey);
                    }}
                    className="text-amber-700 hover:text-amber-900 cursor-pointer"
                  />
                  {categorySettingsOpen === catKey && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setCategorySettingsOpen(null)} />
                      <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-xl border border-gray-200 z-[61] min-w-[140px] py-1">
                        {/* Collapse all ideas */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const allCollapsed = catIdeas.every(id => collapsedIdeas[id] ?? true);
                            const newState = {};
                            catIdeas.forEach(id => { newState[id] = allCollapsed ? false : true; });
                            setCollapsedIdeas(prev => ({ ...prev, ...newState }));
                            setCategorySettingsOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span style={{
                            display: "inline-block", width: 0, height: 0, borderStyle: "solid",
                            ...(catIdeas.every(id => collapsedIdeas[id] ?? true)
                              ? { borderWidth: "4px 3px 0 3px", borderColor: "currentColor transparent transparent transparent" }
                              : { borderWidth: "0 3px 4px 3px", borderColor: "transparent transparent currentColor transparent" })
                          }} />
                          {catIdeas.every(id => collapsedIdeas[id] ?? true) ? "Show full ideas" : "Show headlines only"}
                        </button>
                        {/* Minimize / Restore */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (minimizedCategories[catKey]) {
                              const orig = minimizedCategories[catKey];
                              setCategories(prev => ({ ...prev, [catKey]: { ...prev[catKey], width: orig.width, height: orig.height } }));
                              set_area_category(catKey, orig.width, orig.height);
                              setMinimizedCategories(prev => { const u = { ...prev }; delete u[catKey]; return u; });
                            } else {
                              const minW = Math.max(80, catData.name.length * 9 + 60);
                              setMinimizedCategories(prev => ({ ...prev, [catKey]: { width: catData.width, height: catData.height } }));
                              setCategories(prev => ({ ...prev, [catKey]: { ...prev[catKey], width: minW, height: 30 } }));
                              set_area_category(catKey, minW, 30);
                            }
                            setCategorySettingsOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="text-[10px]">{minimizedCategories[catKey] ? "◻" : "—"}</span>
                          {minimizedCategories[catKey] ? "Restore size" : "Collapse card"}
                        </button>
                        {/* Toggle public/private */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle_public_category(catKey);
                            setCategorySettingsOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          {catData.is_public ? <Lock size={11} /> : <Globe size={11} />}
                          {catData.is_public ? "Make private" : "Make public"}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            setConfirmModal({
                              message: `Delete "${catData.name}"? Its ideas become unassigned.`,
                              onConfirm: () => { delete_category(catKey); setConfirmModal(null); },
                              onCancel: () => setConfirmModal(null),
                            });
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <DeleteForeverIcon style={{ fontSize: 13 }} />
                          Delete category
                        </button>
                        {/* Rename */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            setEditingCategoryId(catKey);
                            setEditingCategoryName(catData.name);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Pencil size={11} />
                          Rename
                        </button>
                        {/* Dock to header */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            setDockedCategories(prev => [String(catKey), ...prev.filter(id => id !== String(catKey))]);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <PanelTopDashed size={11} />
                          Dock to header
                        </button>
                      </div>
                    </>
                  )}
                </div>
                  </>
                )}
              </div>
            </div>

            {/* Ideas inside category */}
            <div
              ref={el => (categoryRefs.current[catKey] = el)}
              className="flex-1 overflow-y-auto overflow-x-hidden"
              onMouseDown={(e) => {
                e.stopPropagation();
                bring_to_front_category(catKey);
              }}
            >
              {catIdeas
                .filter(ideaId => passesAllFilters(ideas[ideaId]))
                .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "category", id: catKey }))
              }
            </div>

            {/* Resize handles – all edges and corners */}
            {/* Edges */}
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "n")} className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "s")} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "w")} className="absolute top-2 bottom-2 left-0 w-1.5 cursor-w-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "e")} className="absolute top-2 bottom-2 right-0 w-1.5 cursor-e-resize" />
            {/* Corners */}
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "nw")} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "ne")} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "sw")} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "se")} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize">
              <span className={`absolute bottom-0 right-0 text-[8px] leading-none select-none ${isAdopted ? "text-indigo-400/60" : "text-amber-600/60"}`}>◢</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
