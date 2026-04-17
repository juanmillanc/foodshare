export function decodeJwtPayload(token) {
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    return true;
  }
  const currentUnix = Math.floor(Date.now() / 1000);
  return currentUnix >= payload.exp;
}

export function clearSessionWithExpirationFlag() {
  localStorage.removeItem("foodshare_token");
  sessionStorage.setItem("foodshare_session_expired", "1");
}
