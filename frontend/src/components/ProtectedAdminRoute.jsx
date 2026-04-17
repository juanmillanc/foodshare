import { Navigate } from "react-router-dom";
import { clearSessionWithExpirationFlag, decodeJwtPayload, isTokenExpired } from "../utils/authSession.js";

export default function ProtectedAdminRoute({ children }) {
  const token = localStorage.getItem("foodshare_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isTokenExpired(token)) {
    clearSessionWithExpirationFlag();
    return <Navigate to="/login" replace />;
  }

  const payload = decodeJwtPayload(token);
  if (!payload || payload.role !== "ADMIN") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
