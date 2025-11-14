import { Outlet } from "react-router-dom";
import Header from "../components/Header";

export default function Layout() {
  return (
    <>
        <header className="fixed flex h-16 justify-center w-screen">
            <Header/>
        </header>
        
      <main className="pt-15 min-h-screen w-full bg-black/5 ">
        <Outlet/>
      </main>
    </>
  );
}
