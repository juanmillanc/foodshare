import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function distanceMatrixMeters({ origin, destinations }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const error = new Error("GOOGLE_MAPS_API_KEY no está configurada.");
    error.code = "NO_GOOGLE_MAPS_KEY";
    throw error;
  }

  // Distance Matrix limita destinos por request (25). Chunk para soportar más resultados.
  const chunks = chunkArray(destinations, 25);
  const results = [];

  for (const destChunk of chunks) {
    const originsParam = `${origin.lat},${origin.lng}`;
    const destinationsParam = destChunk.map((d) => `${d.lat},${d.lng}`).join("|");

    const url = new URL(BASE_URL);
    url.searchParams.set("origins", originsParam);
    url.searchParams.set("destinations", destinationsParam);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("units", "metric");
    url.searchParams.set("mode", "driving");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Maps Distance Matrix falló: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.status !== "OK") {
      throw new Error(`Google Maps Distance Matrix error: ${data.status}`);
    }

    const row = data.rows?.[0];
    const elements = row?.elements || [];
    for (let i = 0; i < elements.length; i += 1) {
      const el = elements[i];
      if (!el || el.status !== "OK") {
        results.push({ distance_meters: null, duration_seconds: null });
      } else {
        results.push({
          distance_meters: Number(el.distance?.value ?? null),
          duration_seconds: Number(el.duration?.value ?? null)
        });
      }
    }
  }

  return results;
}

