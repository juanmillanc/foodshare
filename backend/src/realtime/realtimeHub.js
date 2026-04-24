import { Server } from "socket.io";
import { pool } from "../config/db.js";

let io = null;

function buildSocketCors() {
  if (process.env.NODE_ENV === "production") {
    const list = String(process.env.FRONTEND_URL || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { origin: list.length ? list : false, credentials: true, methods: ["GET", "POST"] };
  }
  return { origin: true, credentials: true, methods: ["GET", "POST"] };
}

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: buildSocketCors(),
    transports: ["websocket", "polling"]
  });

  io.on("connection", (socket) => {
    socket.join("donations-feed");
  });

  return io;
}

export function emitDonationReserved(payload) {
  io?.to("donations-feed").emit("donation:reserved", payload);
}

export function emitDonationReleased(payload) {
  io?.to("donations-feed").emit("donation:released", payload);
}

export function startReservationSweeper() {
  const intervalMs = Number(process.env.RESERVATION_SWEEP_MS || 60_000);
  setInterval(async () => {
    try {
      const result = await pool.query(
        `UPDATE donations
         SET reservation_status = 'DISPONIBLE',
             reserved_by_receptor_id = NULL,
             reserved_until = NULL,
             reserved_at = NULL,
             updated_at = NOW()
         WHERE reservation_status = 'RESERVADO'
           AND reserved_until IS NOT NULL
           AND reserved_until < NOW()
         RETURNING id`
      );
      for (const row of result.rows) {
        emitDonationReleased({ donationId: row.id });
      }
    } catch (e) {
      console.error("[reservation-sweep]", e.message);
    }
  }, intervalMs);
}
