// UI state management: editing, collapsed, filters, modals, archive, form
import { useState, useEffect } from "react";

/**
 * Hook for managing all non-data UI state on the Ideas page.
 * Includes editing states, collapse toggles, type filters, modals,
 * archive drawer visibility, and form height.
 */
export function useIdeaUIState() {
  // Category form visibility
  const [displayForm, setDisplayForm] = useState(false);

  // Individual idea collapse state
  const [collapsedIdeas, setCollapsedIdeas] = useState({});

  // Edit state — ideas
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");
  const [editingIdeaHeadline, setEditingIdeaHeadline] = useState("");

  // Edit state — categories
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Idea text input state
  const [ideaName, setIdeaName] = useState("");
  const [ideaHeadline, setIdeaHeadline] = useState("");

  // Form height state (resizable)
  const [formHeight, setFormHeight] = useState(120);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState(null);

  // Archive drawer
  const [showArchive, setShowArchive] = useState(false);

  // Filter state — global and per-category (null = unassigned, number = type id)
  const [globalTypeFilter, setGlobalTypeFilter] = useState([]); // empty = show all
  const [categoryTypeFilters, setCategoryTypeFilters] = useState({});
  const [showCategoryFilter, setShowCategoryFilter] = useState(null);

  // Close category filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCategoryFilter && !e.target.closest('[data-filter-dropdown]')) {
        setShowCategoryFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCategoryFilter]);

  // ===== HELPERS =====

  const confirm_delete_category = (category_id, category_name, deleteCallback) => {
    setConfirmModal({
      message: `Delete category "${category_name}"? Its ideas will become unassigned.`,
      onConfirm: () => {
        deleteCallback(category_id);
        setConfirmModal(null);
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const confirm_delete_idea = (idea, deleteCallback) => {
    setConfirmModal({
      message: (
        <div>
          <p className="mb-2">Delete this idea?</p>
          {idea.headline && <p className="font-semibold text-sm">{idea.headline}</p>}
          <p className="text-sm text-gray-600 mt-1">
            {idea.title.length > 100 ? idea.title.slice(0, 100) + "..." : idea.title}
          </p>
        </div>
      ),
      onConfirm: () => {
        deleteCallback(idea.id);
        setConfirmModal(null);
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const startEditIdea = (ideaId, idea) => {
    setEditingIdeaId(ideaId);
    setEditingIdeaTitle(idea.title);
    setEditingIdeaHeadline(idea.headline || "");
  };

  const cancelEditIdea = () => {
    setEditingIdeaId(null);
    setEditingIdeaTitle("");
    setEditingIdeaHeadline("");
  };

  const startEditCategory = (categoryId, categoryName) => {
    setEditingCategoryId(categoryId);
    setEditingCategoryName(categoryName);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
  };

  const toggleCollapseAllInCategory = (categoryOrders, category_key) => {
    const catIdeasList = categoryOrders[category_key] || [];
    const allCollapsed = catIdeasList.every((id) => collapsedIdeas[id]);
    const newState = {};
    catIdeasList.forEach((id) => {
      newState[id] = !allCollapsed;
    });
    setCollapsedIdeas((prev) => ({ ...prev, ...newState }));
  };

  // ===== FILTER HELPERS =====

  const passesGlobalFilter = (idea) => {
    if (globalTypeFilter.length === 0) return true;
    if (globalTypeFilter.includes("unassigned") && !idea.legend_type_id) return true;
    if (idea.legend_type_id && globalTypeFilter.includes(idea.legend_type_id)) return true;
    return false;
  };

  const passesCategoryFilter = (idea, category_key) => {
    const catFilter = categoryTypeFilters[category_key] || [];
    if (catFilter.length === 0) return true;
    if (catFilter.includes("unassigned") && !idea.legend_type_id) return true;
    if (idea.legend_type_id && catFilter.includes(idea.legend_type_id)) return true;
    return false;
  };

  return {
    // Category form
    displayForm,
    setDisplayForm,

    // Collapse
    collapsedIdeas,
    setCollapsedIdeas,

    // Editing — ideas
    editingIdeaId,
    editingIdeaTitle,
    setEditingIdeaTitle,
    editingIdeaHeadline,
    setEditingIdeaHeadline,
    startEditIdea,
    cancelEditIdea,

    // Editing — categories
    editingCategoryId,
    editingCategoryName,
    setEditingCategoryName,
    startEditCategory,
    cancelEditCategory,

    // Idea text input
    ideaName,
    setIdeaName,
    ideaHeadline,
    setIdeaHeadline,

    // Form height
    formHeight,
    setFormHeight,

    // Confirm modal
    confirmModal,
    setConfirmModal,
    confirm_delete_category,
    confirm_delete_idea,

    // Archive
    showArchive,
    setShowArchive,

    // Filters
    globalTypeFilter,
    setGlobalTypeFilter,
    categoryTypeFilters,
    setCategoryTypeFilters,
    showCategoryFilter,
    setShowCategoryFilter,
    passesGlobalFilter,
    passesCategoryFilter,
    toggleCollapseAllInCategory,
  };
}
