import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './layouts/MainLayout.jsx';
import Network, { all_user_loader } from './pages/Network.jsx';
import Landing from './pages/Landing.jsx';
import GraphWrapper from './pages/Graph_Page/GraphWrapper.jsx';
import Skills, { skills_loader_function } from './pages/Skills/Skills.jsx';
import SkillsWrapper from './pages/Skills/SkillsWrapper.jsx';
import CommentWall from './pages/CommentWall.jsx';
import OrgaLayout from './orgarhythmus/org_layouts/OrgaLayout.jsx';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ProjectAttemptsWrapper from './orgarhythmus/projects/pages/ProjectAttemptsWrapper.jsx';
import ProjectLayout from './orgarhythmus/org_layouts/ProjectLayout.jsx';
import ProjectMain, { project_loader } from './orgarhythmus/projects/pages/ProjectMain.jsx';
import OrgaProjects from './orgarhythmus/pages/OrgaProjects.jsx';
import ProjectTeams from './orgarhythmus/projects/pages/ProjectTeams.jsx';
import ProjectTasks from './orgarhythmus/projects/pages/ProjectTasks.jsx';
import ProjectTeamDetail from './orgarhythmus/projects/pages/ProjectTeamDetail.jsx';
import ProjectTaskDetail from './orgarhythmus/projects/pages/ProjectTaskDetail.jsx';
import NextSteps from './orgarhythmus/projects/pages/NextSteps.jsx';
import AttemptDetail from './orgarhythmus/projects/pages/AttemptDetail.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <CommentWall /> },
      { path: '/comment_wall', element: <CommentWall /> },
      { path: '/landing', element: <Landing /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/network', element: <Network />, loader: all_user_loader },
      { path: '/graph_3', element: <GraphWrapper /> },
      { path: '/graph', element: <GraphWrapper /> },
      { path: '/skills', element: <SkillsWrapper />, loader: skills_loader_function },
    ],
  },
  // TODO When going from Projects page to one project you initially come to orgarythmus/projects/8 for example, but then if you reload to orgarythmus/projects/8/
  // TODO I dont know if this will be a problem later but could be!
  {
    path: '/orgarhythmus',
    element: <OrgaLayout />,
    children: [
      { index: true, element: <OrgaProjects /> },
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
]);

export default function App() {
  return <RouterProvider router={router} />;
}
