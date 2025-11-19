import { NavLink } from "react-router-dom";
import Fab from "@mui/material/Fab";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import InterestsIcon from "@mui/icons-material/Interests";
import { useState } from "react";
import Avatar from '@mui/material/Avatar';
import LoginIcon from '@mui/icons-material/Login';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import WbIridescentIcon from '@mui/icons-material/WbIridescent';
import FlightLandIcon from '@mui/icons-material/FlightLand';

//
export default function Header() {
  const [showheader, setShowHeader] = useState(true);

  return (
    <div
      className="w-screen mb-15"
      onMouseOver={() => setShowHeader(true)}
      onMouseLeave={() => setShowHeader(true)}
    >
      {showheader && (
        <nav className="relative flex items-center justify-center gap-2 mt-2">
          {/* Home */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <HomeIcon />
              </Fab>
            )}
          </NavLink>

          {/* Landing */}
          <NavLink
            to="/landing"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <FlightLandIcon />
              </Fab>
            )}
          </NavLink>

          {/* Login */}
          <NavLink
            to="/register"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <LoginIcon />
              </Fab>
            )}
          </NavLink>

          {/* Network
          <NavLink
            to="/network"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <AcUnitIcon />
              </Fab>
            )}
          </NavLink> */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <AccountCircleIcon />
              </Fab>
            )}
          </NavLink>
          <NavLink
            to="/login"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <VpnKeyIcon />
              </Fab>
            )}
          </NavLink>
          {/* <NavLink
            to="/graph_2"
            className={({ isActive }) =>
              isActive ? "scale-110 transition-transform" : "opacity-70 hover:opacity-100"
            }
          >
            {({ isActive }) => (
              <Fab color={isActive ? "primary" : "default"} variant="extended">
                <WbIridescentIcon />
              </Fab>
            )}
          </NavLink> */}
        </nav>
      )}
    </div>
  );
}
