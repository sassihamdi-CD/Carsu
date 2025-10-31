/**
 * Purpose: HTTP client for making authenticated API requests to the backend.
 * Usage: Singleton instance exported as `api`; used throughout the frontend for all API calls.
 * Why: Centralizes API communication logic, token management, and error handling.
 * Notes: Automatically includes JWT token in Authorization header when set via setToken().
 */
export type Jwt = string;

export class ApiClient {
  private baseUrl: string;
  private token: Jwt | null = null;

  constructor(baseUrl = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
    console.log('[API] Base URL:', this.baseUrl);
  }

  setToken(token: Jwt | null) {
    this.token = token;
  }

  private headers(extra?: Record<string, string>) {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return { ...h, ...(extra || {}) };
  }

  async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(headers),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = 'Request failed';
      try {
        const json = JSON.parse(text);
        errorMsg = json.details?.message || json.error || json.message || errorMsg;
        if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(', ');
      } catch {
        errorMsg = text || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers(headers) });
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = 'Request failed';
      try {
        const json = JSON.parse(text);
        errorMsg = json.details?.message || json.error || json.message || errorMsg;
        if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(', ');
      } catch {
        errorMsg = text || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  }

  async patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers(headers),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async delete(path: string, headers?: Record<string, string>): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'DELETE', headers: this.headers(headers) });
    if (!res.ok) throw new Error(await res.text());
  }
}

export const api = new ApiClient();


