import { pool } from "../config/db.js";

function simulateValidationNotification(_email, _status, _observations) {
  // TODO: Integrar servicio SMTP o cola de notificaciones.
}

export async function listPendingValidations(_req, res) {
  try {
    const requestedStatus = String(_req.query.status || "PENDIENTE").toUpperCase();
    const allowedStatuses = ["PENDIENTE", "ACTIVA", "RECHAZADA"];
    const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : "PENDIENTE";

    let result;
    try {
      result = await pool.query(
        `SELECT id, name, email, role, account_status, legal_document_path, created_at
         FROM users
         WHERE UPPER(TRIM(account_status)) = $1
           AND UPPER(TRIM(role)) <> 'ADMIN'
           AND COALESCE(is_permanently_blocked, false) = false
         ORDER BY created_at ASC`,
        [status]
      );
    } catch (queryError) {
      // Compatibilidad con esquemas antiguos sin columna is_permanently_blocked.
      if (queryError?.code === "42703") {
        result = await pool.query(
          `SELECT id, name, email, role, account_status, legal_document_path, created_at
           FROM users
           WHERE UPPER(TRIM(account_status)) = $1
             AND UPPER(TRIM(role)) <> 'ADMIN'
           ORDER BY created_at ASC`,
          [status]
        );
      } else {
        throw queryError;
      }
    }

    return res.status(200).json({
      total: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    return res.status(500).json({ message: "No fue posible listar validaciones pendientes.", error: error.message });
  }
}

export async function validateUserRequest(req, res) {
  try {
    const { id } = req.params;
    const { new_status: newStatus, observations } = req.body;
    const allowedStatuses = ["ACTIVA", "RECHAZADA"];

    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({ message: "new_status debe ser ACTIVA o RECHAZADA." });
    }

    let user;
    try {
      const userResult = await pool.query(
        `SELECT id, email, account_status, is_permanently_blocked
         FROM users
         WHERE id = $1`,
        [id]
      );
      user = userResult.rows[0];
    } catch (queryError) {
      // Compatibilidad con esquemas anteriores sin is_permanently_blocked.
      if (queryError?.code === "42703") {
        const fallbackUserResult = await pool.query(
          `SELECT id, email, account_status
           FROM users
           WHERE id = $1`,
          [id]
        );
        user = {
          ...fallbackUserResult.rows[0],
          is_permanently_blocked: false
        };
      } else {
        throw queryError;
      }
    }

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (user.is_permanently_blocked) {
      return res.status(409).json({ message: "El usuario está bloqueado permanentemente y no puede validarse." });
    }

    let updateResult;
    try {
      updateResult = await pool.query(
        `UPDATE users
         SET account_status = $1,
             validation_observations = $2,
             validated_at = NOW(),
             validated_by = $3
         WHERE id = $4
         RETURNING id, email, account_status, validation_observations, validated_at`,
        [newStatus, observations || null, req.currentUser.id, id]
      );
    } catch (queryError) {
      // Compatibilidad con esquemas anteriores sin columnas de auditoría.
      if (queryError?.code === "42703") {
        updateResult = await pool.query(
          `UPDATE users
           SET account_status = $1
           WHERE id = $2
           RETURNING id, email, account_status`,
          [newStatus, id]
        );
      } else {
        throw queryError;
      }
    }

    simulateValidationNotification(user.email, newStatus, observations);

    return res.status(200).json({
      message: `Solicitud resuelta. Estado actualizado a ${newStatus}.`,
      data: updateResult.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ message: "No fue posible resolver la validación.", error: error.message });
  }
}

export async function blockUserPermanently(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "Debes indicar el motivo del bloqueo permanente." });
    }

    const updateResult = await pool.query(
      `UPDATE users
       SET is_permanently_blocked = true,
           blocked_reason = $1,
           blocked_at = NOW(),
           account_status = 'RECHAZADA',
           validation_observations = COALESCE(validation_observations, '') || CASE
             WHEN validation_observations IS NULL OR validation_observations = '' THEN ''
             ELSE ' | '
           END || $2
       WHERE id = $3
       RETURNING id, email, account_status, is_permanently_blocked, blocked_reason, blocked_at`,
      [reason, `Bloqueo permanente: ${reason}`, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const blockedUser = updateResult.rows[0];
    simulateValidationNotification(blockedUser.email, "RECHAZADA", `Bloqueo permanente: ${reason}`);

    return res.status(200).json({
      message: "Usuario inhabilitado permanentemente por posible fraude.",
      data: blockedUser
    });
  } catch (error) {
    return res.status(500).json({ message: "No fue posible bloquear al usuario.", error: error.message });
  }
}
