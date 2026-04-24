import { useMemo, useState } from "react";
import AuthLayout from "../components/AuthLayout.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { registerUser } from "../api/authApi.js";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "DONANTE",
    legalDocument: null
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fileLabel = useMemo(() => (form.legalDocument ? form.legalDocument.name : "Adjuntar archivo PDF"), [form]);

  const onChange = (event) => {
    const { name, value, files } = event.target;
    if (name === "legalDocument") {
      setForm((prev) => ({ ...prev, legalDocument: files?.[0] || null }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.name || !form.email || !form.password || !form.role) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    if (form.role === "DONANTE" && !form.legalDocument) {
      setError("Como Donante debes adjuntar la certificación sanitaria (PDF).");
      return;
    }

    if (form.legalDocument && form.legalDocument.type !== "application/pdf") {
      setError("El archivo debe ser PDF.");
      return;
    }

    try {
      setLoading(true);
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("email", form.email);
      payload.append("password", form.password);
      payload.append("role", form.role);
      if (form.legalDocument) {
        payload.append("legalDocument", form.legalDocument);
      }

      const response = await registerUser(payload);
      setMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Crear una cuenta"
      subtitle=""
      footerText="¿Ya tienes cuenta?"
      footerLink="Iniciar sesión"
      footerTo="/login"
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <input type="text" name="name" placeholder="Nombre completo" onChange={onChange} value={form.name} />
        <input type="email" name="email" placeholder="Correo electrónico" onChange={onChange} value={form.email} />
        <PasswordField
          name="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={onChange}
          autoComplete="new-password"
        />

        <label>Registrarse como:</label>
        <div className="role-switch">
          <button
            type="button"
            className={form.role === "DONANTE" ? "active" : ""}
            onClick={() => setForm((prev) => ({ ...prev, role: "DONANTE" }))}
          >
            Donante
          </button>
          <button
            type="button"
            className={form.role === "RECEPTOR" ? "active" : ""}
            onClick={() => setForm((prev) => ({ ...prev, role: "RECEPTOR" }))}
          >
            Receptor
          </button>
        </div>

        {form.role === "DONANTE" ? (
          <div className="file-box">
            <label htmlFor="legalDocument" className="file-label">
              {fileLabel}
            </label>
            <input id="legalDocument" type="file" name="legalDocument" accept="application/pdf" onChange={onChange} />
            <small>Formatos permitidos: PDF</small>
          </div>
        ) : null}

        <button type="submit" disabled={loading}>
          {loading ? "Registrando..." : "Registrarse"}
        </button>
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </AuthLayout>
  );
}
