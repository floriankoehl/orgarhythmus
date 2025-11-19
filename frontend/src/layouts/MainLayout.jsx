import { Outlet } from "react-router-dom";
import Header from "../components/Header";

export default function Layout() {
  return (
    <>
        <header className="fixed flex  justify-center w-screen z-20">
            <Header/>
        </header>
        
      <main className=" min-h-screen w-full bg-black/5 ">
        <Outlet/>
      </main>
    </>
  );
}
