import { pool } from "../config/db.js";
import { mailer } from "../config/mailer.js";
import { distanceMatrixMeters } from "../services/googleMaps.js";
import { haversineDistanceMeters, normalizeLatLng } from "../utils/geo.js";
import { emitDonationReserved } from "../realtime/realtimeHub.js";

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
         AND reservation_status = 'DISPONIBLE'
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
    let where = `WHERE d.is_active = true AND d.expires_at > NOW() AND d.reservation_status = 'DISPONIBLE'`;

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
           d.prepared_at,
           d.expires_at,
           d.pickup_address,
           d.pickup_lat,
           d.pickup_lng,
           d.donor_id,
           u.name AS donor_name,
           COALESCE(
             (SELECT json_agg(dp.file_path ORDER BY dp.sort_order)
              FROM donation_photos dp
              WHERE dp.donation_id = d.id),
             '[]'::json
           ) AS photos
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reservationMinutes() {
  const n = Number(process.env.RESERVATION_MINUTES || 30);
  if (!Number.isFinite(n) || n < 5) return 30;
  return Math.min(120, Math.floor(n));
}

export async function reserveDonation(req, res) {
  try {
    const donationId = String(req.params.id || "").trim();
    if (!UUID_RE.test(donationId)) {
      return res.status(400).json({ message: "Identificador de donación inválido." });
    }

    const receptorId = req.currentUser?.id;
    if (!receptorId) {
      return res.status(401).json({ message: "No autorizado." });
    }

    const minutes = reservationMinutes();

    const updateResult = await pool.query(
      `UPDATE donations
       SET reservation_status = 'RESERVADO',
           reserved_by_receptor_id = $2,
           reserved_until = NOW() + ($3 * INTERVAL '1 minute'),
           reserved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND is_active = true
         AND expires_at > NOW()
         AND reservation_status = 'DISPONIBLE'
       RETURNING id, title, donor_id, reserved_until`,
      [donationId, receptorId, minutes]
    );

    if (updateResult.rows.length === 0) {
      const exists = await pool.query(`SELECT id FROM donations WHERE id = $1`, [donationId]);
      if (exists.rows.length === 0) {
        return res.status(404).json({ message: "La donación no existe." });
      }
      return res.status(409).json({
        message:
          "Esta publicación ya no está disponible (otro receptor la reservó en este momento o el producto no está activo).",
        code: "ALREADY_RESERVED_OR_UNAVAILABLE"
      });
    }

    const updatedRow = updateResult.rows[0];

    const donorRes = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [updatedRow.donor_id]);
    const receptorRes = await pool.query(`SELECT name FROM users WHERE id = $1`, [receptorId]);
    const donorEmail = donorRes.rows[0]?.email;
    const donorName = donorRes.rows[0]?.name || "Donante";
    const receptorName = receptorRes.rows[0]?.name || "Receptor";

    emitDonationReserved({
      donationId: updatedRow.id,
      reservedUntil: updatedRow.reserved_until,
      reservedByReceptorId: receptorId,
      receptorName
    });

    const untilStr = new Date(updatedRow.reserved_until).toLocaleString("es-CO", {
      dateStyle: "short",
      timeStyle: "short"
    });

    if (donorEmail && process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM,
          to: donorEmail,
          subject: `FoodShare — Reserva: ${updatedRow.title}`,
          html: `
            <p>Hola ${donorName},</p>
            <p><strong>${receptorName}</strong> reservó tu publicación <strong>${updatedRow.title}</strong>.</p>
            <p>La reserva vence el <strong>${untilStr}</strong>. Si no se concreta la entrega, el sistema puede liberarla automáticamente al vencer el tiempo.</p>
            <p>— FoodShare</p>
          `
        });
      } catch (mailErr) {
        console.error("[reserve] correo al donante:", mailErr.message);
      }
    }

    return res.status(200).json({
      message: `Reserva confirmada. Tienes hasta ${untilStr} para coordinar la entrega.`,
      data: {
        donation_id: updatedRow.id,
        reserved_until: updatedRow.reserved_until,
        reservation_minutes: minutes
      }
    });
  } catch (error) {
    if (error?.code === "42703") {
      return res.status(500).json({
        message:
          "Faltan columnas de reserva en la base de datos. Ejecuta backend/migrations/004_rf05_reservations.sql o vuelve a aplicar backend/database.sql."
      });
    }
    return res.status(500).json({ message: "No fue posible reservar la donación.", error: error.message });
  }
}

