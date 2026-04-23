import { pool } from "../config/db.js";
import { distanceMatrixMeters } from "../services/googleMaps.js";
import { haversineDistanceMeters, normalizeLatLng } from "../utils/geo.js";

function normalizeCategory(raw) {
  const s = String(raw || "").trim();
  return s ? s : null;
}

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function toNonNegativeInteger(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export async function listActiveDonationCategories(_req, res) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT category
       FROM donations
       WHERE is_active = true
         AND expires_at > NOW()
       ORDER BY category ASC`
    );

    return res.status(200).json({ data: result.rows.map((r) => r.category) });
  } catch (error) {
    // Si la tabla aún no existe en una instalación vieja, responder claro.
    if (error?.code === "42P01") {
      return res.status(500).json({
        message:
          "La tabla de donaciones no existe. Ejecuta backend/database.sql (o la migración de donaciones) en PostgreSQL."
      });
    }
    return res.status(500).json({ message: "No fue posible listar categorías.", error: error.message });
  }
}

export async function searchDonations(req, res) {
  try {
    const category = normalizeCategory(req.query.category);
    const radiusKm = toPositiveNumber(req.query.radius_km, 5);
    const maxHoursRemaining = toNonNegativeInteger(req.query.max_hours_remaining, 72);
    const limit = Math.min(100, Math.max(1, toNonNegativeInteger(req.query.limit, 50)));

    const receptorLatLng = normalizeLatLng(req.query.receptor_lat, req.query.receptor_lng);
    if (!receptorLatLng) {
      return res.status(400).json({
        message: "Debes enviar receptor_lat y receptor_lng válidos (geolocalización)."
      });
    }

    // 1) Consultar DB: solo activos y no vencidos. El filtro de horas define ventana máxima.
    const values = [];
    let idx = 1;
    let where = `WHERE d.is_active = true AND d.expires_at > NOW()`;

    if (category) {
      values.push(category);
      where += ` AND d.category = $${idx++}`;
    }

    if (Number.isFinite(maxHoursRemaining)) {
      values.push(maxHoursRemaining);
      where += ` AND d.expires_at <= NOW() + ($${idx++} * INTERVAL '1 hour')`;
    }

    values.push(limit);

    let donationsResult;
    try {
      donationsResult = await pool.query(
        `SELECT
           d.id,
           d.title,
           d.description,
           d.category,
           d.quantity,
           d.unit,
           d.expires_at,
           d.pickup_address,
           d.pickup_lat,
           d.pickup_lng,
           d.donor_id,
           u.name AS donor_name
         FROM donations d
         JOIN users u ON u.id = d.donor_id
         ${where}
         ORDER BY d.expires_at ASC
         LIMIT $${idx}`,
        values
      );
    } catch (error) {
      if (error?.code === "42P01") {
        return res.status(500).json({
          message:
            "La tabla de donaciones no existe. Ejecuta backend/database.sql (o la migración de donaciones) en PostgreSQL."
        });
      }
      throw error;
    }

    const candidates = donationsResult.rows;
    if (candidates.length === 0) {
      return res.status(200).json({
        total: 0,
        within_radius: 0,
        used_radius_km: radiusKm,
        used_max_hours_remaining: maxHoursRemaining,
        suggested_radius_km: Math.ceil(radiusKm * 2),
        data: []
      });
    }

    // 2) Distancias: Google Maps (preferido) o fallback Haversine.
    const destinations = candidates.map((d) => ({ lat: d.pickup_lat, lng: d.pickup_lng }));
    let distances = null;
    let distanceSource = "google_maps";

    try {
      distances = await distanceMatrixMeters({
        origin: receptorLatLng,
        destinations
      });
    } catch (error) {
      distanceSource = "haversine_fallback";
      distances = destinations.map((dest) => ({
        distance_meters: Math.round(haversineDistanceMeters(receptorLatLng, dest)),
        duration_seconds: null
      }));
    }

    const radiusMeters = radiusKm * 1000;
    const enriched = candidates.map((d, i) => {
      const dist = distances[i] || { distance_meters: null, duration_seconds: null };
      return {
        ...d,
        distance_meters: dist.distance_meters,
        duration_seconds: dist.duration_seconds
      };
    });

    const within = enriched
      .filter((d) => d.distance_meters != null && d.distance_meters <= radiusMeters)
      .sort((a, b) => (a.distance_meters ?? 1e15) - (b.distance_meters ?? 1e15));

    const beyondCount = enriched.filter((d) => d.distance_meters != null && d.distance_meters > radiusMeters).length;
    const suggestedRadiusKm =
      within.length > 0
        ? radiusKm
        : (() => {
            const minBeyond = enriched
              .filter((d) => d.distance_meters != null)
              .reduce((min, d) => Math.min(min, d.distance_meters), Infinity);
            if (!Number.isFinite(minBeyond) || minBeyond === Infinity) return Math.ceil(radiusKm * 2);
            return Math.ceil((minBeyond / 1000) * 1.1);
          })();

    return res.status(200).json({
      total: enriched.length,
      within_radius: within.length,
      used_radius_km: radiusKm,
      used_max_hours_remaining: maxHoursRemaining,
      distance_source: distanceSource,
      suggested_radius_km: suggestedRadiusKm,
      beyond_radius_count: beyondCount,
      data: within
    });
  } catch (error) {
    return res.status(500).json({ message: "No fue posible buscar donaciones.", error: error.message });
  }
}

