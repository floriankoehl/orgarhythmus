import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Copy, Download, Check } from "lucide-react";

/**
 * Modal that shows the category JSON for copying or downloading.
 *
 * Props:
 *   json               – the JSON object to display  { category_name, ideas }
 *   onClose            – close callback
 *   buildClipboardText – (scenarioKey, jsonString) => string | null
 */
export default function IdeaBinCategoryExportModal({ json, onClose, buildClipboardText }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);

  const jsonString = JSON.stringify(json, null, 2);

  // Auto-select all text on mount
  useEffect(() => {
    textRef.current?.focus();
    textRef.current?.select();
  }, []);

  const handleCopy = useCallback(async () => {
    const text = buildClipboardText
      ? buildClipboardText('ideabin_single_category', jsonString)
      : jsonString;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select + execCommand
      textRef.current?.select();
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [jsonString, buildClipboardText]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeName = (json.category_name || "category").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `category_${safeName}_${ts}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [jsonString, json.category_name]);

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 z-[9998] rounded-b-lg" onClick={onClose} />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[9999] flex flex-col"
           style={{ width: "min(520px, 90%)", maxHeight: "80%" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">
            Export Category — {json.category_name}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pt-3">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-white transition ${
              copied ? "bg-green-500" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            <Download size={12} />
            Save as File
          </button>
        </div>

        {/* JSON display */}
        <div className="flex-1 overflow-auto px-4 py-3">
          <textarea
            ref={textRef}
            readOnly
            value={jsonString}
            className="w-full h-full min-h-[200px] font-mono text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
            onFocus={(e) => e.target.select()}
          />
        </div>

        {/* Footer hint */}
        <div className="px-4 pb-3 text-[10px] text-gray-400">
          Tip: Copy this JSON, refine it with an AI, then import it back as a new category.
        </div>
      </div>
    </>
  );
}
