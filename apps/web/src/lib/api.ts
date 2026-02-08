export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7791/api";

/** Matches bare datetime strings like "2025-02-08 15:30:45" or "2025-02-08T15:30:45" (no Z / offset). */
const BARE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/;

/** JSON.parse reviver: marks timezone-naive datetimes as UTC so new Date() works correctly. */
function timestampReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && BARE_DATETIME.test(value)) {
    return value.replace(" ", "T") + "Z";
  }
  return value;
}

class ApiClient {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setOnUnauthorized(callback: (() => void) | null) {
    this.onUnauthorized = callback;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message ?? `API error: ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    // Parse with a reviver that appends 'Z' to bare UTC timestamps from SQLite
    // so new Date() throughout the app always interprets them as UTC.
    const text = await res.text();
    return JSON.parse(text, timestampReviver);
  }

  get<T>(path: string, options?: { signal?: AbortSignal }) {
    return this.request<T>(path, { signal: options?.signal });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const api = new ApiClient();
