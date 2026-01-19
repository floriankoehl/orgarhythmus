import { useState } from "react";
import { NavLink } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from "../../auth/AuthContext";
import ReplayIcon from '@mui/icons-material/Replay';
import { Folder } from 'lucide-react';


export default function OrgaHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, loadingUser, logout } = useAuth();




  const linkBaseClasses =
    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200";
  const getLinkClasses = (isActive) =>
    [
      linkBaseClasses,
      isActive
        ? "bg-cyan-500/90 text-slate-900 shadow-lg scale-105"
        : "bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white hover:scale-105",
    ].join(" ");



  return (
    // Fixed header at the top with blur + slight border
    <header className="fixed inset-x-0 top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-700/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 md:py-3">
        {/* LEFT: Logo / App Title */}
        <NavLink
          to="/"
          className="flex items-center gap-2 text-slate-100 hover:text-cyan-300 transition-colors"
          onClick={() => setIsOpen(false)} // close menu if on mobile
        >
          {/* Tiny "logo dot" */}
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-md">
            <PlayCircleIcon />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-300">
              Orgarhythmus
            </span>
            <span className="text-xs text-slate-300/80">
              Algorhythmus der Organisation
            </span>
          </div>
        </NavLink>

        {/* RIGHT: Desktop Nav */}
        <nav className="hidden items-center gap-2 md:flex">
          {/* {navItems.map((item) => (

            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => getLinkClasses(isActive)}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))} */}

          {/* SHOW REGISTER ONLY WHEN NOT LOGGED IN */}

          {!loadingUser && !isAuthenticated && (
            <div className="lg:ml-10 md:ml-3">
              <NavLink
                to="/login"
                className={({ isActive }) => getLinkClasses(isActive)}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                  <VpnKeyIcon fontSize="small" />
                </span>
                <span>Login</span>
              </NavLink>
            </div>
          )}

          {!loadingUser && isAuthenticated && (
            <div className="w-[2px] rounded-full h-8 bg-white lg:ml-3 md:ml-1"></div>
          )}

          {!loadingUser && !isAuthenticated && (
            <NavLink
              to="/register"
              className={({ isActive }) => getLinkClasses(isActive)}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                <VpnKeyIcon fontSize="small" />
              </span>
              <span>Register</span>
            </NavLink>
          )}

          {!loadingUser && isAuthenticated && (
            <div className="flex items-center gap-3 ml-4">

              <NavLink
                key={user.username}
                to="/profile"
                className="
      flex items-center gap-2 rounded-full px-3 p-1 text-sm font-medium transition-all duration-200
      bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white hover:scale-105"
              >
                <span className="flex p-2 h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 text-white">
                  <AccountCircleIcon />
                </span>
                <span className="font-semibold text-cyan-300">{user.username}</span>
              </NavLink>

              <button
                onClick={() => logout()}
                className="
      flex items-center gap-2 rounded-full px-3 p-1 text-sm font-medium transition-all duration-200
                            bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white hover:scale-105"
              >
                <span className="flex p-2 h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 text-white">
                  <LogoutIcon />
                </span>
                Logout
              </button>

            </div>
          )}

        </nav>


        {/* RIGHT: Mobile Burger Button (shown only on small screens) */}
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/80 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 md:hidden"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          {/* Simple burger / close icon made with Tailwind, no external icon needed */}
          <span className="sr-only">Open main menu</span>
          <div className="space-y-1.5">
            {/* Top line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${isOpen ? "translate-y-[6px] rotate-45" : ""
                }`}
            />
            {/* Middle line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ${isOpen ? "opacity-0" : "opacity-100"
                }`}
            />
            {/* Bottom line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${isOpen ? "-translate-y-[6px] -rotate-45" : ""
                }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile Dropdown Menu (collapsible) */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ${isOpen
          ? "max-h-96 opacity-100"
          : "max-h-0 opacity-0"
          }`}
      >


        <nav className="space-y-1 border-t border-slate-800/70 bg-slate-950/95 px-4 pb-4 pt-2">
          {/* MOBILE USER INFO */}

          {!loadingUser && !isAuthenticated && (
            <div className="flex mb-3 gap-4">
              <div className="w-1/2">
                <NavLink
                  to="/orgarhythmus/login"
                  className={({ isActive }) => getLinkClasses(isActive)}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                    <VpnKeyIcon fontSize="small" />
                  </span>
                  <span>Login</span>
                </NavLink>
              </div>
              <div className="w-1/2">
                <NavLink
                  to="/register"
                  className={({ isActive }) => getLinkClasses(isActive)}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="flex h-6 w-6 items-center 
                  justify-center rounded-full bg-slate-900/60">
                    <VpnKeyIcon fontSize="small" />
                  </span>
                  <span>Register</span>
                </NavLink>
              </div>

            </div>

          )}








          {!loadingUser && isAuthenticated && (


            <div className="flex justify-between gap-2">
              <NavLink key={user.username}
                to={"/profile"}
                onClick={() => setIsOpen(false)}
              >



                <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all">
                  <div className="flex items-center gap-3 ">
                    <span className="flex p-2 h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 text-white">
                      <AccountCircleIcon />
                    </span>
                    <span className="
                text-black hover:bg-slate-800 hover:text-white bg-white px-2 py-1 rounded
                ">{user.username}</span>
                  </div>
                </div>
              </NavLink>
              <button
                onClick={() => logout()}
                className="
      flex items-center text-white/90 gap-2 rounded-full pl-3 p-1 text-sm font-medium transition-all duration-200
     hover:text-white hover:scale-105"
              >Logout
                <span className="flex p-2 h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 text-white">
                  <LogoutIcon className="!text-[15px]" />
                </span>

              </button>
            </div>
          )}







        </nav>
      </div>
    </header>
  );
}
