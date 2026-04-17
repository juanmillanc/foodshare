const API_URL = "http://localhost:4000/api/admin";

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Ocurrió un error en la operación administrativa.");
  }
  return payload;
}

function buildAuthHeaders() {
  const token = localStorage.getItem("foodshare_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function fetchValidationsByStatus(status = "PENDIENTE") {
  const response = await fetch(`${API_URL}/pending-validations?status=${encodeURIComponent(status)}`, {
    headers: buildAuthHeaders()
  });
  return parseResponse(response);
}

export async function approveOrRejectUser(userId, newStatus, observations) {
  const response = await fetch(`${API_URL}/validate-user/${userId}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      new_status: newStatus,
      observations
    })
  });
  return parseResponse(response);
}

export async function blockUser(userId, reason) {
  const response = await fetch(`${API_URL}/block-user/${userId}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  return parseResponse(response);
}
