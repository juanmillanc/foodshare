# FoodShare - Módulos de Autenticación

Implementación base Fullstack para:
- Registro con roles `DONANTE` y `RECEPTOR`.
- Login con JWT.
- Recuperación y restablecimiento de contraseña por correo SMTP.

## 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Ejecuta primero `backend/database.sql` en PostgreSQL para crear tablas.
Si ya tenías la tabla `users` creada antes de RF11, ejecuta también:

```bash
psql "$DATABASE_URL" -f backend/migrations/001_admin_validation.sql
```

### Endpoints
- `POST /api/auth/register` (`multipart/form-data`)
  - Campos: `name`, `email`, `password`, `role`.
  - Archivo: `legalDocument` (requerido si `role=DONANTE`, solo PDF).
- `POST /api/auth/login` (`application/json`)
- `POST /api/auth/forgot-password` (`application/json`)
- `POST /api/auth/reset-password` (`application/json`)
- `GET /api/admin/pending-validations` (Bearer token ADMIN)
- `PATCH /api/admin/validate-user/:id` (Bearer token ADMIN)
  - Body: `{ "new_status": "ACTIVA" | "RECHAZADA", "observations": "opcional" }`
- `PATCH /api/admin/block-user/:id` (Bearer token ADMIN)
  - Body: `{ "reason": "motivo del fraude" }`

## 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Rutas UI:
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password?token=...`

## Seguridad
- Contraseñas cifradas con `bcryptjs`.
- Token de sesión con `JWT`.
- Token de recuperación aleatorio y almacenado como hash SHA-256.
- En producción, desplegar detrás de un proxy HTTPS (Nginx, Caddy o cloud load balancer) para cifrar todo el tráfico.
