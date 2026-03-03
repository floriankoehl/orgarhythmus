import { Outlet, useLocation } from "react-router-dom";
import OrgaHeader from "../components/OrgaHeader";
import IdeaBin from "../components/ideas/IdeaBin";
import ProfileWindow from "../pages/user/ProfileWindow";
import NotificationsWindow from "../components/NotificationsWindow";

export default function OrgaLayout() {
  const location = useLocation();

  // When inside a project, the ProjectLayout's WindowManager takes over
  // all floating windows (including IdeaBin, Profile, Notifications).
  const insideProject = /\/projects\/\d+/.test(location.pathname);

  return (
    <>
      {/* Hide the header when inside a project — ProjectLayout handles navigation */}
      {!insideProject && (
        <header data-orga-header className="fixed flex items-center justify-center w-screen z-20">
          <OrgaHeader />
        </header>
      )}

      <main
        data-orga-main
        className={`min-h-screen flex justify-center items-center w-full items-stretch ${
          insideProject ? '' : 'mt-15'
        }`}
      >
        <Outlet />
      </main>

      {/* Floating windows — only when NOT inside a project (project has its own manager) */}
      {!insideProject && (
        <>
          <IdeaBin />
          <ProfileWindow />
          <NotificationsWindow />
        </>
      )}
    </>
  );
}
