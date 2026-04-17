import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearSessionWithExpirationFlag, isTokenExpired } from "../utils/authSession.js";

export default function SessionWatcher() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkExpiration = () => {
      const token = localStorage.getItem("foodshare_token");
      if (!token) return;

      if (isTokenExpired(token)) {
        clearSessionWithExpirationFlag();
        navigate("/login", { replace: true });
      }
    };

    checkExpiration();
    const intervalId = window.setInterval(checkExpiration, 30000);
    return () => window.clearInterval(intervalId);
  }, [location.pathname, navigate]);

  return null;
}
