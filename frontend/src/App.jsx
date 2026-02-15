import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationsPanel from './components/NotificationsPanel';
import { useAuth } from './auth/AuthContext';
import { useNotifications } from './auth/NotificationContext';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './auth/NotificationContext';
import { DemoDateProvider } from './auth/DemoDateContext';

// import Layout from './layouts/MainLayout.jsx';
import OrgaLayout from './layouts/OrgaLayout.jsx';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ProjectAttemptsWrapper from './pages/ProjectAttemptsWrapper.jsx';
import ProjectLayout from './layouts/ProjectLayout.jsx';
import ProjectMain, { project_loader } from './pages/ProjectMain.jsx';
import OrgaProjects from './pages/OrgaProjects.jsx';
import ProjectTeams from './pages/ProjectTeams.jsx';
import ProjectTasks from './pages/ProjectTasks.jsx';
import ProjectTeamDetail from './pages/ProjectTeamDetail.jsx';
import ProjectTaskDetail from './pages/ProjectTaskDetail.jsx';
import Calender from './pages/Calender.jsx';
import AttemptDetail from './pages/AttemptDetail.jsx';
import IdeaFactory from './pages/IdeaFactory';




const router = createBrowserRouter([
  {
    path: '/',
    element: <OrgaLayout />,
    children: [
      { index: true, element: <OrgaProjects /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/profile', element: <ProfilePage /> },
      {
        path: 'projects/:projectId/',
        element: <ProjectLayout />,
        children: [
          {
            index: true,
            element: <ProjectMain />,
            loader: project_loader,
          },
          { path: 'ideas', element: <IdeaFactory /> },
          { path: 'teams', element: <ProjectTeams /> },
          { path: 'teams/:teamId', element: <ProjectTeamDetail /> },
          { path: 'tasks', element: <ProjectTasks /> },
          { path: 'tasks/:taskId', element: <ProjectTaskDetail /> },
          { path: 'attempts', element: <ProjectAttemptsWrapper /> },
          { path: 'calender', element: <Calender /> },
          { path: 'attempts/:attemptId', element: <AttemptDetail /> },
        ],
      },
    ],
  },
  // TODO When going from Projects page to one project you initially come to orgarythmus/projects/8 for example, but then if you reload to orgarythmus/projects/8/
  // TODO I dont know if this will be a problem later but could be!
  // {
  //   path: '/orgarhythmus',
  //   element: <OrgaLayout />,
  //   children: [
      
  //     // { path: 'login', element: <LoginPage /> },
  //     // { path: 'register', element: <RegisterPage /> },
  //     // { path: 'profile', element: <ProfilePage /> },
  //     {
  //       path: 'projects/:projectId/',
  //       element: <ProjectLayout />,
  //       children: [
  //         {
  //           index: true,
  //           element: <ProjectMain />,
  //           loader: project_loader,
  //         },
  //         { path: 'teams', element: <ProjectTeams /> },
  //         { path: 'teams/:teamId', element: <ProjectTeamDetail /> },
  //         { path: 'tasks', element: <ProjectTasks /> },
  //         { path: 'tasks/:taskId', element: <ProjectTaskDetail /> },
  //         { path: 'attempts', element: <ProjectAttemptsWrapper /> },
  //         { path: 'next_steps', element: <NextSteps /> },
  //         { path: 'attempts/:attemptId', element: <AttemptDetail /> },
  //       ],
  //     },
  //   ],
  // },
]);

export default function App() {
  function AppShell() {
    const { isAuthenticated, loadingUser } = useAuth();
    const { unreadCount } = useNotifications();
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    return (
      <>
        <RouterProvider router={router} />
        {/* Mobile Floating Notifications Button (global, not in headers) */}
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
