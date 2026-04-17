import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { approveOrRejectUser, blockUser, fetchValidationsByStatus } from "../api/adminApi.js";

const STATUS_FILTERS = ["PENDIENTE", "ACTIVA", "RECHAZADA"];

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function buildDocumentUrl(path) {
  if (!path) return "";
  const normalized = String(path).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;

  // Soporta registros viejos con rutas absolutas de Windows:
  // C:/.../uploads/archivo.pdf -> /uploads/archivo.pdf
  const uploadsIndex = normalized.toLowerCase().lastIndexOf("/uploads/");
  if (uploadsIndex >= 0) {
    const publicPath = normalized.slice(uploadsIndex);
    return `http://localhost:4000${encodeURI(publicPath)}`;
  }

  // Soporta registros ya guardados como /uploads/archivo.pdf o uploads/archivo.pdf
  const publicPath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `http://localhost:4000${encodeURI(publicPath)}`;
}

export default function AdminValidationPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("PENDIENTE");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState("");
  const [actionModal, setActionModal] = useState(null);
  const [actionReason, setActionReason] = useState("");

  function showToast(type, text) {
    setToast({ type, text });
  }

  function handleLogout() {
    localStorage.removeItem("foodshare_token");
    sessionStorage.removeItem("foodshare_session_expired");
    navigate("/login");
  }

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function loadData() {
    try {
      setLoading(true);
      const payload = await fetchValidationsByStatus(statusFilter);
      setRows(payload.data || []);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  function openActionModal(type, user) {
    setActionReason("");
    setActionModal({ type, user });
  }

  function closeActionModal() {
    setActionModal(null);
    setActionReason("");
  }

  async function confirmAction() {
    if (!actionModal) return;
    const { type, user } = actionModal;
    try {
      if (type === "APPROVE") {
        await approveOrRejectUser(user.id, "ACTIVA", "Aprobado por revisión administrativa.");
        showToast("success", `Cuenta de ${user.name} aprobada correctamente.`);
      } else if (type === "REJECT") {
        if (!actionReason.trim()) {
          showToast("info", "Debes escribir un motivo para rechazar.");
          return;
        }
        await approveOrRejectUser(user.id, "RECHAZADA", actionReason.trim());
        showToast("success", `Cuenta de ${user.name} rechazada con observación.`);
      } else if (type === "BLOCK") {
        if (!actionReason.trim()) {
          showToast("info", "Debes indicar el motivo del bloqueo.");
          return;
        }
        await blockUser(user.id, actionReason.trim());
        showToast("success", `Usuario ${user.name} inhabilitado permanentemente.`);
      }

      closeActionModal();
      loadData();
    } catch (err) {
      showToast("error", err.message);
    }
  }

  function renderStatusBadge(status) {
    const colorClass =
      status === "ACTIVA" ? "status-badge status-active" : status === "RECHAZADA" ? "status-badge status-rejected" : "status-badge status-pending";
    return <span className={colorClass}>{status}</span>;
  }

  const hasData = useMemo(() => rows.length > 0, [rows]);
  const pendingCount = useMemo(() => rows.filter((item) => item.account_status === "PENDIENTE").length, [rows]);
  const activeCount = useMemo(() => rows.filter((item) => item.account_status === "ACTIVA").length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((item) => item.account_status === "RECHAZADA").length, [rows]);

  return (
    <main className="admin-page">
      <section className="admin-card">
        <header className="admin-header">
          <div>
            <h1>Validación Administrativa</h1>
            <p>Gestiona solicitudes, revisa certificados y resuelve estados de cuenta (RF11).</p>
          </div>
          <div className="admin-header-actions">
            <span className="admin-chip">Panel ADMIN</span>
            <Link className="admin-nav-link" to="/login">
              Iniciar sesión
            </Link>
            <Link className="admin-nav-link" to="/register">
              Registrarse
            </Link>
            <button type="button" className="admin-logout-btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <section className="admin-kpis">
          <article className="kpi-card">
            <span>Mostrados</span>
            <strong>{rows.length}</strong>
          </article>
          <article className="kpi-card">
            <span>Pendientes</span>
            <strong>{pendingCount}</strong>
          </article>
          <article className="kpi-card">
            <span>Activos</span>
            <strong>{activeCount}</strong>
          </article>
          <article className="kpi-card">
            <span>Rechazados</span>
            <strong>{rejectedCount}</strong>
          </article>
        </section>

        <div className="admin-toolbar">
          <div className="filter-group">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-pill ${status === statusFilter ? "active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <button type="button" className="refresh-btn" onClick={loadData}>
            Actualizar
          </button>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Fecha registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Cargando información...</td>
                </tr>
              ) : null}

              {!loading && !hasData ? (
                <tr>
                  <td colSpan={6}>No hay usuarios para el filtro seleccionado.</td>
                </tr>
              ) : null}

              {!loading &&
                rows.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{renderStatusBadge(user.account_status)}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>
                      <div className="action-group">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setSelectedDocumentUrl(buildDocumentUrl(user.legal_document_path))}
                          disabled={!user.legal_document_path}
                        >
                          Ver documento
                        </button>
                        <button type="button" className="btn-success" onClick={() => openActionModal("APPROVE", user)}>
                          Aprobar
                        </button>
                        <button type="button" className="btn-danger" onClick={() => openActionModal("REJECT", user)}>
                          Rechazar
                        </button>
                        <button type="button" className="btn-warning" onClick={() => openActionModal("BLOCK", user)}>
                          Bloqueo permanente
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDocumentUrl ? (
        <div className="doc-modal-overlay" onClick={() => setSelectedDocumentUrl("")}>
          <div className="doc-modal" onClick={(event) => event.stopPropagation()}>
            <div className="doc-modal-header">
              <strong>Certificado de salubridad</strong>
              <div className="inline-actions">
                <a className="btn-secondary btn-link" href={selectedDocumentUrl} target="_blank" rel="noreferrer">
                  Abrir en pestaña
                </a>
                <button type="button" className="btn-secondary" onClick={() => setSelectedDocumentUrl("")}>
                  Cerrar
                </button>
              </div>
            </div>
            <iframe title="Documento legal" src={selectedDocumentUrl} className="doc-iframe" />
          </div>
        </div>
      ) : null}

      {actionModal ? (
        <div className="doc-modal-overlay" onClick={closeActionModal}>
          <div className="action-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Confirmar acción</h3>
            <p>
              Usuario: <strong>{actionModal.user.name}</strong> ({actionModal.user.email})
            </p>
            <p>
              Acción:{" "}
              <strong>
                {actionModal.type === "APPROVE"
                  ? "Aprobar cuenta"
                  : actionModal.type === "REJECT"
                    ? "Rechazar cuenta"
                    : "Bloquear permanentemente"}
              </strong>
            </p>

            {actionModal.type !== "APPROVE" ? (
              <textarea
                rows={3}
                className="action-textarea"
                placeholder={actionModal.type === "REJECT" ? "Motivo del rechazo" : "Motivo del bloqueo permanente"}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
              />
            ) : null}

            <div className="inline-actions">
              <button
                type="button"
                className={
                  actionModal.type === "APPROVE"
                    ? "btn-success"
                    : actionModal.type === "REJECT"
                      ? "btn-danger"
                      : "btn-warning"
                }
                onClick={confirmAction}
              >
                Confirmar
              </button>
              <button type="button" className="btn-secondary" onClick={closeActionModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)}>
            x
          </button>
        </div>
      ) : null}
    </main>
  );
}
