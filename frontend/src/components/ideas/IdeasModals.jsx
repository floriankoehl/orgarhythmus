// Modals: confirm delete + create category form overlay
import { useState } from "react";
import TextField from "@mui/material/TextField";
import { authFetch } from '../../auth';

/* ===== CONFIRM MODAL ===== */
export function ConfirmModal({ message, onConfirm, onCancel }) {
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

/* ===== CREATE CATEGORY FORM ===== */
export function CreateCategoryForm({ onButtonClick, onCancel, apiBase }) {
  const [categoryName, setCategoryName] = useState("");

  const create_category = async () => {
    const res = await authFetch(`${apiBase}/create_category/`, {
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
        <div
          onClick={button_click}
          className="bg-white select-none shadow-xl border border-gray-200 rounded-full h-10 w-40
            flex justify-center items-center hover:bg-gray-100 active:bg-gray-300 cursor-pointer"
        >
          Create
        </div>
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

/* ===== COMBINED MODALS LAYER ===== */
export default function IdeasModals({
  confirmModal,
  displayForm,
  setDisplayForm,
  fetch_categories,
  apiBase,
}) {
  const customFormButtonClick = () => {
    setDisplayForm(false);
    fetch_categories();
  };

  return (
    <>
      {/* Create Category Form Overlay */}
      <div
        style={{ display: displayForm ? "block" : "none" }}
        className="fixed z-[9998] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <CreateCategoryForm
          onButtonClick={customFormButtonClick}
          onCancel={() => setDisplayForm(false)}
          apiBase={apiBase}
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
    </>
  );
}
