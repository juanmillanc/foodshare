import { useState } from "react";
import AuthLayout from "../components/AuthLayout.jsx";
import { forgotPassword } from "../api/authApi.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!email) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    try {
      setLoading(true);
      const data = await forgotPassword({ email });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Ingresa tu correo electrónico para restablecer tu contraseña."
      footerText="¿Recordaste tu contraseña?"
      footerLink="Iniciar sesión"
      footerTo="/login"
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <input
          type="email"
          name="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace de recuperación"}
        </button>
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthLayout>
  );
}
