import { LayoutDashboard } from "lucide-react";
import WindowTitleBar from "../../components/shared/WindowTitleBar";

/**
 * OverviewTitleBar — title bar for OverviewWindow.
 */
export default function OverviewTitleBar(props) {
  return (
    <WindowTitleBar {...props} className="bg-gradient-to-r from-amber-500 to-orange-600 border-b border-amber-600/30">
      <LayoutDashboard size={16} className="text-white/90 flex-shrink-0" />
      <span className="text-[12px] font-semibold text-white truncate">Overview</span>
    </WindowTitleBar>
  );
}
