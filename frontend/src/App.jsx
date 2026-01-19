import { createBrowserRouter, RouterProvider } from 'react-router-dom';

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
import NextSteps from './pages/NextSteps.jsx';
import AttemptDetail from './pages/AttemptDetail.jsx';



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
          { path: 'teams', element: <ProjectTeams /> },
          { path: 'teams/:teamId', element: <ProjectTeamDetail /> },
          { path: 'tasks', element: <ProjectTasks /> },
          { path: 'tasks/:taskId', element: <ProjectTaskDetail /> },
          { path: 'attempts', element: <ProjectAttemptsWrapper /> },
          { path: 'next_steps', element: <NextSteps /> },
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
  return <RouterProvider router={router} />;
}
