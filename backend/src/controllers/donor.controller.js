import fs from "fs";
import { pool } from "../config/db.js";

function unlinkUploadedFiles(files) {
  if (!Array.isArray(files)) return;
  for (const file of files) {
    try {
      if (file?.path) fs.unlinkSync(file.path);
    } catch (_e) {
      // ignore
    }
  }
}

function buildTitle(foodType) {
  const base = `Excedente: ${String(foodType || "").trim()}`;
  return base.length > 140 ? base.slice(0, 137) + "..." : base;
}

export async function publishDonation(req, res) {
  const files = req.files || [];

  try {
    const donorId = req.currentUser?.id || req.auth?.sub;
    if (!donorId) {
      unlinkUploadedFiles(files);
      return res.status(401).json({ message: "No autorizado." });
    }

    const {
      food_type: foodTypeRaw,
      quantity: quantityRaw,
      unit: unitRaw,
      prepared_at: preparedAtRaw,
      expires_at: expiresAtRaw,
      pickup_address: pickupAddressRaw,
      pickup_lat: pickupLatRaw,
      pickup_lng: pickupLngRaw,
      description: descriptionRaw
    } = req.body;

    const foodType = String(foodTypeRaw || "").trim();
    const unit = String(unitRaw || "").trim().toUpperCase();
    const pickupAddress = String(pickupAddressRaw || "").trim();
    const description = descriptionRaw != null ? String(descriptionRaw).trim() : "";

    if (!foodType) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "El tipo de alimento es obligatorio." });
    }

    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "La cantidad debe ser un número mayor que cero." });
    }

    if (!["KG", "UNIDADES"].includes(unit)) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "La unidad debe ser KG o UNIDADES." });
    }

    if (!preparedAtRaw || !expiresAtRaw) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "Las fechas de preparación y vencimiento son obligatorias." });
    }

    const preparedAt = new Date(preparedAtRaw);
    const expiresAt = new Date(expiresAtRaw);

    if (Number.isNaN(preparedAt.getTime())) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "La fecha de preparación no es válida." });
    }

    if (Number.isNaN(expiresAt.getTime())) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "La fecha de vencimiento no es válida." });
    }

    const nowMs = Date.now();
    if (expiresAt.getTime() <= nowMs) {
      unlinkUploadedFiles(files);
      return res.status(400).json({
        message: "No se puede publicar: la fecha de vencimiento debe ser estrictamente posterior a la hora actual."
      });
    }

    if (files.length < 1) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "Debes adjuntar al menos una fotografía del excedente." });
    }

    const pickupLat = Number(pickupLatRaw);
    const pickupLng = Number(pickupLngRaw);
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "La ubicación de retiro (latitud/longitud) es obligatoria." });
    }
    if (pickupLat < -90 || pickupLat > 90 || pickupLng < -180 || pickupLng > 180) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "Coordenadas de ubicación inválidas." });
    }

    if (!pickupAddress) {
      unlinkUploadedFiles(files);
      return res.status(400).json({ message: "La dirección de retiro es obligatoria." });
    }

    const title = buildTitle(foodType);
    const category = foodType.length > 60 ? foodType.slice(0, 60) : foodType;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertDonation = await client.query(
        `INSERT INTO donations (
           donor_id,
           title,
           description,
           category,
           quantity,
           unit,
           prepared_at,
           expires_at,
           pickup_address,
           pickup_lat,
           pickup_lng,
           is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         RETURNING id`,
        [
          donorId,
          title,
          description || null,
          category,
          quantity,
          unit,
          preparedAt,
          expiresAt,
          pickupAddress,
          pickupLat,
          pickupLng
        ]
      );

      const donationId = insertDonation.rows[0].id;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const publicPath = `/uploads/${file.filename}`;
        await client.query(
          `INSERT INTO donation_photos (donation_id, file_path, sort_order)
           VALUES ($1, $2, $3)`,
          [donationId, publicPath, i]
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Tu excedente fue publicado correctamente.",
        data: { id: donationId, title }
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    unlinkUploadedFiles(files);
    if (error?.code === "42P01") {
      return res.status(500).json({
        message:
          "Faltan tablas en la base de datos. Ejecuta backend/database.sql y, si aplica, backend/migrations/003_donation_publication_rf03.sql."
      });
    }
    if (error?.code === "23514") {
      return res.status(400).json({ message: "Datos inválidos para la publicación (revisa unidad y fechas)." });
    }
    if (error?.message?.includes("Solo se permiten imágenes")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "No fue posible publicar el excedente.", error: error.message });
  }
}
