import { Outlet } from "react-router-dom";
import OrgaHeader from "../org_components/OrgaHeader";

export default function OrgaLayout() {
  return (
    <>

      <header className="fixed flex  items-center justify-center w-screen z-20">
        <OrgaHeader />
      </header>

      <main className=" min-h-screen  flex  justify-center items-center w-full items-stretch ">
        <Outlet />
      </main>
    </>
  );
}
