# FoodShare - Módulos de Autenticación + RF-03 (Donante) + RF-04 (Receptor)

Implementación base Fullstack para:
- Registro con roles `DONANTE` y `RECEPTOR`.
- Login con JWT.
- Recuperación y restablecimiento de contraseña por correo SMTP.
- RF-03: Publicación de excedentes para `DONANTE` (tipo, cantidad, fechas, fotos obligatorias, validación de vencimiento).
- RF-04: Búsqueda inteligente de donaciones para `RECEPTOR` (categoría, radio por geolocalización, tiempo restante).

## 1) Backend

```bash
cd backend
npm install
# crea tu .env a partir del ejemplo (NO lo subas a GitHub)
cp .env.example .env
npm run dev
```

Ejecuta primero `backend/database.sql` en PostgreSQL para crear tablas.
Si ya tenías la tabla `users` creada antes de RF11, ejecuta también:

```bash
psql "$DATABASE_URL" -f backend/migrations/001_admin_validation.sql
```

Si ya tenías la tabla `donations` sin `prepared_at` ni fotos, ejecuta también:

```bash
psql "$DATABASE_URL" -f backend/migrations/003_donation_publication_rf03.sql
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

#### RF-03 (Donante) - Publicación de excedentes
> Requiere JWT válido + cuenta `ACTIVA` + rol `DONANTE`.

- `POST /api/donor/donations` (`multipart/form-data`, Bearer token DONANTE)
  - Campos:
    - `food_type` (tipo de alimento, obligatorio)
    - `quantity` (número > 0, obligatorio)
    - `unit` (`KG` o `UNIDADES`, obligatorio)
    - `prepared_at` (ISO 8601, obligatorio)
    - `expires_at` (ISO 8601, obligatorio; debe ser **estrictamente posterior** a la hora del servidor)
    - `pickup_address` (obligatorio)
    - `pickup_lat`, `pickup_lng` (obligatorios; geolocalización del punto de retiro)
    - `photos` (archivos, **mínimo 1**, hasta 12; JPG/PNG/WebP)
  - Almacenamiento: registro en `donations` + filas en `donation_photos` (rutas bajo `/uploads/...`).

#### RF-04 (Receptor) - Búsqueda inteligente de donaciones
> Requiere JWT válido + cuenta `ACTIVA` + rol `RECEPTOR`.

- `GET /api/receiver/donations/categories` (Bearer token RECEPTOR)
  - Respuesta: `{ data: ["Frutas", "Panadería", ...] }`
- `GET /api/receiver/donations/search` (Bearer token RECEPTOR)
  - Query params:
    - `receptor_lat` (obligatorio)
    - `receptor_lng` (obligatorio)
    - `category` (opcional)
    - `radius_km` (opcional, default `5`)
    - `max_hours_remaining` (opcional, default `72`)
    - `limit` (opcional, default `50`, máx `100`)
  - Lógica:
    - Filtra solo donaciones activas (`is_active=true`) y no vencidas (`expires_at > NOW()`).
    - Calcula distancia desde el receptor a cada donación (Google Maps Distance Matrix si hay API Key; si no, usa cálculo aproximado).
    - Si no hay resultados dentro del radio, retorna `suggested_radius_km` para sugerir ampliar el rango.

#### Variables de entorno (Backend)
- `GOOGLE_MAPS_API_KEY` (opcional): habilita cálculo de distancia con Google Maps (Distance Matrix).

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
- `/receptor/dashboard` (Receptor - RF-04)
- `/donante/publicar-excedente` (Donante - RF-03)

### RF-04 (Dashboard Receptor — Búsqueda inteligente)
- La UI solicita geolocalización del navegador para obtener `receptor_lat/lng`.
- Permite filtrar por categoría, radio (km) y horas restantes para el vencimiento.
- Si no hay donaciones en el radio seleccionado, sugiere ampliar el rango.

### RF-03 (Formulario publicar excedente — Donante)
- Flujo por secciones (alimento, fechas, retiro, fotos) pensado para **móvil** (campos altos, botón principal fijo abajo).
- Fotos obligatorias con vista previa y opción de quitar antes de enviar.
- Geolocalización para `pickup_lat` / `pickup_lng` y dirección textual para referencia.

## Seguridad
- Contraseñas cifradas con `bcryptjs`.
- Token de sesión con `JWT`.
- Token de recuperación aleatorio y almacenado como hash SHA-256.
- En producción, desplegar detrás de un proxy HTTPS (Nginx, Caddy o cloud load balancer) para cifrar todo el tráfico.
