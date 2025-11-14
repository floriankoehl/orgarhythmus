import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./layouts/MainLayout.jsx"
import Home, {comment_loader} from "./pages/Home";
import Register from "./pages/Register.jsx";
import Network, {all_user_loader} from "./pages/Network.jsx";
import Profile, {profile_loader} from "./pages/Profile.jsx";
import Login from "./pages/Login.jsx"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home />, loader:  comment_loader},
      { path:"/register", element: <Register/>},
      { path:"/login", element: <Login/>},
      { path:"/network", element: <Network/>, loader: all_user_loader},   
      { path:"/profile/:id", element: <Profile/>, loader: profile_loader},

    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
