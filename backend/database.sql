CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('DONANTE', 'RECEPTOR', 'ADMIN')),
  account_status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (account_status IN ('PENDIENTE', 'ACTIVA', 'RECHAZADA')),
  legal_document_path TEXT,
  validation_observations TEXT,
  validated_at TIMESTAMP,
  validated_by UUID REFERENCES users(id),
  is_permanently_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
