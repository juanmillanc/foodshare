import { useEffect, useMemo, useState } from "react";
import { fetchReceiverDonationCategories, searchReceiverDonations } from "../api/receiverApi.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

function normalizePhotos(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatKm(meters) {
  if (meters == null) return "—";
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function formatRemaining(expiresAt) {
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return "Vencido";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours <= 0) return `${mins} min`;
  return `${hours} h ${mins} min`;
}

export default function ReceiverDashboardPage() {
  const [geo, setGeo] = useState({ lat: null, lng: null, status: "idle", error: "" });
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: "",
    radius_km: 5,
    max_hours_remaining: 72
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canSearch = useMemo(() => geo.lat != null && geo.lng != null, [geo.lat, geo.lng]);

  useEffect(() => {
    let mounted = true;
    fetchReceiverDonationCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => {
        // categories es opcional; seguimos con lista vacía.
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ lat: null, lng: null, status: "error", error: "Tu navegador no soporta geolocalización." });
      return;
    }

    setGeo((g) => ({ ...g, status: "loading", error: "" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, status: "ok", error: "" });
      },
      (err) => {
        const msg =
          err?.code === 1
            ? "Permiso denegado. Activa la ubicación para buscar donaciones cercanas."
            : "No fue posible obtener tu ubicación.";
        setGeo({ lat: null, lng: null, status: "error", error: msg });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const runSearch = async (override = {}) => {
    setError("");
    setResult(null);
    if (!canSearch) return;

    try {
      setLoading(true);
      const data = await searchReceiverDonations({
        ...filters,
        ...override,
        receptor_lat: geo.lat,
        receptor_lng: geo.lng
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  const suggestion =
    result && Array.isArray(result.data) && result.data.length === 0 ? result.suggested_radius_km : null;

  return (
    <main className="receiver-page">
      <section className="receiver-card">
        <header className="receiver-header">
          <div>
            <h1>Dashboard Receptor</h1>
            <p>
              Búsqueda inteligente (RF-04): encuentra donaciones activas por categoría, distancia y tiempo restante
              hasta el vencimiento.
            </p>
          </div>
          <span className="admin-chip">RF-04</span>
        </header>

        <div className="receiver-body">
          <div className="receiver-alerts">
            {geo.status === "loading" ? <div className="toast toast-info">Obteniendo ubicación…</div> : null}
            {geo.status === "error" ? <div className="toast toast-error">{geo.error}</div> : null}
          </div>

          <form className="receiver-filters" onSubmit={onSubmit}>
            <div className="receiver-grid">
              <label>
                <span>Categoría</span>
                <select name="category" value={filters.category} onChange={onFilterChange}>
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Radio (km)</span>
                <select name="radius_km" value={filters.radius_km} onChange={onFilterChange}>
                  {[1, 3, 5, 10, 15, 25, 50].map((v) => (
                    <option key={v} value={v}>
                      {v} km
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Máx. horas restantes</span>
                <select
                  name="max_hours_remaining"
                  value={filters.max_hours_remaining}
                  onChange={onFilterChange}
                >
                  {[6, 12, 24, 48, 72, 120, 168].map((v) => (
                    <option key={v} value={v}>
                      {v} h
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="receiver-actions">
              <button type="submit" className="receiver-primary" disabled={loading || !canSearch}>
                {loading ? "Buscando…" : "Buscar donaciones"}
              </button>
              {suggestion ? (
                <button
                  type="button"
                  className="receiver-secondary"
                  disabled={loading || !canSearch}
                  onClick={() => runSearch({ radius_km: suggestion })}
                >
                  Ampliar a {suggestion} km
                </button>
              ) : null}
            </div>

            {error ? <p className="error">{error}</p> : null}
          </form>

          <section className="receiver-results">
            {result ? (
              <>
                <div className="receiver-results-header">
                  <strong>
                    Resultados: {result.within_radius} dentro de {result.used_radius_km} km
                  </strong>
                  <span className="receiver-muted">
                    {result.distance_source === "google_maps"
                      ? "Distancia: Google Maps"
                      : "Distancia: aproximada (fallback)"}
                  </span>
                </div>

                {Array.isArray(result.data) && result.data.length > 0 ? (
                  <div className="donation-grid">
                    {result.data.map((d) => {
                      const photos = normalizePhotos(d.photos);
                      const thumb = photos[0];
                      return (
                      <article key={d.id} className="donation-card">
                        <div className="donation-top">
                          <div>
                            <h3>{d.title}</h3>
                            <p className="receiver-muted">
                              {d.category} · {formatKm(d.distance_meters)} · vence en {formatRemaining(d.expires_at)}
                            </p>
                          </div>
                          <span className="donation-badge">Activa</span>
                        </div>

                        {thumb ? (
                          <div className="donation-thumb-wrap">
                            <img className="donation-thumb" src={`${API_BASE}${thumb}`} alt="" loading="lazy" />
                          </div>
                        ) : null}

                        {d.description ? <p className="donation-desc">{d.description}</p> : null}

                        <div className="donation-meta">
                          <div>
                            <span className="receiver-muted">Donante</span>
                            <strong>{d.donor_name || "—"}</strong>
                          </div>
                          <div>
                            <span className="receiver-muted">Cantidad</span>
                            <strong>
                              {d.quantity != null ? d.quantity : "—"} {d.unit || ""}
                            </strong>
                          </div>
                          {d.prepared_at ? (
                            <div className="donation-meta-wide">
                              <span className="receiver-muted">Preparación</span>
                              <strong>{new Date(d.prepared_at).toLocaleString()}</strong>
                            </div>
                          ) : null}
                        </div>

                        {d.pickup_address ? (
                          <div className="donation-address">
                            <span className="receiver-muted">Dirección</span>
                            <div>{d.pickup_address}</div>
                          </div>
                        ) : null}
                      </article>
                    );
                    })}
                  </div>
                ) : (
                  <div className="receiver-empty">
                    <h3>No hay donaciones en el radio seleccionado.</h3>
                    <p className="receiver-muted">
                      Prueba ampliando el rango de búsqueda{suggestion ? ` (sugerido: ${suggestion} km)` : ""}.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="receiver-empty">
                <h3>Listo para buscar</h3>
                <p className="receiver-muted">
                  Selecciona los filtros y pulsa “Buscar donaciones”. Necesitamos tu ubicación para calcular distancias.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

