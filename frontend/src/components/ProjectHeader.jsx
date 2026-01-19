import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import ListIcon from '@mui/icons-material/List';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../auth/NotificationContext';
import NumbersIcon from '@mui/icons-material/Numbers';
import { PanelsTopLeft, Bell } from 'lucide-react';
import ScheduleIcon from '@mui/icons-material/Schedule';
import NotificationsPanel from './NotificationsPanel';

export default function ProjectHeader({}) {
  // Controls whether the mobile menu is open or closed
  const [isOpen, setIsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, isAuthenticated, loadingUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { projectId } = useParams();

  // Central definition of your nav items, so it's easy to change later
  const navItems = [
    {
      key: 'project_main',
      to: `/projects/${projectId}/`,
      label: 'Project',
      icon: <PanelsTopLeft size={16} color="white" />,
      end: true,
    },
    {
      key: 'project-teams',
      to: projectId ? `/projects/${projectId}/teams` : '/projects',
      label: 'Teams',
      icon: <Diversity3Icon className="!h-[17px] text-white" />,
    },
    {
      key: 'tasks',
      to: projectId ? `/projects/${projectId}/tasks` : '/projects',
      label: 'Tasks',
      icon: <ListIcon fontSize="small" />,
      // end: true,
    },

    {
      key: 'attempts',
      to: projectId ? `/projects/${projectId}/attempts` : '/projects', // fallback
      label: 'Attempts',
      icon: <NumbersIcon fontSize="small" />,
    },
    {
      key: 'next-steps',
      to: projectId ? `/projects/${projectId}/calender` : '/projects', // fallback
      label: 'Calender',
      icon: <ScheduleIcon fontSize="small" />,
    },
  ];

  const linkBaseClasses =
    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200';
  const getLinkClasses = (isActive) =>
    [
      linkBaseClasses,
      isActive
        ? 'bg-cyan-500/90 text-slate-900 shadow-lg scale-105'
        : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white hover:scale-105',
    ].join(' ');

  return (
    // Fixed header at the top with blur + slight border
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-700/60 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 md:py-3">
        {/* LEFT: Logo / App Title */}
        <NavLink
          to="/"
          className="flex items-center gap-3 text-slate-100 transition-colors hover:text-cyan-300"
          onClick={() => setIsOpen(false)}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-md">
            <PlayCircleIcon />
          </span>

          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-[0.15em] text-cyan-300 uppercase">
              Orgarhythmus
            </span>
            {projectId && (
              <div className="inline-flex items-center rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-200">
                Project <span className="ml-1 font-semibold">#{projectId}</span>
              </div>
            )}
          </div>

          {/* NEW: small project badge if we are inside a project */}
        </NavLink>

        {/* RIGHT: Desktop Nav */}
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
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
          ))}

          {/* SHOW REGISTER ONLY WHEN NOT LOGGED IN */}

          {!loadingUser && !isAuthenticated && (
            <div className="md:ml-3 lg:ml-10">
              <NavLink to="/login" className={({ isActive }) => getLinkClasses(isActive)}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                  <VpnKeyIcon fontSize="small" />
                </span>
                <span>Login</span>
              </NavLink>
            </div>
          )}

          {!loadingUser && isAuthenticated && (
            <div className="h-8 w-[2px] rounded-full bg-white md:ml-1 lg:ml-3"></div>
          )}

          {!loadingUser && !isAuthenticated && (
            <NavLink to="/register" className={({ isActive }) => getLinkClasses(isActive)}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                <VpnKeyIcon fontSize="small" />
              </span>
              <span>Register</span>
            </NavLink>
          )}

          {!loadingUser && isAuthenticated && (
            <div className="ml-4 flex items-center gap-3">
              {/* Notifications Bell */}
              <button
                onClick={() => setNotificationsOpen(true)}
                className="relative flex items-center justify-center h-10 w-10 rounded-full px-2 transition-all duration-200
                  bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white hover:scale-105"
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-slate-900">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NavLink
                key={user.username}
                to="/profile"
                className="flex items-center gap-2 rounded-full bg-slate-800/70 p-1 px-3 text-sm font-medium text-slate-200 transition-all duration-200 hover:scale-105 hover:bg-slate-700 hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 p-2 text-white">
                  <AccountCircleIcon />
                </span>
                <span className="font-semibold text-cyan-300">{user.username}</span>
              </NavLink>

              <button
                onClick={() => logout()}
                className="flex items-center gap-2 rounded-full bg-slate-800/70 p-1 px-3 text-sm font-medium text-slate-200 transition-all duration-200 hover:scale-105 hover:bg-slate-700 hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 p-2 text-white">
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
              className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${
                isOpen ? 'translate-y-[6px] rotate-45' : ''
              }`}
            />
            {/* Middle line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ${
                isOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            {/* Bottom line */}
            <span
              className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${
                isOpen ? '-translate-y-[6px] -rotate-45' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile Dropdown Menu (collapsible) */}
      <div
        className={`overflow-hidden transition-all duration-200 md:hidden ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="space-y-1 border-t border-slate-800/70 bg-slate-950/95 px-4 pt-2 pb-4">
          {/* MOBILE USER INFO */}

          {!loadingUser && !isAuthenticated && (
            <div className="mb-3 flex gap-4">
              <div className="w-1/2">
                <NavLink
                  to="/login"
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
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60">
                    <VpnKeyIcon fontSize="small" />
                  </span>
                  <span>Register</span>
                </NavLink>
              </div>
            </div>
          )}

          {!loadingUser && isAuthenticated && (
            <div className="flex justify-between gap-2">
              <NavLink key={user.username} to={'/profile'} onClick={() => setIsOpen(false)}>
                <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 p-2 text-white">
                      <AccountCircleIcon />
                    </span>
                    <span className="rounded bg-white px-2 py-1 text-black hover:bg-slate-800 hover:text-white">
                      {user.username}
                    </span>
                  </div>
                </div>
              </NavLink>
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 rounded-full p-1 pl-3 text-sm font-medium text-white/90 transition-all duration-200 hover:scale-105 hover:text-white"
              >
                Logout
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 p-2 text-white">
                  <LogoutIcon className="!text-[15px]" />
                </span>
              </button>
            </div>
          )}

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              // For mobile: full-width "pills"
              className={({ isActive }) =>
                [
                  'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-cyan-500/90 text-slate-900 shadow-md'
                    : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white',
                ].join(' ')
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

      {/* Notifications Panel */}
      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </header>
  );
}
