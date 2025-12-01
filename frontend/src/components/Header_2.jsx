// Header.jsx
// A responsive, collapsible (burger) navigation header
// - Uses TailwindCSS for layout & styling
// - Uses react-router NavLink for routing
// - Uses MUI icons for the menu items

import { useState } from "react";
import { NavLink } from "react-router-dom";

// MUI Icons
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LoginIcon from "@mui/icons-material/Login";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import WbIridescentIcon from "@mui/icons-material/WbIridescent";
import FlightLandIcon from "@mui/icons-material/FlightLand";

export default function Header() {
  // Controls whether the mobile menu is open or closed
  const [isOpen, setIsOpen] = useState(false);

  // Central definition of your nav items, so it's easy to change later
  const navItems = [
    { to: "/", label: "Home", icon: <HomeIcon fontSize="small" /> },
    { to: "/landing", label: "Landing", icon: <FlightLandIcon fontSize="small" /> },
    { to: "/register", label: "Register", icon: <LoginIcon fontSize="small" /> },
    { to: "/profile", label: "Profile", icon: <AccountCircleIcon fontSize="small" /> },
    { to: "/login", label: "Login", icon: <VpnKeyIcon fontSize="small" /> },
    { to: "/graph_3", label: "Graph 3", icon: <WbIridescentIcon fontSize="small" /> },
    { to: "/graph_4", label: "Graph 4", icon: <WbIridescentIcon fontSize="small" /> },
  ];

  // Helper function to generate Tailwind classes depending on active state
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
            <span className="h-3 w-3 rounded-full bg-slate-950/80" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-300">
              Network
            </span>
            <span className="text-xs text-slate-300/80">
              map your connections
            </span>
          </div>
        </NavLink>

        {/* RIGHT: Desktop Nav */}
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => getLinkClasses(isActive)}
            >
              {/* Icon */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                {item.icon}
              </span>
              {/* Label */}
              <span>{item.label}</span>
            </NavLink>
          ))}
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
              className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${
                isOpen ? "translate-y-[6px] rotate-45" : ""
              }`}
            />
            {/* Middle line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ${
                isOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            {/* Bottom line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${
                isOpen ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile Dropdown Menu (collapsible) */}
      <div
        className={`md:hidden transform origin-top transition-all duration-200 ${
          isOpen
            ? "scale-y-100 opacity-100"
            : "pointer-events-none scale-y-95 opacity-0"
        }`}
      >
        <nav className="space-y-1 border-t border-slate-800/70 bg-slate-950/95 px-4 pb-4 pt-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              // For mobile: full-width "pills"
              className={({ isActive }) =>
                [
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-cyan-500/90 text-slate-900 shadow-md"
                    : "bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white",
                ].join(" ")
              }
              onClick={() => setIsOpen(false)} // close menu after navigation
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {/* Tiny accent dot to the right */}
              <span className="h-2 w-2 rounded-full bg-cyan-400/90" />
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
