import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './auth/NotificationContext';
import { DemoDateProvider } from './auth/DemoDateContext';

import OrgaLayout from './layouts/OrgaLayout.jsx';
import Login from './pages/user/Login.jsx';
// Profile page replaced by ProfileWindow (floating window in OrgaLayout)
// import Profile from './pages/user/Profile.jsx';
import RegisterPage from './pages/user/Register.jsx';
import ProjectLayout from './layouts/ProjectLayout.jsx';
// ProjectMain replaced by OverviewWindow (floating window in ProjectLayout)
// import ProjectMain, { project_loader } from './pages/general/ProjectMain.jsx';
import AllProjects from './pages/AllProjects.jsx';
// Teams, Tasks, TeamDetail, TaskDetail pages replaced by tabs inside TaskStructure window
// import Teams from './pages/overview/Teams.jsx';
// import Tasks from './pages/overview/Tasks.jsx';
// import TeamDetail from './pages/detail/TeamDetail.jsx';
// import TaskDetail from './pages/detail/TaskDetail.jsx';
// Calendar page replaced by CalendarWindow (floating window in ProjectLayout)
// import Calendar from './pages/general/Calender.jsx';
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
      { path: '/profile', element: <></> /* ProfileWindow auto-opens from OrgaLayout */ },
      { path: '/my-ideas', element: <MyIdeas /> },
      { path: '/mobile-ideas', element: <MobileIdeaBin /> },
      {
        path: 'projects/:projectId/',
        element: <ProjectLayout />,
        children: [
          {
            index: true,
            element: <></>, /* Lands in OrbitMode (all windows collapsed) */
          },
          { path: 'teams', element: <></> /* TaskStructure auto-opens Teams tab */ },
          { path: 'teams/:teamId', element: <></> /* TaskStructure auto-opens Team detail */ },
          { path: 'tasks', element: <></> /* TaskStructure auto-opens Tasks tab */ },
          { path: 'tasks/:taskId', element: <></> /* TaskStructure auto-opens Task detail */ },
          { path: 'dependencies', element: <></> /* ScheduleWindow auto-opens from ProjectLayout */ },
          { path: 'assignment', element: <AssignmentSecond /> },
          { path: 'calender', element: <></> /* CalendarWindow auto-opens from ProjectLayout */ },
        ],
      },
    ],
  },
]);

export default function App() {
  function AppShell() {
    const { isAuthenticated, loadingUser } = useAuth();

    return (
      <>
        <RouterProvider router={router} />
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
