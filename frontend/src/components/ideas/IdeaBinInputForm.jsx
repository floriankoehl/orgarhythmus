import React, { useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import { Type, X, ArrowDownUp, BookOpenText, RotateCcw } from "lucide-react";

// ─── Sidebar input form: title/description fields with title-mode
//     word-chip builder, drag-reorder, and create/edit buttons ───
export default function IdeaBinInputForm({
  editFormRef, headlineInputRef, formHeight,
  // editing state
  editingIdeaId, setEditingIdeaId,
  editingIdeaTitle, setEditingIdeaTitle,
  editingIdeaDescription, setEditingIdeaDescription,
  // create state
  ideaName, setIdeaName,
  newIdeaDescription, setNewIdeaDescription,
  // title mode
  editFormTitleMode, setEditFormTitleMode,
  createFormTitleMode, setCreateFormTitleMode,
  editFormOrderMode, setEditFormOrderMode,
  createFormOrderMode, setCreateFormOrderMode,
  // category context
  selectedCategoryIds, setSelectedCategoryIds, categories,
  // actions
  update_idea_title_api, create_idea,
}) {
  // Refs for drag-reorder within the title word chips
  const cfDragItemRef = useRef(null);
  const cfDragOverRef = useRef(null);
  const [cfDropIdx, setCfDropIdx] = useState(null);

  return (
    <div
      ref={editFormRef}
      className="p-2 bg-gray-50 flex-shrink-0 flex flex-col"
      style={{ height: formHeight, overflow: "hidden" }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <h2 className="text-xs font-semibold text-gray-500">
          {editingIdeaId ? "Edit Idea" : "New Idea"}
        </h2>
        <button
          onClick={() => {
            if (editingIdeaId) setEditFormTitleMode(prev => !prev);
            else setCreateFormTitleMode(prev => !prev);
          }}
          className={`flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded border transition-colors ${
            (editingIdeaId ? editFormTitleMode : createFormTitleMode)
              ? "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200"
              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          }`}
          title="Toggle Title Mode (Ctrl+Alt)"
        >
          <Type size={9} />
          Title Mode
        </button>
      </div>
      {!editingIdeaId && selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] && (
        <div className="flex items-center gap-1 mb-1.5 px-1.5 py-1 bg-indigo-50 border border-indigo-200 rounded text-[10px] text-indigo-700">
          <span className="font-medium">Auto-add to:</span>
          <span className="font-semibold truncate">{categories[[...selectedCategoryIds][0]].name}</span>
          <button
            onClick={() => setSelectedCategoryIds(new Set())}
            className="ml-auto flex-shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors"
            title="Remove category selection"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Title section ── */}
      {(editingIdeaId ? editFormTitleMode : createFormTitleMode) ? (() => {
        const cfTitleWords = (editingIdeaId ? editingIdeaTitle : ideaName) ? (editingIdeaId ? editingIdeaTitle : ideaName).split(/\s+/).filter(w => w.length > 0) : [];
        const cfDescWords = ((editingIdeaId ? editingIdeaDescription : newIdeaDescription) || "").split(/\s+/).filter(w => w.length > 0);
        const cfSortByDescription = (wordsArr) => {
          const lowerDesc = cfDescWords.map(w => w.toLowerCase());
          return [...wordsArr].sort((a, b) => {
            const idxA = lowerDesc.indexOf(a.toLowerCase());
            const idxB = lowerDesc.indexOf(b.toLowerCase());
            return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
          });
        };
        // Drag handlers for reordering title words
        const cfHandleDragStart = (e, wordIdx) => {
          cfDragItemRef.current = { index: wordIdx };
          e.dataTransfer.effectAllowed = "move";
          e.target.style.opacity = "0.4";
        };
        const cfHandleDragEnd = (e) => {
          e.target.style.opacity = "1";
          cfDragItemRef.current = null;
          cfDragOverRef.current = null;
          setCfDropIdx(null);
        };
        const cfHandleDragOver = (e, wordIdx) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          const gapIdx = e.clientX < midX ? wordIdx : wordIdx + 1;
          cfDragOverRef.current = { index: gapIdx };
          setCfDropIdx(gapIdx);
        };
        const cfHandleDrop = (e) => {
          e.preventDefault();
          if (!cfDragItemRef.current || cfDragOverRef.current == null) return;
          const fromIdx = cfDragItemRef.current.index;
          const toIdx = cfDragOverRef.current.index;
          if (fromIdx === toIdx || fromIdx + 1 === toIdx) { setCfDropIdx(null); return; }
          const reordered = [...cfTitleWords];
          const [moved] = reordered.splice(fromIdx, 1);
          const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
          reordered.splice(insertAt, 0, moved);
          if (editingIdeaId) setEditingIdeaTitle(reordered.join(" "));
          else setIdeaName(reordered.join(" "));
          cfDragItemRef.current = null;
          cfDragOverRef.current = null;
          setCfDropIdx(null);
        };
        return (
          <div className="bg-white rounded border border-purple-200 shadow-sm p-1.5 mb-1" onClick={(e) => e.stopPropagation()}>
            {/* Order toggle + clear */}
            <div className="flex items-center gap-1 mb-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentOrderMode = editingIdeaId ? editFormOrderMode : createFormOrderMode;
                  const newMode = currentOrderMode === "define" ? "description" : "define";
                  if (editingIdeaId) setEditFormOrderMode(newMode);
                  else setCreateFormOrderMode(newMode);
                  if (newMode === "description" && cfTitleWords.length > 1) {
                    const sorted = cfSortByDescription(cfTitleWords).join(" ");
                    if (editingIdeaId) setEditingIdeaTitle(sorted);
                    else setIdeaName(sorted);
                  }
                }}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  (editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define"
                    ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                    : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                }`}
                title={(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "Switch to auto-order by description position" : "Switch to manual drag-to-reorder"}
              >
                {(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? <ArrowDownUp size={10} /> : <BookOpenText size={10} />}
                {(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "Define Order" : "Order from Description"}
              </button>
              <RotateCcw
                size={12}
                onClick={(e) => { e.stopPropagation(); if (editingIdeaId) setEditingIdeaTitle(""); else setIdeaName(""); }}
                className="text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 ml-auto"
                title="Clear title"
              />
            </div>
            {/* Current title as chips */}
            <div className="flex items-center gap-1 mb-1">
              <div
                className="flex-1 min-h-[22px] px-1.5 py-0.5 rounded border text-[11px] font-semibold bg-purple-50 border-purple-300 text-purple-900 flex items-center flex-wrap gap-0.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={cfHandleDrop}
              >
                {cfTitleWords.length > 0 ? cfTitleWords.map((w, i) => (
                  <React.Fragment key={i}>
                    {cfDropIdx === i && cfDragItemRef.current && cfDragItemRef.current.index !== i && cfDragItemRef.current.index !== i - 1 && (
                      <div className="w-0.5 self-stretch bg-purple-500 rounded-full min-h-[16px] flex-shrink-0 animate-pulse" />
                    )}
                    <span
                      draggable={(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define"}
                      onDragStart={(e) => cfHandleDragStart(e, i)}
                      onDragEnd={cfHandleDragEnd}
                      onDragOver={(e) => cfHandleDragOver(e, i)}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newWords = [...cfTitleWords];
                        newWords.splice(i, 1);
                        if (editingIdeaId) setEditingIdeaTitle(newWords.join(" "));
                        else setIdeaName(newWords.join(" "));
                      }}
                      className={`inline-flex items-center bg-purple-200 text-purple-800 rounded px-1 py-0.5 cursor-pointer hover:bg-red-200 hover:text-red-700 transition-colors text-[10px] ${
                        (editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "cursor-grab active:cursor-grabbing" : ""
                      }`}
                      title={(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "Drag to reorder · Click to remove" : "Click to remove"}
                    >
                      {w}
                      <X size={8} className="ml-0.5 opacity-60" />
                    </span>
                  </React.Fragment>
                )) : (
                  <span className="text-purple-400 italic text-[10px]">Click words below to build title…</span>
                )}
                {cfDropIdx === cfTitleWords.length && cfDragItemRef.current && (
                  <div className="w-0.5 self-stretch bg-purple-500 rounded-full min-h-[16px] flex-shrink-0 animate-pulse" />
                )}
              </div>
            </div>
          </div>
        );
      })() : (
        <TextField
          inputRef={headlineInputRef}
          value={editingIdeaId ? editingIdeaTitle : ideaName}
          onChange={(e) => {
            if (editingIdeaId) setEditingIdeaTitle(e.target.value);
            else setIdeaName(e.target.value);
          }}
          onKeyDown={(e) => {
            if ((e.key === "Alt" && e.ctrlKey) || (e.key === "Control" && e.altKey)) {
              e.preventDefault();
              if (editingIdeaId) setEditFormTitleMode(prev => !prev);
              else setCreateFormTitleMode(prev => !prev);
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (editingIdeaId) {
                update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
              } else if (ideaName.trim() || newIdeaDescription.trim()) { create_idea(); setCreateFormTitleMode(false); }
            } else if (e.key === "Escape" && editingIdeaId) {
              setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          label={editingIdeaId ? "Edit your idea..." : "What's your idea?"}
          variant="outlined"
          size="small"
          fullWidth
          sx={{ backgroundColor: "white", borderRadius: 1, marginBottom: 0.5, "& .MuiInputLabel-root": { fontSize: 11 }, "& .MuiInputLabel-shrink": { fontSize: 12 }, "& .MuiInputBase-input": { fontSize: 12, padding: "6px 10px", caretColor: "#1f2937", color: "#1f2937" } }}
        />
      )}

      {/* Description area – textarea when off, word chips when title mode is on */}
      {(editingIdeaId ? editFormTitleMode : createFormTitleMode) ? (() => {
        const cfDescWordsForChips = ((editingIdeaId ? editingIdeaDescription : newIdeaDescription) || "").split(/\s+/).filter(w => w.length > 0);
        const cfTitleWordsForChips = (editingIdeaId ? editingIdeaTitle : ideaName) ? (editingIdeaId ? editingIdeaTitle : ideaName).split(/\s+/).filter(w => w.length > 0) : [];
        const cfSortByDescForChips = (wordsArr) => {
          const lowerDesc = cfDescWordsForChips.map(w => w.toLowerCase());
          return [...wordsArr].sort((a, b) => {
            const idxA = lowerDesc.indexOf(a.toLowerCase());
            const idxB = lowerDesc.indexOf(b.toLowerCase());
            return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
          });
        };
        return (
          <div
            className="mt-1 rounded border border-gray-300 bg-white px-2.5 py-2 min-h-[56px] cursor-default transition-colors flex-1 overflow-y-auto"
            style={{ fontSize: 11, lineHeight: "20px" }}
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Alt" && e.ctrlKey) || (e.key === "Control" && e.altKey)) {
                e.preventDefault();
                if (editingIdeaId) setEditFormTitleMode(false);
                else setCreateFormTitleMode(false);
              } else if (e.key === "Enter" && !e.shiftKey) {
                if (editingIdeaId) {
                  e.preventDefault();
                  update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                  setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                } else if (ideaName.trim() || newIdeaDescription.trim()) {
                  e.preventDefault(); create_idea(); setCreateFormTitleMode(false);
                }
              }
            }}
          >
            {cfDescWordsForChips.length > 0 ? ((editingIdeaId ? editingIdeaDescription : newIdeaDescription) || "").split("\n").map((line, li) => {
              if (line.trim() === "") return <div key={`line-${li}`} className="h-3" />;
              const lineWords = line.split(/\s+/).filter(w => w.length > 0);
              return (
                <div key={`line-${li}`} className="flex flex-wrap gap-[4px]" style={{ lineHeight: "20px" }}>
                  {lineWords.map((word, wi) => {
                    const isUsed = cfTitleWordsForChips.some(dw => dw.toLowerCase() === word.toLowerCase());
                    return (
                      <span
                        key={wi}
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentOrderMode = editingIdeaId ? editFormOrderMode : createFormOrderMode;
                          const currentTitle = editingIdeaId ? editingIdeaTitle : ideaName;
                          let newTitle;
                          if (currentOrderMode === "description") {
                            const currentWords = currentTitle ? currentTitle.split(/\s+/).filter(w => w.length > 0) : [];
                            currentWords.push(word);
                            newTitle = cfSortByDescForChips(currentWords).join(" ");
                          } else {
                            newTitle = currentTitle ? `${currentTitle} ${word}` : word;
                          }
                          if (editingIdeaId) setEditingIdeaTitle(newTitle);
                          else setIdeaName(newTitle);
                        }}
                        className={`inline-block rounded px-[3px] py-[1px] cursor-pointer transition-all select-none ${
                          isUsed
                            ? "bg-purple-100 text-purple-400 border border-purple-200"
                            : "text-gray-600 hover:bg-purple-100 hover:text-purple-700 border border-transparent hover:border-purple-300"
                        }`}
                        style={{ fontSize: 11, lineHeight: "18px" }}
                        title={`Add "${word}" to title`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              );
            }) : (
              <span className="text-gray-400 italic" style={{ fontSize: 11 }}>Write a description first, then press Ctrl+Alt to pick words…</span>
            )}
          </div>
        );
      })() : (
        <TextField
          value={editingIdeaId ? editingIdeaDescription : newIdeaDescription}
          onChange={(e) => {
            if (editingIdeaId) setEditingIdeaDescription(e.target.value);
            else setNewIdeaDescription(e.target.value);
          }}
          onKeyDown={(e) => {
            if ((e.key === "Alt" && e.ctrlKey) || (e.key === "Control" && e.altKey)) {
              e.preventDefault();
              if (editingIdeaId) setEditFormTitleMode(prev => !prev);
              else setCreateFormTitleMode(prev => !prev);
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (editingIdeaId) {
                update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
              } else if (ideaName.trim() || newIdeaDescription.trim()) {
                create_idea(); setCreateFormTitleMode(false);
              }
            } else if (e.key === "Escape" && editingIdeaId) {
              setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
            }
            // Shift+Enter falls through naturally → inserts line break
          }}
          onMouseDown={(e) => e.stopPropagation()}
          label="Description (optional)"
          variant="outlined"
          multiline
          minRows={2}
          fullWidth
          sx={{
            backgroundColor: "white", borderRadius: 1, marginTop: 0.5, flex: 1, display: "flex",
            "& .MuiInputBase-root": { flex: 1, overflow: "auto", alignItems: "flex-start" },
            "& .MuiInputBase-input": { fontSize: 11, caretColor: "#1f2937", color: "#6b7280" },
            "& .MuiInputLabel-root": { fontSize: 11 },
            "& .MuiInputLabel-shrink": { fontSize: 12 },
          }}
        />
      )}

      <div className="flex gap-1.5 mt-1.5">
        {editingIdeaId ? (
          <>
            <button
              onClick={() => {
                update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
              }}
              className="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-[11px]"
            >
              Update
            </button>
            <button
              onClick={() => { setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false); }}
              className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-[11px]"
            >
              Cancel
            </button>
          </>
        ) : (
          (ideaName.trim() || newIdeaDescription.trim()) && (
            <button
              onClick={() => { create_idea(); setCreateFormTitleMode(false); }}
              className="px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 text-[11px]"
            >
              Create{selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` → ${categories[[...selectedCategoryIds][0]].name}` : ""}
            </button>
          )
        )}
      </div>
    </div>
  );
}
