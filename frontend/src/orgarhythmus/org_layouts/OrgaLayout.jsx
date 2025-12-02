import { Outlet } from "react-router-dom";
import OrgaHeader from "../org_components/OrgaHeader";

export default function OrgaLayout() {
  return (
    <>

      <header className="fixed flex  justify-center w-screen z-20">
        <OrgaHeader />
      </header>

      <main className=" min-h-screen  w-full bg-black/5 ">
        <Outlet />
      </main>
    </>
  );
}
