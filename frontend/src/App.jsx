import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationsPanel from './components/NotificationsPanel';
import { useAuth } from './auth/AuthContext';
import { useNotifications } from './auth/NotificationContext';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './auth/NotificationContext';
import { DemoDateProvider } from './auth/DemoDateContext';
import { PipelineProvider } from './components/shared/PipelineContext';

import OrgaLayout from './layouts/OrgaLayout.jsx';
import Login from './pages/user/Login.jsx';
import Profile from './pages/user/Profile.jsx';
import RegisterPage from './pages/user/Register.jsx';
import ProjectLayout from './layouts/ProjectLayout.jsx';
import ProjectMain, { project_loader } from './pages/general/ProjectMain.jsx';
import AllProjects from './pages/AllProjects.jsx';
import Teams from './pages/overview/Teams.jsx';
import Tasks from './pages/overview/Tasks.jsx';
import TeamDetail from './pages/detail/TeamDetail.jsx';
import TaskDetail from './pages/detail/TaskDetail.jsx';
import Calendar from './pages/general/Calender.jsx';
// import Dependencies from './pages/dependency/Dependencies'; // old implementation (kept intact)
// MilestoneScheduleAdapter now lives inside ScheduleWindow (floating window in ProjectLayout)
import AssignmentSecond from './pages/member_assignment/Assignment_Second';
import MyIdeas from './pages/user/MyIdeas';
import MobileIdeaBin from './pages/user/MobileIdeaBin';

const router = createBrowserRouter([
  {
    path: '/',
    element: <OrgaLayout />,
    children: [
      { index: true, element: <AllProjects /> },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/profile', element: <Profile /> },
      { path: '/my-ideas', element: <MyIdeas /> },
      { path: '/mobile-ideas', element: <MobileIdeaBin /> },
      {
        path: 'projects/:projectId/',
        element: <ProjectLayout />,
        children: [
          {
            index: true,
            element: <ProjectMain />,
            loader: project_loader,
          },
          { path: 'teams', element: <Teams /> },
          { path: 'teams/:teamId', element: <TeamDetail /> },
          { path: 'tasks', element: <Tasks /> },
          { path: 'tasks/:taskId', element: <TaskDetail /> },
          { path: 'dependencies', element: <></> /* ScheduleWindow auto-opens from ProjectLayout */ },
          { path: 'assignment', element: <AssignmentSecond /> },
          { path: 'calender', element: <Calendar /> },
        ],
      },
    ],
  },
]);

export default function App() {
  function AppShell() {
    const { isAuthenticated, loadingUser } = useAuth();
    const { unreadCount } = useNotifications();
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    return (
      <>
        <PipelineProvider>
          <RouterProvider router={router} />
        </PipelineProvider>
        {!loadingUser && isAuthenticated && (
          <>
            <button
              onClick={() => setNotificationsOpen(true)}
              className="md:hidden fixed right-4 bottom-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 shadow-lg border border-slate-700 hover:bg-slate-700 hover:text-white"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
          </>
        )}
      </>
    );
  }

  return (
    <AuthProvider>
      <DemoDateProvider>
        <NotificationProvider>
          <AppShell />
        </NotificationProvider>
      </DemoDateProvider>
    </AuthProvider>
  );
}
