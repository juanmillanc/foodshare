import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { publishDonorDonation } from "../api/donorApi.js";

function toDatetimeLocalValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DonorPublishExcessPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [geo, setGeo] = useState({ lat: null, lng: null, status: "idle", error: "" });
  const [form, setForm] = useState({
    food_type: "",
    quantity: "",
    unit: "KG",
    prepared_at: "",
    expires_at: "",
    pickup_address: "",
    pickup_lat: "",
    pickup_lng: ""
  });
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const coordsValid = useMemo(() => {
    const lat = Number(String(form.pickup_lat).replace(",", "."));
    const lng = Number(String(form.pickup_lng).replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
  }, [form.pickup_lat, form.pickup_lng]);

  const requestGeolocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ lat: null, lng: null, status: "error", error: "Tu navegador no soporta geolocalización." });
      return;
    }
    setGeo((g) => ({ ...g, status: "loading", error: "" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeo({ lat, lng, status: "ok", error: "" });
        setForm((prev) => ({
          ...prev,
          pickup_lat: lat.toFixed(6),
          pickup_lng: lng.toFixed(6)
        }));
      },
      (err) => {
        const msg =
          err?.code === 1
            ? "Permiso de ubicación denegado. Puedes escribir latitud y longitud a mano."
            : "No fue posible obtener tu ubicación. Introduce las coordenadas manualmente.";
        setGeo({ lat: null, lng: null, status: "error", error: msg });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  useEffect(() => {
    requestGeolocation();
  }, [requestGeolocation]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photos]);

  const onFieldChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onPickPhotos = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setPhotos((prev) => [...prev, ...list].slice(0, 12));
    e.target.value = "";
  };

  const removePhotoAt = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const onLogout = () => {
    localStorage.removeItem("foodshare_token");
    navigate("/login", { replace: true });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.food_type.trim()) {
      setError("Indica el tipo de alimento.");
      return;
    }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }
    if (!form.prepared_at || !form.expires_at) {
      setError("Completa las fechas de preparación y vencimiento.");
      return;
    }
    const prepared = new Date(form.prepared_at);
    const expires = new Date(form.expires_at);
    if (Number.isNaN(expires.getTime())) {
      setError("La fecha de vencimiento no es válida.");
      return;
    }
    if (expires.getTime() <= Date.now()) {
      setError("La fecha de vencimiento debe ser posterior a la hora actual.");
      return;
    }
    if (Number.isNaN(prepared.getTime())) {
      setError("La fecha de preparación no es válida.");
      return;
    }
    if (!form.pickup_address.trim()) {
      setError("Indica la dirección de retiro.");
      return;
    }
    if (photos.length < 1) {
      setError("Debes adjuntar al menos una fotografía.");
      return;
    }
    if (!coordsValid) {
      setError("Indica latitud y longitud válidas (latitud −90…90, longitud −180…180).");
      return;
    }

    const latN = Number(String(form.pickup_lat).replace(",", "."));
    const lngN = Number(String(form.pickup_lng).replace(",", "."));

    const fd = new FormData();
    fd.append("food_type", form.food_type.trim());
    fd.append("quantity", String(qty));
    fd.append("unit", form.unit);
    fd.append("prepared_at", prepared.toISOString());
    fd.append("expires_at", expires.toISOString());
    fd.append("pickup_address", form.pickup_address.trim());
    fd.append("pickup_lat", String(latN));
    fd.append("pickup_lng", String(lngN));
    photos.forEach((file) => fd.append("photos", file));

    try {
      setLoading(true);
      const data = await publishDonorDonation(fd);
      setMessage(data.message || "Publicación exitosa.");
      setForm({
        food_type: "",
        quantity: "",
        unit: "KG",
        prepared_at: "",
        expires_at: "",
        pickup_address: "",
        pickup_lat: "",
        pickup_lng: ""
      });
      setPhotos([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="donor-publish-page">
      <div className="donor-publish-shell">
        <header className="donor-publish-header">
          <div>
            <p className="donor-publish-kicker">RF-03 · Donante</p>
            <h1>Publicar excedente</h1>
            <p className="donor-publish-lead">
              Formulario optimizado para móvil: describe el alimento, fechas y sube fotos claras del lote disponible.
            </p>
          </div>
          <button type="button" className="donor-publish-logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        </header>

        <form className="donor-publish-form" onSubmit={onSubmit}>
          <section className="donor-publish-section">
            <h2>1. Alimento</h2>
            <label className="donor-field">
              <span>Tipo de alimento</span>
              <input
                name="food_type"
                value={form.food_type}
                onChange={onFieldChange}
                placeholder="Ej. panadería, frutas, comida preparada…"
                autoComplete="off"
                inputMode="text"
              />
            </label>
            <div className="donor-field-row">
              <label className="donor-field donor-field-grow">
                <span>Cantidad</span>
                <input
                  name="quantity"
                  value={form.quantity}
                  onChange={onFieldChange}
                  placeholder="Ej. 12"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </label>
              <label className="donor-field donor-field-unit">
                <span>Unidad</span>
                <select name="unit" value={form.unit} onChange={onFieldChange}>
                  <option value="KG">Kilogramos (kg)</option>
                  <option value="UNIDADES">Unidades</option>
                </select>
              </label>
            </div>
          </section>

          <section className="donor-publish-section">
            <h2>2. Fechas</h2>
            <label className="donor-field">
              <span>Fecha y hora de preparación</span>
              <input type="datetime-local" name="prepared_at" value={form.prepared_at} onChange={onFieldChange} />
            </label>
            <label className="donor-field">
              <span>Fecha y hora de vencimiento</span>
              <input
                type="datetime-local"
                name="expires_at"
                value={form.expires_at}
                onChange={onFieldChange}
                min={toDatetimeLocalValue(new Date(Date.now() + 60 * 1000))}
              />
            </label>
            <p className="donor-hint">No se publica si el vencimiento no es estrictamente posterior a ahora.</p>
          </section>

          <section className="donor-publish-section">
            <h2>3. Retiro</h2>
            {geo.status === "loading" ? <p className="donor-hint">Obteniendo ubicación…</p> : null}
            {geo.status === "error" ? <p className="error donor-inline-error">{geo.error}</p> : null}
            {geo.status === "ok" ? (
              <p className="donor-hint">Ubicación capturada. Ajusta la dirección para que el receptor llegue sin dudas.</p>
            ) : null}
            <label className="donor-field">
              <span>Dirección de retiro</span>
              <input
                name="pickup_address"
                value={form.pickup_address}
                onChange={onFieldChange}
                placeholder="Calle, barrio, referencias…"
                autoComplete="street-address"
              />
            </label>
          </section>

          <section className="donor-publish-section">
            <h2>4. Fotografías (obligatorio)</h2>
            <p className="donor-hint">Mínimo 1 imagen, hasta 12. JPG, PNG o WebP.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="donor-file-input"
              onChange={onPickPhotos}
            />
            <div className="donor-photo-actions">
              <button type="button" className="donor-secondary-btn" onClick={() => fileInputRef.current?.click()}>
                Añadir fotos
              </button>
              <span className="donor-photo-count">{photos.length} seleccionada(s)</span>
            </div>
            {previews.length > 0 ? (
              <ul className="donor-photo-grid">
                {previews.map((src, i) => (
                  <li key={src} className="donor-photo-tile">
                    <img src={src} alt={`Foto ${i + 1}`} />
                    <button type="button" className="donor-photo-remove" onClick={() => removePhotoAt(i)}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="donor-publish-sticky">
            {message ? <p className="ok donor-sticky-msg">{message}</p> : null}
            {error ? <p className="error donor-sticky-msg">{error}</p> : null}
            <button type="submit" className="donor-primary-btn" disabled={loading || !coordsValid}>
              {loading ? "Publicando…" : "Publicar excedente"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
