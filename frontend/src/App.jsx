import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./layouts/MainLayout.jsx"
import Home, {comment_loader} from "./pages/Home";
import Register from "./pages/Register.jsx";
import Network, {all_user_loader} from "./pages/Network.jsx";
import Profile, {profile_loader} from "./pages/Profile.jsx";
import Login from "./pages/Login.jsx"
import Graph from "./pages/Graph.jsx";
import Graph_2 from "./pages/Graph_2/Graph_2.jsx";
import { Link } from "react-router-dom";
import Landing from "./pages/Landing.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home />, loader:  comment_loader},
      { path:"/landing", element: <Landing/>},
      { path:"/register", element: <Register/>},
      { path:"/login", element: <Login/>},
      { path:"/network", element: <Network/>, loader: all_user_loader},
      // { path:"/graph", element: <Graph/>},  
      { path:"/graph_2", element: <Graph_2/>},   
      {
    path: "/profile",
    element: <Profile />,
    loader: profile_loader,
    errorElement: <div>Please <Link to="/login">login</Link> first!</div>
}

    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
