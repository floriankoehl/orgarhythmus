import { UserCircle } from "lucide-react";
import WindowTitleBar from "../../components/shared/WindowTitleBar";

/**
 * ProfileTitleBar — title bar for ProfileWindow.
 */
export default function ProfileTitleBar(props) {
  return (
    <WindowTitleBar {...props} className="bg-gradient-to-r from-cyan-500 to-blue-600 border-b border-cyan-600/30">
      <UserCircle size={16} className="text-white/90 flex-shrink-0" />
      <span className="text-[12px] font-semibold text-white truncate">Profile</span>
    </WindowTitleBar>
  );
}
