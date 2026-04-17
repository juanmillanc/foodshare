import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { resetPassword } from "../api/authApi.js";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("Token inválido. Solicita un nuevo enlace de recuperación.");
      return;
    }
    if (!password) {
      setError("Ingresa una nueva contraseña.");
      return;
    }

    try {
      setLoading(true);
      const data = await resetPassword({ token, newPassword: password });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Restablecer contraseña"
      subtitle="Ingresa tu nueva contraseña para continuar."
      footerText="¿Recordaste tu contraseña?"
      footerLink="Iniciar sesión"
      footerTo="/login"
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <input
          type="password"
          name="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </button>
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthLayout>
  );
}
