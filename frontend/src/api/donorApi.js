const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getAuthHeaders() {
  const token = localStorage.getItem("foodshare_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || "Error inesperado.";
    throw new Error(msg);
  }
  return data;
}

export async function publishDonorDonation(formData) {
  const res = await fetch(`${API_BASE}/api/donor/donations`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData
  });
  return handleJson(res);
}
