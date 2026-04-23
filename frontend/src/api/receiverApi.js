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

export async function fetchReceiverDonationCategories() {
  const res = await fetch(`${API_BASE}/api/receiver/donations/categories`, {
    headers: { ...getAuthHeaders() }
  });
  return handleJson(res);
}

export async function searchReceiverDonations(params) {
  const url = new URL(`${API_BASE}/api/receiver/donations/search`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { ...getAuthHeaders() }
  });
  return handleJson(res);
}

