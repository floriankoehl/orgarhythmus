import { Outlet } from "react-router-dom";
import OrgaHeader from "../components/OrgaHeader";
import IdeaBin from "../components/ideas/IdeaBin";
import ProfileWindow from "../pages/user/ProfileWindow";

export default function OrgaLayout() {
  return (
    <>

      <header data-orga-header className=" fixed flex  items-center justify-center w-screen z-20 ">
        <OrgaHeader />
      </header>

      <main data-orga-main className="mt-15 min-h-screen   flex  justify-center items-center w-full items-stretch">
        <Outlet />
      </main>

      {/* Floating Idea Bin — persists across all pages */}
      <IdeaBin />

      {/* Floating Profile — persists across all pages */}
      <ProfileWindow />
    </>
  );
}
