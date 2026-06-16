// Returns a refresh token expiry 8 hours from now — covers a full college/work day.
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 8);
  return expiry;
}
