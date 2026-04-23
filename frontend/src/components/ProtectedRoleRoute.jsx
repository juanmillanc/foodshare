import { Navigate } from "react-router-dom";
import { clearSessionWithExpirationFlag, decodeJwtPayload, isTokenExpired } from "../utils/authSession.js";

export default function ProtectedRoleRoute({ children, requiredRole }) {
  const token = localStorage.getItem("foodshare_token");
  if (!token) return <Navigate to="/login" replace />;

  if (isTokenExpired(token)) {
    clearSessionWithExpirationFlag();
    return <Navigate to="/login" replace />;
  }

  const payload = decodeJwtPayload(token);
  const role = String(payload?.role || "").toUpperCase();
  if (!payload || !role) return <Navigate to="/login" replace />;

  const required = String(requiredRole || "").toUpperCase();
  if (required && role !== required) return <Navigate to="/login" replace />;

  return children;
}

