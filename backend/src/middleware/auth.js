import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../config/db.js";

dotenv.config();

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No autorizado: token requerido." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "No autorizado." });
    }

    let user;
    try {
      const result = await pool.query(
        `SELECT id, role, account_status, is_permanently_blocked
         FROM users
         WHERE id = $1`,
        [userId]
      );
      user = result.rows[0];
    } catch (queryError) {
      // Compatibilidad con esquemas antiguos que no tienen is_permanently_blocked.
      if (queryError?.code === "42703") {
        const fallbackResult = await pool.query(
          `SELECT id, role, account_status
           FROM users
           WHERE id = $1`,
          [userId]
        );
        user = {
          ...fallbackResult.rows[0],
          is_permanently_blocked: false
        };
      } else {
        throw queryError;
      }
    }

    if (!user) {
      return res.status(401).json({ message: "Usuario autenticado no encontrado." });
    }

    if (user.is_permanently_blocked) {
      return res.status(403).json({ message: "Cuenta inhabilitada permanentemente." });
    }

    if (String(user.account_status || "").trim().toUpperCase() !== "ACTIVA") {
      return res.status(403).json({ message: "Solo cuentas activas pueden operar en la plataforma." });
    }

    if (String(user.role || "").trim().toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Acceso denegado: se requiere rol ADMIN." });
    }

    req.currentUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ message: "No fue posible validar permisos.", error: error.message });
  }
}
