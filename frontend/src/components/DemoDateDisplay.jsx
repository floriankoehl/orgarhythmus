import { useState, useRef, useEffect } from 'react';
import { useDemoDate } from '../auth/DemoDateContext';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';

export default function DemoDateDisplay() {
  const { demoDate, addDays, subtractDays, resetToToday } = useDemoDate();
  const [showControls, setShowControls] = useState(false);
  const containerRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowControls(false);
      }
    }

    if (showControls) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showControls]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Click to open Demo Date Badge */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 border border-amber-300 hover:bg-amber-200 transition cursor-pointer"
      >
        <span className="text-xs font-semibold text-amber-900">{demoDate.format('D.M')}</span>
      </button>

      {/* Popup Controls */}
      {showControls && (
        <div className="absolute top-full right-0 mt-2 z-50 rounded-lg bg-white border border-slate-200 shadow-lg p-3 whitespace-nowrap">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-700">Simulate Date</span>
              <button
                onClick={() => setShowControls(false)}
                className="flex items-center justify-center h-5 w-5 rounded hover:bg-slate-100 transition"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => subtractDays(1)}
                className="flex items-center justify-center h-7 w-7 rounded border border-slate-300 bg-white hover:bg-slate-50 transition"
                title="Previous day"
              >
                <ChevronLeft size={14} className="text-slate-700" />
              </button>
              <button
                onClick={() => subtractDays(7)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 transition px-2 py-1 rounded hover:bg-slate-50"
                title="Previous week"
              >
                -1w
              </button>
              <button
                onClick={resetToToday}
                className="flex items-center justify-center h-7 w-7 rounded border border-slate-300 bg-white hover:bg-slate-50 transition"
                title="Reset to today"
              >
                <RotateCcw size={14} className="text-slate-700" />
              </button>
              <button
                onClick={() => addDays(7)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 transition px-2 py-1 rounded hover:bg-slate-50"
                title="Next week"
              >
                +1w
              </button>
              <button
                onClick={() => addDays(1)}
                className="flex items-center justify-center h-7 w-7 rounded border border-slate-300 bg-white hover:bg-slate-50 transition"
                title="Next day"
              >
                <ChevronRight size={14} className="text-slate-700" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
