// Module-level access token — lives in memory, cleared on page unload.
// Never stored in localStorage or sessionStorage.
let _accessToken: string | null = null;
let _tokenExpiry: number = 0;

export const tokenStore = {
  get(): string | null {
    if (_tokenExpiry && Date.now() > _tokenExpiry - 30_000) {
      return null; // Expired or expiring within 30s — trigger refresh
    }
    return _accessToken;
  },
  set(token: string, expiresInMs: number) {
    _accessToken = token;
    _tokenExpiry = Date.now() + expiresInMs;
  },
  clear() {
    _accessToken = null;
    _tokenExpiry = 0;
  },
};
