import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./layouts/MainLayout.jsx"
import Home, {comment_loader} from "./pages/Home";
import Register from "./pages/Register.jsx";
import Network, {all_user_loader} from "./pages/Network.jsx";
import Profile, {profile_loader} from "./pages/Profile.jsx";
import Login from "./pages/Login.jsx"
// import Graph from "./pages/Graph.jsx";
// import Graph_2 from "./pages/Graph_2/Graph_2.jsx";
import Graph_3 from "./pages/Graph_2/Graph_3.jsx";
import { Link } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
// import GraphWrapper from "./pages/Graph_2/GraphWrapper.jsx";
// import Graph_4_Wrapper from "./pages/Graph_2/Graph_4_Wrapper.jsx";
import GraphWrapper from "./pages/Graph_Page/GraphWrapper.jsx"
import Skills, {skills_loader_function} from "./pages/Skills/Skills.jsx";
import SkillsWrapper from "./pages/Skills/SkillsWrapper.jsx";



import OrgaLayout from "./orgarhythmus/org_layouts/OrgaLayout.jsx";
import OrgaHome, {fetch_all_tasks} from "./orgarhythmus/org_pages/OrgaHome.jsx";
import OrgaAllTeams from "./orgarhythmus/org_pages/OrgaAllTeams.jsx";
import { fetch_all_teams } from "./orgarhythmus/org_API";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home />, loader:  comment_loader},
      { path:"/landing", element: <Landing/>},
      { path:"/login", element: <LoginPage/>},
      { path:"/register", element: <RegisterPage/>},
      { path:"/profile", element: <ProfilePage/>},
      // { path:"/register", element: <Register/>},
      // { path:"/login", element: <Login/>},
      { path:"/network", element: <Network/>, loader: all_user_loader},
      // { path:"/graph", element: <Graph/>},  
      // { path:"/graph_2", element: <Graph_2/>},   
      { path:"/graph_3", element: <GraphWrapper/>},  
      { path:"/graph", element: <GraphWrapper/>},  
      { path: "/skills", element: <SkillsWrapper />, loader: skills_loader_function },
      {
        path: "/profile",
        element: <Profile />,
        loader: profile_loader,
        errorElement: <div>Please <Link to="/login">login</Link> first!</div>
      }

    ],
    },
    {
    path: "/orgarhythmus",
    element: <OrgaLayout />,
    children: [
      { index: true, element: <OrgaHome />, loader: fetch_all_tasks },
      { path:"all_teams", element: <OrgaAllTeams/>, loader: fetch_all_teams},  
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
