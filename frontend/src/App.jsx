import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import AdminValidationPage from "./pages/AdminValidationPage.jsx";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute.jsx";
import SessionWatcher from "./components/SessionWatcher.jsx";
import ProtectedRoleRoute from "./components/ProtectedRoleRoute.jsx";
import ReceiverDashboardPage from "./pages/ReceiverDashboardPage.jsx";

export default function App() {
  return (
    <>
      <SessionWatcher />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/admin/validations"
          element={
            <ProtectedAdminRoute>
              <AdminValidationPage />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="/receptor/dashboard"
          element={
            <ProtectedRoleRoute requiredRole="RECEPTOR">
              <ReceiverDashboardPage />
            </ProtectedRoleRoute>
          }
        />
      </Routes>
    </>
  );
}
