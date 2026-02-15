import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon from "@mui/icons-material/Edit";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";

import { BASE_URL } from '../config/api';

const API = `${BASE_URL}/api`;

// Authenticated fetch helper - includes JWT token in all requests
function authFetchIdea(url, options = {}) {
  const token = localStorage.getItem('access_token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function Button({ text, handleButtonClick }) {
  return (
    <div
      onClick={() => handleButtonClick()}
      className="bg-white select-none shadow-xl border border-gray-200 rounded-full h-10 w-40
        flex justify-center items-center hover:bg-gray-100 active:bg-gray-300"
    >
      {text}
    </div>
  );
}

function CreateCategoryForm({ onButtonClick, onCancel, apiBase }) {
  const [categoryName, setCategoryName] = useState("");

  const create_category = async () => {
    const res = await authFetchIdea(`${apiBase}/create_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName }),
    });
    await res.json();
  };

  const button_click = async () => {
    if (!categoryName.trim()) return;
    await create_category();
    setCategoryName("");
    onButtonClick();
  };

  return (
    <div className="w-100 border border-gray-300 p-5 rounded shadow-xl bg-white justify-center items-center relative">
      <div className="flex flex-col mb-4">
        <TextField
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              button_click();
            }
          }}
          id="outlined-basic"
          label="Category Name"
          variant="outlined"
        />
      </div>
      <div className="w-full flex justify-center items-center gap-2">
        <Button handleButtonClick={button_click} text={"Create"} />
        <div
          onClick={onCancel}
          className="bg-gray-100 select-none shadow-xl border border-gray-200 rounded-full h-10 w-24
            flex justify-center items-center hover:bg-gray-200 active:bg-gray-300 cursor-pointer"
        >
          Cancel
        </div>
      </div>
    </div>
  );
}

/* ===== CONFIRM MODAL ===== */
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-6 z-[9999] min-w-[300px]">
        <p className="text-base mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

export default function IdeaFactory() {
  const { projectId } = useParams();
  const API = `${BASE_URL}/api/projects/${projectId}`;

  const [categories, setCategories] = useState({});
  const [displayForm, setDisplayForm] = useState(false);
  const categoryContainerRef = useRef(null);
  const [resizeCategory, setResizeCategory] = useState(null);

  // Idea state
  const [ideas, setIdeas] = useState({});
  const [unassignedOrder, setUnassignedOrder] = useState([]);
  const [categoryOrders, setCategoryOrders] = useState({});
  const [ideaName, setIdeaName] = useState("");
  const [ideaHeadline, setIdeaHeadline] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(300);

  // Individual idea collapse state
  const [collapsedIdeas, setCollapsedIdeas] = useState({});

  // Category minimized state (stores original size before minimize)
  const [minimizedCategories, setMinimizedCategories] = useState({});

  // Drag state
  const [dragging, setDragging] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [prevIndex, setPrevIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverCategory, setHoverCategory] = useState(null);
  const [hoverUnassigned, setHoverUnassigned] = useState(false);

  // Edit state
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");
  const [editingIdeaHeadline, setEditingIdeaHeadline] = useState("");

  // Form height state (resizable)
  const [formHeight, setFormHeight] = useState(120);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState(null);

  // Archive drawer
  const [showArchive, setShowArchive] = useState(false);

  // Legend state
  const [legendTypes, setLegendTypes] = useState({});
  const [draggingLegend, setDraggingLegend] = useState(null);
  const [hoverIdeaForLegend, setHoverIdeaForLegend] = useState(null);
  const [editingLegendId, setEditingLegendId] = useState(null);
  const [editingLegendName, setEditingLegendName] = useState("");
  const [showLegendColorPicker, setShowLegendColorPicker] = useState(null);
  const [showCreateLegend, setShowCreateLegend] = useState(false);
  const [newLegendColor, setNewLegendColor] = useState("#6366f1");
  const [newLegendName, setNewLegendName] = useState("");
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Filter state - global and per-category (null = unassigned, number = type id)
  const [globalTypeFilter, setGlobalTypeFilter] = useState([]); // empty = show all
  const [categoryTypeFilters, setCategoryTypeFilters] = useState({}); // {categoryId: [typeIds]}
  const [showCategoryFilter, setShowCategoryFilter] = useState(null); // which category filter is open

  const IdeaListRef = useRef(null);
  const categoryRefs = useRef({});
  const ideaRefs = useRef({});

  // ===== CATEGORY RESIZE =====

  const handleResizeProportions = (event, category_key) => {
    const category = categories[category_key];
    const containerRect = categoryContainerRef.current.getBoundingClientRect();

    const startMouseX = event.clientX - containerRect.left;
    const startMouseY = event.clientY - containerRect.top;

    const startWidth = category.width;
    const startHeight = category.height;

    let finalWidth = startWidth;
    let finalHeight = startHeight;

    const onMouseMove = (e) => {
      const currentMouseX = e.clientX - containerRect.left;
      const currentMouseY = e.clientY - containerRect.top;

      const deltaX = currentMouseX - startMouseX;
      const deltaY = currentMouseY - startMouseY;

      const maxWidth = containerRect.width - category.x;
      const maxHeight = containerRect.height - category.y;

      const minWidth = Math.max(80, category.name.length * 9 + 60);
      finalWidth = Math.max(minWidth, Math.min(startWidth + deltaX, maxWidth));
      finalHeight = Math.max(50, Math.min(startHeight + deltaY, maxHeight));

      setCategories((prev) => ({
        ...prev,
        [category_key]: {
          ...prev[category_key],
          width: finalWidth,
          height: finalHeight,
        },
      }));
    };

    const onMouseUp = () => {
      set_area_category(category_key, finalWidth, finalHeight);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const cursor_hovers_corner = (e) => {
    if (!categoryContainerRef.current) return;
    const container_rect = categoryContainerRef.current.getBoundingClientRect();

    const categoryList = Object.values(categories).filter((c) => !c.archived);
    let hovering = false;

    for (let i = 0; i < categoryList.length; i++) {
      const category = categoryList[i];

      const right_bottom_coordinates = {
        x: category.x + category.width + container_rect.left,
        y: category.y + category.height + container_rect.top,
      };

      if (
        e.clientX < right_bottom_coordinates.x + 20 &&
        e.clientX > right_bottom_coordinates.x - 20 &&
        e.clientY < right_bottom_coordinates.y + 20 &&
        e.clientY > right_bottom_coordinates.y - 20
      ) {
        hovering = true;
        setResizeCategory(category.id);
        break;
      }
    }

    document.body.style.cursor = hovering ? "se-resize" : "default";
    if (!hovering) {
      setResizeCategory(null);
    }
  };

  useEffect(() => {
    document.addEventListener("mousemove", cursor_hovers_corner);
    return () => document.removeEventListener("mousemove", cursor_hovers_corner);
  }, [categories]);

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (resizeCategory !== null) {
        handleResizeProportions(e, resizeCategory);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [resizeCategory]);

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

  // ===== CATEGORY API =====

  const fetch_categories = async () => {
    try {
      const res = await authFetchIdea(`${API}/get_all_categories/`);
      const data = await res.json();
      const all_categories = data.categories;

      const serialized = {};
      for (let i = 0; i < all_categories.length; i++) {
        const c = all_categories[i];
        const minWidth = Math.max(80, c.name.length * 9 + 60);
        serialized[c.id] = {
          id: c.id,
          name: c.name,
          x: c.x,
          y: c.y,
          width: Math.max(c.width, minWidth),
          height: c.height,
          z_index: c.z_index || 0,
          archived: c.archived || false,
        };
      }
      setCategories(serialized);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const set_position_category = async (category_id, new_position) => {
    await authFetchIdea(`${API}/set_position_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id, position: new_position }),
    });
  };

  const set_area_category = async (category_id, width, height) => {
    await authFetchIdea(`${API}/set_area_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id, width, height }),
    });
  };

  const delete_category = async (category_id) => {
    try {
      const res = await authFetchIdea(`${API}/delete_category/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category_id }),
      });
      if (res.ok) {
        setCategories((prev) => {
          const updated = { ...prev };
          delete updated[category_id];
          return updated;
        });
        setCategoryOrders((prev) => {
          const updated = { ...prev };
          delete updated[category_id];
          return updated;
        });
        await fetch_all_ideas();
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const confirm_delete_category = (category_id, category_name) => {
    setConfirmModal({
      message: `Delete category "${category_name}"? Its ideas will become unassigned.`,
      onConfirm: () => {
        delete_category(category_id);
        setConfirmModal(null);
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const bring_to_front_category = async (category_id) => {
    await authFetchIdea(`${API}/bring_to_front_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id }),
    });
    setCategories((prev) => {
      const maxZ = Math.max(
        0,
        ...Object.values(prev).map((c) => c.z_index || 0)
      );
      return {
        ...prev,
        [category_id]: { ...prev[category_id], z_index: maxZ + 1 },
      };
    });
  };

  const rename_category_api = async (category_id, new_name) => {
    await authFetchIdea(`${API}/rename_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id, name: new_name }),
    });
    setCategories((prev) => ({
      ...prev,
      [category_id]: { ...prev[category_id], name: new_name },
    }));
  };

  const toggle_archive_category = async (category_id) => {
    const res = await authFetchIdea(`${API}/toggle_archive_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id }),
    });
    const data = await res.json();
    setCategories((prev) => ({
      ...prev,
      [category_id]: { ...prev[category_id], archived: data.archived },
    }));
  };

  // ===== CATEGORY DRAG (clamped) =====

  const handleCategoryDrag = (event, category_key) => {
    const category = categories[category_key];
    const containerRect = categoryContainerRef.current.getBoundingClientRect();

    // Auto bring-to-front on click/drag
    bring_to_front_category(category_key);

    const startX = event.clientX - category.x;
    const startY = event.clientY - category.y;
    let new_x = category.x;
    let new_y = category.y;

    const onMouseMove = (e) => {
      const raw_x = e.clientX - startX;
      const raw_y = e.clientY - startY;
      const maxX = containerRect.width - category.width;
      const maxY = containerRect.height - category.height;

      new_x = Math.max(0, Math.min(raw_x, maxX));
      new_y = Math.max(0, Math.min(raw_y, maxY));

      setCategories((prev) => ({
        ...prev,
        [category_key]: { ...prev[category_key], x: new_x, y: new_y },
      }));
    };

    const onMouseUp = () => {
      set_position_category(category_key, { x: new_x, y: new_y });
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const customFormButtonClick = () => {
    setDisplayForm(false);
    fetch_categories();
  };

  // ===== SIDEBAR RESIZE =====

  const handleSidebarResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (e) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(startWidth + delta, window.innerWidth * 0.5));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      requestAnimationFrame(() => {
        if (categoryContainerRef.current) {
          const containerRect = categoryContainerRef.current.getBoundingClientRect();
          setCategories((prev) => {
            const updated = { ...prev };
            let changed = false;
            for (const [key, cat] of Object.entries(updated)) {
              if (cat.archived) continue;
              const maxX = Math.max(0, containerRect.width - cat.width);
              const maxY = Math.max(0, containerRect.height - cat.height);
              const clampedX = Math.max(0, Math.min(cat.x, maxX));
              const clampedY = Math.max(0, Math.min(cat.y, maxY));
              if (clampedX !== cat.x || clampedY !== cat.y) {
                updated[key] = { ...cat, x: clampedX, y: clampedY };
                set_position_category(key, { x: clampedX, y: clampedY });
                changed = true;
              }
            }
            return changed ? updated : prev;
          });
        }
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // ===== IDEA API =====

  const fetch_all_ideas = async () => {
    try {
      const res = await authFetchIdea(`${API}/get_all_ideas/`);
      const data = await res.json();
      const idea_list = data?.data || [];
      const order = data?.order || [];
      const cat_orders = data?.category_orders || {};

      const idea_object = {};
      for (let i = 0; i < idea_list.length; i++) {
        const idea = idea_list[i];
        idea_object[idea.id] = { ...idea };
      }

      setIdeas(idea_object);
      setUnassignedOrder(order);
      setCategoryOrders(cat_orders);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
    }
  };

  const create_idea = async () => {
    if (!ideaName.trim()) return;
    await authFetchIdea(`${API}/create_idea/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_name: ideaName, description: "", headline: ideaHeadline }),
    });
    setIdeaName("");
    setIdeaHeadline("");
    fetch_all_ideas();
  };

  const delete_idea = async (idea_id) => {
    await authFetchIdea(`${API}/delete_idea/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idea_id }),
    });
    fetch_all_ideas();
  };

  const update_idea_title_api = async (idea_id, new_title, new_headline = null) => {
    if (!new_title.trim()) return;
    await authFetchIdea(`${API}/update_idea_title/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idea_id, title: new_title }),
    });
    // Also update headline if provided
    if (new_headline !== null) {
      await authFetchIdea(`${API}/update_idea_headline/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea_id, headline: new_headline }),
      });
    }
    setIdeas((prev) => ({
      ...prev,
      [idea_id]: { ...prev[idea_id], title: new_title, headline: new_headline !== null ? new_headline : prev[idea_id].headline },
    }));
  };

  const safe_order = async (new_order, category_id = null) => {
    await authFetchIdea(`${API}/safe_order/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: new_order, category_id }),
    });
  };

  const assign_idea_to_category = async (idea_id, category_id) => {
    await authFetchIdea(`${API}/assign_idea_to_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id, category_id }),
    });
    fetch_all_ideas();
  };

  // ===== UNIFIED IDEA DRAG =====

  const isPointInRect = (px, py, rect) => {
    return (
      px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
    );
  };

  const handleIdeaDrag = (event, idea, index, source) => {
    const from_index = index;
    let to_index = index;
    let drop_target = null;

    let ghost = { idea, x: event.clientX, y: event.clientY };

    setDragging(ghost);
    setPrevIndex(index);
    setDragSource(source);

    let sourceDomElements = [];
    if (source.type === "unassigned" && IdeaListRef.current) {
      sourceDomElements = [
        ...IdeaListRef.current.querySelectorAll("[data-idea-item]"),
      ];
    } else if (
      source.type === "category" &&
      categoryRefs.current[source.id]
    ) {
      sourceDomElements = [
        ...categoryRefs.current[source.id].querySelectorAll("[data-idea-item]"),
      ];
    }

    const onMouseMove = (e) => {
      ghost = { ...ghost, x: e.clientX, y: e.clientY };
      setDragging(ghost);

      let foundUnassigned = false;
      if (IdeaListRef.current) {
        const listRect = IdeaListRef.current.getBoundingClientRect();
        if (isPointInRect(e.clientX, e.clientY, listRect)) {
          foundUnassigned = true;
        }
      }

      let foundCategory = null;
      if (!foundUnassigned && categoryContainerRef.current) {
        const containerRect =
          categoryContainerRef.current.getBoundingClientRect();
        for (const [catId, catData] of Object.entries(categories)) {
          if (catData.archived) continue;
          const catRect = {
            left: containerRect.left + catData.x,
            top: containerRect.top + catData.y,
            right: containerRect.left + catData.x + catData.width,
            bottom: containerRect.top + catData.y + catData.height,
          };
          if (isPointInRect(e.clientX, e.clientY, catRect)) {
            foundCategory = catId;
            break;
          }
        }
      }

      setHoverCategory(foundCategory);
      setHoverUnassigned(foundUnassigned);
      drop_target = foundCategory
        ? { type: "category", id: foundCategory }
        : foundUnassigned
        ? { type: "unassigned" }
        : null;

      const isOverSource =
        (source.type === "unassigned" && foundUnassigned) ||
        (source.type === "category" &&
          foundCategory === String(source.id));

      if (isOverSource && sourceDomElements.length > 1) {
        for (let i = 0; i < sourceDomElements.length - 1; i++) {
          const rect = sourceDomElements[i].getBoundingClientRect();
          const next_rect =
            sourceDomElements[i + 1].getBoundingClientRect();
          if (ghost.y > rect.y && ghost.y < next_rect.y) {
            setHoverIndex(i);
            to_index = i;
          }
        }
      } else {
        setHoverIndex(null);
      }
    };

    const onMouseUp = () => {
      const sameSource =
        drop_target &&
        ((drop_target.type === source.type &&
          drop_target.type === "unassigned") ||
          (drop_target.type === "category" &&
            source.type === "category" &&
            String(drop_target.id) === String(source.id)));

      if (sameSource) {
        if (source.type === "unassigned") {
          const newOrder = [...unassignedOrder];
          const [movedId] = newOrder.splice(from_index, 1);
          newOrder.splice(to_index, 0, movedId);
          setUnassignedOrder(newOrder);
          safe_order(newOrder, null);
        } else if (source.type === "category") {
          const newOrder = [...(categoryOrders[source.id] || [])];
          const [movedId] = newOrder.splice(from_index, 1);
          newOrder.splice(to_index, 0, movedId);
          setCategoryOrders((prev) => ({ ...prev, [source.id]: newOrder }));
          safe_order(newOrder, source.id);
        }
      } else if (drop_target) {
        const target_category_id =
          drop_target.type === "category" ? parseInt(drop_target.id) : null;
        assign_idea_to_category(idea.id, target_category_id);
      }

      setDragging(null);
      setPrevIndex(null);
      setHoverIndex(null);
      setDragSource(null);
      setHoverCategory(null);
      setHoverUnassigned(false);

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // ===== LEGEND TYPE API =====

  const fetch_legend_types = async () => {
    try {
      const res = await authFetchIdea(`${API}/get_all_legend_types/`);
      const data = await res.json();
      const legend_list = data?.legend_types || [];
      const legend_object = {};
      for (const lt of legend_list) {
        legend_object[lt.id] = lt;
      }
      setLegendTypes(legend_object);
    } catch (err) {
      console.error("Failed to fetch legend types:", err);
    }
  };

  const create_legend_type = async (name, color) => {
    const res = await authFetchIdea(`${API}/create_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const data = await res.json();
    if (data.legend_type) {
      setLegendTypes((prev) => ({
        ...prev,
        [data.legend_type.id]: data.legend_type,
      }));
    }
    return data;
  };

  const update_legend_type = async (id, updates) => {
    await authFetchIdea(`${API}/update_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    setLegendTypes((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  };

  const delete_legend_type = async (id) => {
    await authFetchIdea(`${API}/delete_legend_type/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLegendTypes((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    // Update ideas that had this legend type
    setIdeas((prev) => {
      const updated = { ...prev };
      for (const [key, idea] of Object.entries(updated)) {
        if (idea.legend_type_id === id) {
          updated[key] = { ...idea, legend_type_id: null };
        }
      }
      return updated;
    });
  };

  const assign_idea_legend_type = async (idea_id, legend_type_id) => {
    await authFetchIdea(`${API}/assign_idea_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id, legend_type_id }),
    });
    setIdeas((prev) => ({
      ...prev,
      [idea_id]: { ...prev[idea_id], legend_type_id },
    }));
  };

  // ===== LEGEND DRAG HANDLER =====

  const handleLegendDrag = (event, legendTypeId) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let currentHoverIdeaId = null;
    
    setDraggingLegend({
      id: legendTypeId,
      x: startX,
      y: startY,
      color: legendTypeId ? legendTypes[legendTypeId]?.color : "#374151",
    });

    const onMouseMove = (e) => {
      setDraggingLegend((prev) => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
      }));

      // Check if hovering over any idea
      let foundIdeaId = null;
      for (const [ideaId, ref] of Object.entries(ideaRefs.current)) {
        if (ref) {
          const rect = ref.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            foundIdeaId = parseInt(ideaId);
            break;
          }
        }
      }
      currentHoverIdeaId = foundIdeaId;
      setHoverIdeaForLegend(foundIdeaId);
    };

    const onMouseUp = () => {
      if (currentHoverIdeaId) {
        assign_idea_legend_type(currentHoverIdeaId, legendTypeId);
      }
      setDraggingLegend(null);
      setHoverIdeaForLegend(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // ===== INIT =====

  useEffect(() => {
    fetch_categories();
    fetch_all_ideas();
    fetch_legend_types();
  }, [projectId]);

  // ===== RENDER HELPER =====

  const renderIdeaItem = (ideaId, arrayIndex, source) => {
    const idea = ideas[ideaId];
    if (!idea) return null;

    const isSource =
      dragSource &&
      dragSource.type === source.type &&
      (source.type === "unassigned" ||
        String(dragSource.id) === String(source.id));

    const isEditing = editingIdeaId === ideaId;
    const legendType = idea.legend_type_id ? legendTypes[idea.legend_type_id] : null;
    const isHoveredForLegend = hoverIdeaForLegend === ideaId;
    
    // Individual idea collapse only
    const isIdeaCollapsed = collapsedIdeas[ideaId] ?? false;

    // For collapsed view: show headline or truncated title
    const getDisplayText = () => {
      if (idea.headline) {
        return <span className="font-semibold">{idea.headline}</span>;
      }
      // No headline - truncate title after ~5 words
      const words = idea.title.split(/\s+/);
      if (words.length > 5) {
        return <span className="font-semibold">{words.slice(0, 5).join(" ")}...</span>;
      }
      return <span className="font-semibold">{idea.title}</span>;
    };

    return (
      <div key={`idea_${ideaId}`} data-idea-item="true">
        {/* Drop indicator */}
        <div
          style={{
            opacity: isSource && arrayIndex === hoverIndex ? 1 : 0,
            transform:
              isSource && arrayIndex === hoverIndex
                ? "translateY(2px)"
                : "translateY(0px)",
            transition: "opacity 100ms ease",
          }}
          className="w-full h-1 my-[1px] rounded bg-gray-700"
        />

        {isEditing ? (
          <div className="w-full rounded bg-blue-50 text-blue-600 px-2 py-1.5 text-xs mb-1 border border-blue-200 italic">
            Editing above...
          </div>
        ) : (
          <div
            ref={(el) => (ideaRefs.current[ideaId] = el)}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleIdeaDrag(e, idea, arrayIndex, source);
            }}
            style={{
              backgroundColor:
                isHoveredForLegend
                  ? (draggingLegend?.color || "#e0e7ff")
                  : isSource && arrayIndex === prevIndex
                  ? "#e5e7eb"
                  : legendType
                  ? `${legendType.color}20`
                  : "#ffffff4b",
              borderLeftColor: legendType ? legendType.color : "#374151",
              borderLeftWidth: "4px",
              transform:
                isSource &&
                hoverIndex !== null &&
                arrayIndex >= hoverIndex &&
                arrayIndex !== prevIndex
                  ? "translateY(6px)"
                  : "translateY(0px)",
              transition: "transform 200ms ease, background-color 200ms ease, border-color 200ms ease",
            }}
            className={`w-full rounded text-gray-800 px-2 py-1.5 flex justify-between items-start text-xs mb-1 cursor-grab leading-snug shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 ${isHoveredForLegend ? 'ring-2 ring-offset-1' : ''}`}
          >
            <div className="flex items-start gap-1.5 flex-1 mr-1">
              {/* Collapse toggle - colored triangle replacing dot */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedIdeas((prev) => ({
                    ...prev,
                    [ideaId]: !prev[ideaId],
                  }));
                }}
                className="cursor-pointer flex-shrink-0 text-sm mt-0"
                style={{ color: legendType ? legendType.color : "#374151" }}
                title={`${isIdeaCollapsed ? "Expand" : "Collapse"} - ${legendType ? legendType.name : "Unassigned"}`}
              >
                {isIdeaCollapsed ? '▶' : '▼'}
              </span>
              <div className="break-words whitespace-pre-wrap">
                {isIdeaCollapsed ? (
                  getDisplayText()
                ) : (
                  <>
                    {idea.headline && <div className="font-semibold mb-0.5">{idea.headline}</div>}
                    {idea.title}
                  </>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 mt-0.5 flex items-center gap-0.5 text-gray-400">
              <EditIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingIdeaId(ideaId);
                  setEditingIdeaTitle(idea.title);
                  setEditingIdeaHeadline(idea.headline || "");
                }}
                className="hover:text-blue-500! cursor-pointer"
                style={{ fontSize: 13 }}
              />
              <DeleteForeverIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmModal({
                    message: (
                      <div>
                        <p className="mb-2">Delete this idea?</p>
                        {idea.headline && <p className="font-semibold text-sm">{idea.headline}</p>}
                        <p className="text-sm text-gray-600 mt-1">{idea.title.length > 100 ? idea.title.slice(0, 100) + "..." : idea.title}</p>
                      </div>
                    ),
                    onConfirm: () => {
                      delete_idea(idea.id);
                      setConfirmModal(null);
                    },
                    onCancel: () => setConfirmModal(null),
                  });
                }}
                className="hover:text-red-500! cursor-pointer"
                style={{ fontSize: 14 }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===== ARCHIVE HELPERS =====

  const archivedCategories = Object.values(categories).filter((c) => c.archived);
  const activeCategories = Object.entries(categories).filter(([, c]) => !c.archived);

  // ===== JSX =====

  return (
    <>
      <div className="h-screen w-screen p-10 flex justify-center items-center select-none">
        {/* Create Category Form Overlay */}
        <div
          style={{ display: displayForm ? "block" : "none" }}
          className="fixed z-[9998] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <CreateCategoryForm
            onButtonClick={customFormButtonClick}
            onCancel={() => setDisplayForm(false)}
            apiBase={API}
          />
        </div>
        <div
          onClick={() => setDisplayForm(false)}
          style={{ display: displayForm ? "block" : "none" }}
          className="h-full w-full fixed inset-0 bg-black/40 z-[9997]"
        />

        {/* Confirm Modal */}
        {confirmModal && (
          <ConfirmModal
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onCancel={confirmModal.onCancel}
          />
        )}

        <div className="h-full w-full bg-white shadow-2xl border border-gray-300 rounded flex">
          {/* ===== LEFT SIDEBAR ===== */}
          <div
            style={{ width: `${sidebarWidth}px`, minWidth: 200 }}
            className="h-full shadow-xl bg-white border border-gray-200 select-none flex flex-col flex-shrink-0"
          >
            {/* Create/Edit Idea Form */}
            <div className="bg-gray-50 p-3 flex-shrink-0 relative border-b border-gray-200" style={{ minHeight: formHeight }}>
              <h1 className="text-xl mb-2">
                {editingIdeaId ? "Edit Idea" : "New Idea"}
              </h1>
              {/* Headline field */}
              <TextField
                value={editingIdeaId ? editingIdeaHeadline : ideaHeadline}
                onChange={(e) => {
                  if (editingIdeaId) {
                    setEditingIdeaHeadline(e.target.value);
                  } else {
                    setIdeaHeadline(e.target.value);
                  }
                }}
                id="idea-headline"
                label="Headline (optional)"
                variant="outlined"
                size="small"
                fullWidth
                sx={{ backgroundColor: "white", borderRadius: 1, marginBottom: 1 }}
              />
              <TextField
                value={editingIdeaId ? editingIdeaTitle : ideaName}
                onChange={(e) => {
                  if (editingIdeaId) {
                    setEditingIdeaTitle(e.target.value);
                  } else {
                    setIdeaName(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editingIdeaId) {
                      update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaHeadline);
                      setEditingIdeaId(null);
                      setEditingIdeaTitle("");
                      setEditingIdeaHeadline("");
                    } else {
                      create_idea();
                    }
                  } else if (e.key === "Escape" && editingIdeaId) {
                    setEditingIdeaId(null);
                    setEditingIdeaTitle("");
                    setEditingIdeaHeadline("");
                  }
                }}
                id="idea-name"
                label={editingIdeaId ? "Edit your idea..." : "What's your idea?"}
                variant="outlined"
                multiline
                minRows={2}
                maxRows={Math.max(2, Math.floor((formHeight - (editingIdeaId ? 100 : 60)) / 24))}
                fullWidth
                sx={{ backgroundColor: "white", borderRadius: 1 }}
              />
              {/* Action buttons */}
              <div className="flex gap-2 mt-2">
                {editingIdeaId ? (
                  <>
                    <button
                      onClick={() => {
                        update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaHeadline);
                        setEditingIdeaId(null);
                        setEditingIdeaTitle("");
                        setEditingIdeaHeadline("");
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => {
                        setEditingIdeaId(null);
                        setEditingIdeaTitle("");
                        setEditingIdeaHeadline("");
                      }}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  ideaName.trim() && (
                    <button
                      onClick={create_idea}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      Create
                    </button>
                  )
                )}
              </div>
              {/* Resize handle */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = formHeight;
                  const onMouseMove = (ev) => {
                    const delta = ev.clientY - startY;
                    setFormHeight(Math.max(100, Math.min(startHeight + delta, 400)));
                  };
                  const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                  };
                  document.addEventListener("mousemove", onMouseMove);
                  document.addEventListener("mouseup", onMouseUp);
                }}
                className="absolute bottom-0 left-0 right-0 h-2 bg-gray-300 hover:bg-blue-400 cursor-ns-resize transition-colors"
              />
            </div>

            {/* Unassigned Idea List */}
            <div
              ref={IdeaListRef}
              style={{
                backgroundColor:
                  dragging && hoverUnassigned ? "#f3f4f6" : "#ffffff",
                transition: "background-color 150ms ease",
              }}
              className="flex-1 p-2 relative overflow-y-auto"
            >
              <h1 className="text-xl mb-1">Unassigned Ideas</h1>
              {unassignedOrder
                .filter((ideaId) => {
                  if (globalTypeFilter.length === 0) return true;
                  const idea = ideas[ideaId];
                  if (!idea) return false;
                  // Check if idea's type matches any selected filter
                  if (globalTypeFilter.includes("unassigned") && !idea.legend_type_id) return true;
                  if (idea.legend_type_id && globalTypeFilter.includes(idea.legend_type_id)) return true;
                  return false;
                })
                .map((ideaId, arrayIndex) =>
                  renderIdeaItem(ideaId, arrayIndex, { type: "unassigned" })
                )}
            </div>

            {/* LEGEND PANEL - Inside Sidebar */}
            <div className="bg-white border-t border-gray-300 p-3 flex-shrink-0">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setLegendCollapsed(!legendCollapsed)}
              >
                <h3 className="text-sm font-semibold text-gray-600">Legend {globalTypeFilter.length > 0 && <span className="text-blue-500">(filtered)</span>}</h3>
                <span className="text-gray-400 text-xs">{legendCollapsed ? '▲' : '▼'}</span>
              </div>
              
              {!legendCollapsed && (
                <>
                  {/* Clear filter button */}
                  {globalTypeFilter.length > 0 && (
                    <button
                      onClick={() => setGlobalTypeFilter([])}
                      className="w-full mt-1 mb-2 text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                    >
                      Clear Filter
                    </button>
                  )}
                  
                  {/* Unassigned type (black) - always first */}
                  <div 
                    className={`flex items-center gap-2 mb-1.5 group mt-2 cursor-pointer rounded px-1 py-0.5 transition-colors ${globalTypeFilter.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
                    onClick={() => {
                      setGlobalTypeFilter((prev) => 
                        prev.includes("unassigned") 
                          ? prev.filter((t) => t !== "unassigned") 
                          : [...prev, "unassigned"]
                      );
                    }}
                  >
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, null); }}
                      className="w-6 h-6 rounded-full cursor-grab hover:scale-110 transition-transform shadow-sm border border-gray-200 bg-gray-700"
                      title="Drag to remove type"
                    />
                    <span className="text-xs text-gray-500 italic flex-1">Unassigned</span>
                    {globalTypeFilter.includes("unassigned") && <span className="text-blue-500 text-xs">✓</span>}
                  </div>

                  {/* Custom legend types */}
                  {Object.values(legendTypes).map((lt) => (
                    <div 
                      key={lt.id} 
                      className={`flex items-center gap-2 mb-1.5 group cursor-pointer rounded px-1 py-0.5 transition-colors ${globalTypeFilter.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
                      onClick={() => {
                        setGlobalTypeFilter((prev) => 
                          prev.includes(lt.id) 
                            ? prev.filter((t) => t !== lt.id) 
                            : [...prev, lt.id]
                        );
                      }}
                    >
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, lt.id); }}
                        className="w-6 h-6 rounded-full cursor-grab hover:scale-110 transition-transform shadow-sm border border-gray-200"
                        style={{ backgroundColor: lt.color }}
                        title={`Drag to assign: ${lt.name}`}
                      />
                      {editingLegendId === lt.id ? (
                        <input
                          autoFocus
                          value={editingLegendName}
                          onChange={(e) => setEditingLegendName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              update_legend_type(lt.id, { name: editingLegendName });
                              setEditingLegendId(null);
                            } else if (e.key === "Escape") {
                              setEditingLegendId(null);
                            }
                          }}
                          onBlur={() => {
                            update_legend_type(lt.id, { name: editingLegendName });
                            setEditingLegendId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs px-1 py-0.5 border border-blue-400 rounded outline-none flex-1 min-w-0"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingLegendId(lt.id);
                            setEditingLegendName(lt.name);
                          }}
                          className="text-xs text-gray-700 cursor-text flex-1"
                        >
                          {lt.name}
                        </span>
                      )}
                      {globalTypeFilter.includes(lt.id) && <span className="text-blue-500 text-xs">✓</span>}
                      <input
                        type="color"
                        value={lt.color}
                        onChange={(e) => update_legend_type(lt.id, { color: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Change color"
                      />
                      <DeleteForeverIcon
                        onClick={(e) => { e.stopPropagation(); delete_legend_type(lt.id); }}
                        className="text-gray-300 hover:text-red-500! cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ fontSize: 16 }}
                      />
                    </div>
                  ))}

                  {/* Create new legend type */}
                  {showCreateLegend ? (
                    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="color"
                          value={newLegendColor}
                          onChange={(e) => setNewLegendColor(e.target.value)}
                          className="w-6 h-6 cursor-pointer rounded"
                        />
                        <input
                          autoFocus
                          value={newLegendName}
                          onChange={(e) => setNewLegendName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newLegendName.trim()) {
                              create_legend_type(newLegendName, newLegendColor);
                              setNewLegendName("");
                              setNewLegendColor("#6366f1");
                              setShowCreateLegend(false);
                            } else if (e.key === "Escape") {
                              setShowCreateLegend(false);
                            }
                          }}
                          placeholder="Type name..."
                          className="text-xs px-2 py-1 border border-gray-300 rounded outline-none flex-1 focus:border-blue-400"
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (newLegendName.trim()) {
                              create_legend_type(newLegendName, newLegendColor);
                              setNewLegendName("");
                              setNewLegendColor("#6366f1");
                              setShowCreateLegend(false);
                            }
                          }}
                          className="flex-1 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => setShowCreateLegend(false)}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCreateLegend(true)}
                      className="w-full mt-2 text-xs px-2 py-1.5 border border-dashed border-gray-300 rounded text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      + Add Type
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ===== RESIZE HANDLE ===== */}
          <div
            onMouseDown={handleSidebarResize}
            className="w-1.5 h-full bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors duration-150"
          />

          {/* ===== CATEGORY CONTAINER ===== */}
          <div
            ref={categoryContainerRef}
            className="flex-1 h-full shadow-xl border border-gray-200 relative overflow-hidden"
          >
            {/* Create Category Button — always on top */}
            <div className="absolute top-4 right-4 z-[9999] flex gap-2">
              <Button
                text={"Create Category"}
                handleButtonClick={() => setDisplayForm(true)}
              />
              {archivedCategories.length > 0 && (
                <div
                  onClick={() => setShowArchive(!showArchive)}
                  className="bg-white select-none shadow-xl border border-gray-200 rounded-full h-10 px-4
                    flex justify-center items-center hover:bg-gray-100 active:bg-gray-300 cursor-pointer gap-1"
                >
                  <ArchiveIcon style={{ fontSize: 18 }} />
                  <span className="text-sm">{archivedCategories.length}</span>
                </div>
              )}
            </div>

            {/* Archive drawer */}
            {showArchive && archivedCategories.length > 0 && (
              <div className="absolute top-16 right-4 z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 p-3 min-w-[220px] max-h-[400px] overflow-y-auto">
                <h3 className="text-sm font-semibold mb-2 text-gray-500">Archived Categories</h3>
                {archivedCategories.map((cat) => {
                  const catIdeas = categoryOrders[cat.id] || [];
                  return (
                    <div
                      key={cat.id}
                      className="flex justify-between items-center p-2 rounded hover:bg-gray-50 mb-1 border border-gray-100"
                    >
                      <div className="flex-1">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          ({catIdeas.length} ideas)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <UnarchiveIcon
                          onClick={() => toggle_archive_category(cat.id)}
                          className="hover:text-green-600! cursor-pointer"
                          style={{ fontSize: 18 }}
                          titleAccess="Restore"
                        />
                        <DeleteForeverIcon
                          onClick={() =>
                            confirm_delete_category(cat.id, cat.name)
                          }
                          className="hover:text-red-500! cursor-pointer"
                          style={{ fontSize: 18 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Category Displays (only non-archived) */}
            {activeCategories.map(([category_key, category_data]) => {
              const catIdeas = categoryOrders[category_key] || [];
              const isHovered =
                dragging &&
                String(hoverCategory) === String(category_key);

              return (
                <div
                  onMouseDown={(e) => {
                    if (!e.ctrlKey) {
                      // Only start drag from header — this outer handler
                      // is needed so clicking the category body selects it
                      bring_to_front_category(category_key);
                    }
                  }}
                  style={{
                    left: category_data.x,
                    top: category_data.y,
                    width: category_data.width,
                    height: category_data.height,
                    zIndex: category_data.z_index || 0,
                    backgroundColor: isHovered ? "#fde68a" : "#fef08a",
                    transition: "background-color 150ms ease",
                  }}
                  key={category_key}
                  className="absolute shadow-xl rounded p-2 flex flex-col"
                >
                  {/* Category header (drag handle) */}
                  <div
                    onMouseDown={(e) => {
                      if (!e.ctrlKey) {
                        e.stopPropagation();
                        handleCategoryDrag(e, category_key);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingCategoryId(category_key);
                      setEditingCategoryName(category_data.name);
                    }}
                    className="flex justify-between items-center mb-1 flex-shrink-0 bg-amber-300/50 rounded-t px-1 py-0.5 cursor-grab active:cursor-grabbing border-b border-amber-400/40"
                  >
                    {editingCategoryId === category_key ? (
                      <input
                        autoFocus
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            rename_category_api(category_key, editingCategoryName);
                            setEditingCategoryId(null);
                          } else if (e.key === "Escape") {
                            setEditingCategoryId(null);
                          }
                        }}
                        onBlur={() => {
                          rename_category_api(category_key, editingCategoryName);
                          setEditingCategoryId(null);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="bg-white text-sm font-semibold px-1 py-0.5 rounded outline-none border border-blue-400 flex-1 mr-1"
                      />
                    ) : (
                      <span className="font-semibold text-sm truncate">
                        {category_data.name}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      {/* Minimize/Restore button */}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (minimizedCategories[category_key]) {
                            // Restore to original size
                            const original = minimizedCategories[category_key];
                            setCategories((prev) => ({
                              ...prev,
                              [category_key]: {
                                ...prev[category_key],
                                width: original.width,
                                height: original.height,
                              },
                            }));
                            set_area_category(category_key, original.width, original.height);
                            setMinimizedCategories((prev) => {
                              const updated = { ...prev };
                              delete updated[category_key];
                              return updated;
                            });
                          } else {
                            // Minimize to minimum size
                            const minWidth = Math.max(80, category_data.name.length * 9 + 60);
                            const minHeight = 50;
                            setMinimizedCategories((prev) => ({
                              ...prev,
                              [category_key]: {
                                width: category_data.width,
                                height: category_data.height,
                              },
                            }));
                            setCategories((prev) => ({
                              ...prev,
                              [category_key]: {
                                ...prev[category_key],
                                width: minWidth,
                                height: minHeight,
                              },
                            }));
                            set_area_category(category_key, minWidth, minHeight);
                          }
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="text-xs text-amber-700 hover:text-amber-900 cursor-pointer px-0.5"
                        title={minimizedCategories[category_key] ? "Restore size" : "Minimize"}
                      >
                        {minimizedCategories[category_key] ? '◻' : '—'}
                      </span>
                      {/* Collapse all ideas toggle */}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          // Toggle all ideas in this category
                          const catIdeasList = categoryOrders[category_key] || [];
                          const allCollapsed = catIdeasList.every((id) => collapsedIdeas[id]);
                          const newState = {};
                          catIdeasList.forEach((id) => {
                            newState[id] = !allCollapsed;
                          });
                          setCollapsedIdeas((prev) => ({ ...prev, ...newState }));
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="text-xs text-amber-700 hover:text-amber-900 cursor-pointer px-1"
                        title={(categoryOrders[category_key] || []).every((id) => collapsedIdeas[id]) ? "Expand all ideas" : "Collapse all ideas"}
                      >
                        {(categoryOrders[category_key] || []).every((id) => collapsedIdeas[id]) ? '▼' : '▲'}
                      </span>
                      {/* Type filter button */}
                      <span
                        data-filter-dropdown
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCategoryFilter(showCategoryFilter === category_key ? null : category_key);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className={`text-xs cursor-pointer px-1 ${(categoryTypeFilters[category_key]?.length > 0) ? "text-blue-600" : "text-amber-700 hover:text-amber-900"}`}
                        title="Filter by type"
                      >
                        ⚙
                      </span>
                      <ArchiveIcon
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle_archive_category(category_key);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="hover:text-amber-700! cursor-pointer"
                        style={{ fontSize: 16 }}
                        titleAccess="Archive"
                      />
                      <DeleteForeverIcon
                        onClick={(e) => {
                          e.stopPropagation();
                          confirm_delete_category(
                            category_key,
                            category_data.name
                          );
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="hover:text-red-500! cursor-pointer"
                        style={{ fontSize: 18 }}
                      />
                    </div>
                  </div>

                  {/* Filter dropdown */}
                  {showCategoryFilter === category_key && (
                    <div 
                      data-filter-dropdown
                      className="absolute top-8 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[140px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs font-semibold text-gray-500 mb-1">Filter by Type</div>
                      {categoryTypeFilters[category_key]?.length > 0 && (
                        <button
                          onClick={() => setCategoryTypeFilters((prev) => ({ ...prev, [category_key]: [] }))}
                          className="w-full text-xs px-2 py-1 mb-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                          Clear
                        </button>
                      )}
                      <div
                        className={`flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer text-xs ${categoryTypeFilters[category_key]?.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
                        onClick={() => {
                          setCategoryTypeFilters((prev) => {
                            const current = prev[category_key] || [];
                            return {
                              ...prev,
                              [category_key]: current.includes("unassigned")
                                ? current.filter((t) => t !== "unassigned")
                                : [...current, "unassigned"],
                            };
                          });
                        }}
                      >
                        <div className="w-3 h-3 rounded-full bg-gray-700" />
                        <span className="flex-1 text-gray-500 italic">Unassigned</span>
                        {categoryTypeFilters[category_key]?.includes("unassigned") && <span className="text-blue-500">✓</span>}
                      </div>
                      {Object.values(legendTypes).map((lt) => (
                        <div
                          key={lt.id}
                          className={`flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer text-xs ${categoryTypeFilters[category_key]?.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
                          onClick={() => {
                            setCategoryTypeFilters((prev) => {
                              const current = prev[category_key] || [];
                              return {
                                ...prev,
                                [category_key]: current.includes(lt.id)
                                  ? current.filter((t) => t !== lt.id)
                                  : [...current, lt.id],
                              };
                            });
                          }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
                          <span className="flex-1">{lt.name}</span>
                          {categoryTypeFilters[category_key]?.includes(lt.id) && <span className="text-blue-500">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ideas inside category (scrollable) */}
                  <div
                    ref={(el) =>
                      (categoryRefs.current[category_key] = el)
                    }
                    className="flex-1 overflow-y-auto overflow-x-hidden"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {catIdeas
                      .filter((ideaId) => {
                        // Apply both global and category filters
                        const idea = ideas[ideaId];
                        if (!idea) return false;
                        
                        // Check global filter
                        if (globalTypeFilter.length > 0) {
                          if (globalTypeFilter.includes("unassigned") && !idea.legend_type_id) {
                            // passes global filter
                          } else if (idea.legend_type_id && globalTypeFilter.includes(idea.legend_type_id)) {
                            // passes global filter
                          } else {
                            return false;
                          }
                        }
                        
                        // Check category filter
                        const catFilter = categoryTypeFilters[category_key] || [];
                        if (catFilter.length > 0) {
                          if (catFilter.includes("unassigned") && !idea.legend_type_id) return true;
                          if (idea.legend_type_id && catFilter.includes(idea.legend_type_id)) return true;
                          return false;
                        }
                        
                        return true;
                      })
                      .map((ideaId, arrayIndex) =>
                        renderIdeaItem(ideaId, arrayIndex, {
                          type: "category",
                          id: category_key,
                        })
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* GHOST (dragging indicator - rendered outside main layout, always on top) */}
      {dragging && (
        <div
          style={{
            top: `${dragging.y}px`,
            left: `${dragging.x}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="fixed max-w-60 shadow-lg border border-gray-200 bg-white rounded text-gray-800 px-2 py-1.5 flex items-center text-xs"
        >
          <span className="whitespace-pre-wrap line-clamp-2">
            {dragging.idea.headline && <span className="font-semibold">{dragging.idea.headline}: </span>}
            {dragging.idea.title}
          </span>
        </div>
      )}

      {/* LEGEND DRAG GHOST */}
      {draggingLegend && (
        <div
          style={{
            top: `${draggingLegend.y}px`,
            left: `${draggingLegend.x}px`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 9999,
            backgroundColor: draggingLegend.color,
          }}
          className="fixed w-8 h-8 rounded-full shadow-lg border-2 border-white"
        />
      )}

    </>
  );
}