import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Header_2 from "../components/Header_2"

export default function Layout() {
  return (
    <>
        <header className="fixed flex  justify-center w-screen z-20">
            <Header_2/>
        </header>
        
      <main className=" min-h-screen w-full bg-black/5 ">
        <Outlet/>
      </main>
    </>
  );
}
