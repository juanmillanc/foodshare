import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../config/db.js";
import { mailer } from "../config/mailer.js";
import { uploadPdf } from "../middleware/upload.js";

dotenv.config();

const router = express.Router();

const GENERIC_RECOVERY_MESSAGE =
  "Si el correo existe en nuestra base de datos, recibirás un enlace para restablecer tu contraseña.";

router.post("/register", uploadPdf.single("legalDocument"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedRole = String(role || "").toUpperCase();

    if (!name || !email || !password || !normalizedRole) {
      return res.status(400).json({ message: "Todos los campos obligatorios deben estar completos." });
    }

    if (!["DONANTE", "RECEPTOR"].includes(normalizedRole)) {
      return res.status(400).json({ message: "El rol debe ser Donante o Receptor." });
    }

    if (normalizedRole === "DONANTE" && !req.file) {
      return res.status(400).json({ message: "Los donantes deben adjuntar el certificado sanitario en PDF." });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "El correo electrónico ya se encuentra registrado." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // Guardar ruta pública para servir el PDF por /uploads.
    const legalDocumentPath = req.file ? `/uploads/${req.file.filename}` : null;

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, account_status, legal_document_path)
       VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)`,
      [name, email.toLowerCase(), passwordHash, normalizedRole, legalDocumentPath]
    );

    return res.status(201).json({
      message: "Registro exitoso. Tu cuenta quedó en estado Pendiente hasta validación administrativa."
    });
  } catch (error) {
    if (error.message?.includes("Solo se permiten archivos PDF")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "No fue posible registrar el usuario.", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Correo y contraseña son obligatorios." });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    if (user.is_permanently_blocked) {
      return res.status(403).json({ message: "Tu cuenta fue inhabilitada permanentemente. Contacta al soporte." });
    }

    if (user.account_status !== "ACTIVA") {
      return res.status(403).json({ message: `Tu cuenta aún no está activa. Estado actual: ${user.account_status}.` });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    return res.status(500).json({ message: "Error interno durante el inicio de sesión.", error: error.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });
    }

    const result = await pool.query("SELECT id, email FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "FoodShare - Restablecer contraseña",
      html: `
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace (válido por 30 minutos):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
      `
    });

    return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });
  } catch (error) {
    return res.status(500).json({ message: "No fue posible procesar la recuperación.", error: error.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token y nueva contraseña son obligatorios." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );

    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      return res.status(400).json({ message: "El token es inválido o ya fue utilizado." });
    }

    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "El token expiró. Solicita un nuevo enlace de recuperación." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, tokenRow.user_id]);
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [tokenRow.user_id]);

    return res.status(200).json({ message: "Tu contraseña fue actualizada correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "No fue posible restablecer la contraseña.", error: error.message });
  }
});

export default router;
