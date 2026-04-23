import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { loginUser } from "../api/authApi.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const expired = sessionStorage.getItem("foodshare_session_expired");
    if (expired === "1") {
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
      sessionStorage.removeItem("foodshare_session_expired");
    }
  }, []);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.email || !form.password) {
      setError("Completa correo y contraseña.");
      return;
    }

    try {
      setLoading(true);
      const data = await loginUser(form);
      localStorage.setItem("foodshare_token", data.token);
      setMessage("Inicio de sesión exitoso.");
      const role = String(data.user?.role || "").toUpperCase();
      const nextPath =
        role === "ADMIN" ? "/admin/validations" : role === "RECEPTOR" ? "/receptor/dashboard" : "/login";
      setTimeout(() => navigate(nextPath), 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="¡Bienvenido de nuevo!"
      subtitle="Ingresa tu correo electrónico para restablecer tu contraseña."
      footerText="¿No tienes cuenta?"
      footerLink="Regístrate"
      footerTo="/register"
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <input type="email" name="email" placeholder="Correo electrónico" onChange={onChange} value={form.email} />
        <input type="password" name="password" placeholder="Contraseña" onChange={onChange} value={form.password} />
        <div className="helper-row">
          <span />
          <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthLayout>
  );
}
