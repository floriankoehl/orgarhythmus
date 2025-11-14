import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./layouts/MainLayout.jsx"
import Home from "./pages/Home";
import Login from "./pages/Login.jsx";
import Network, {all_user_loader} from "./pages/Network.jsx";
import Profile, {profile_loader} from "./pages/Profile.jsx";


const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path:"/login", element: <Login/>},
      { path:"/network", element: <Network/>, loader: all_user_loader},   
      { path:"/profile/:id", element: <Profile/>, loader: profile_loader},

    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
