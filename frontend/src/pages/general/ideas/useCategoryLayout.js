// Category canvas layout: position, resize, z-index, sidebar resize, corner cursor detection
import { useState, useEffect, useRef } from "react";

/**
 * Hook for managing category canvas layout interactions.
 * Handles category drag positioning, resize, z-index, sidebar resize,
 * and resize corner cursor detection.
 */
export function useCategoryLayout({
  categories,
  setCategories,
  set_position_category,
  set_area_category,
  bring_to_front_category,
}) {
  const categoryContainerRef = useRef(null);
  const [resizeCategory, setResizeCategory] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);

  // Category minimized state (stores original size before minimize)
  const [minimizedCategories, setMinimizedCategories] = useState({});

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

  // Cursor hover detection effect
  useEffect(() => {
    document.addEventListener("mousemove", cursor_hovers_corner);
    return () => document.removeEventListener("mousemove", cursor_hovers_corner);
  }, [categories]);

  // Resize mousedown effect
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (resizeCategory !== null) {
        handleResizeProportions(e, resizeCategory);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [resizeCategory]);

  // ===== CATEGORY DRAG (clamped) =====

  const handleCategoryDrag = (event, category_key) => {
    const category = categories[category_key];
    const containerRect = categoryContainerRef.current.getBoundingClientRect();

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

  // ===== MINIMIZE / RESTORE =====

  const toggleMinimizeCategory = (category_key, category_data) => {
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
  };

  return {
    categoryContainerRef,
    sidebarWidth,
    minimizedCategories,
    handleCategoryDrag,
    handleSidebarResize,
    toggleMinimizeCategory,
  };
}
