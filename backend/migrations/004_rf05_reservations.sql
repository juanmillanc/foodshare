-- RF-05: Reserva de alimentos (estado RESERVADO + temporizador)

ALTER TABLE donations ADD COLUMN IF NOT EXISTS reservation_status VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE';

UPDATE donations SET reservation_status = 'DISPONIBLE' WHERE reservation_status IS NULL;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_reservation_status_check;

ALTER TABLE donations ADD CONSTRAINT donations_reservation_status_check
  CHECK (reservation_status IN ('DISPONIBLE', 'RESERVADO'));

ALTER TABLE donations ADD COLUMN IF NOT EXISTS reserved_by_receptor_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE donations ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP;

ALTER TABLE donations ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_donations_reservation_status ON donations(reservation_status);
