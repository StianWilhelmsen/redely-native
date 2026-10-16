import i18n, { currentLanguage } from '@/i18n';
import { getValidIdToken } from '@/lib/auth-store';
import { env } from '@/lib/env';

import type { ApiErrorCode } from './types';

/**
 * An error the backend answered with. Switch on `code` (stable, see docs/API.md), show
 * `message` (already in the user's language - we send Accept-Language). A 401 from the
 * security layer has no body; `code` is then 'unauthorized'.
 */
export class ApiError extends Error {
  status: number;
  code: ApiErrorCode | string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/**
 * The request never reached the backend (offline, mid-handover, a deploy restarting the
 * instance). One plain sentence instead of React Native's "Network request failed".
 */
export class ConnectionError extends Error {
  constructor() {
    super(i18n.t('errors.connection'));
    this.name = 'ConnectionError';
  }
}

/** A message that is always safe to put in front of a person. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof ConnectionError) return error.message;
  return i18n.t('errors.generic');
}

/**
 * Reads are safe to repeat, so they ride out short gaps (a deploy, a network handover)
 * for about half a minute before giving up. Writes are never retried - repeating one
 * could create duplicates.
 */
const GET_RETRY_DELAYS_MS = [700, 1800, 4000, 8000, 15000];

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const attempts = method === 'GET' ? GET_RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (attempt === attempts - 1 || !isRetryableStatus(response.status)) return response;
    } catch (error) {
      if (attempt === attempts - 1) {
        if (__DEV__) console.warn('[api] request failed', url, error);
        throw new ConnectionError();
      }
    }
    await wait(GET_RETRY_DELAYS_MS[attempt]);
  }
  throw new ConnectionError();
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: { body?: unknown; query?: Query } = {}
): Promise<T> {
  const token = await getValidIdToken();
  const isForm = options.body instanceof FormData;
  const res = await fetchWithRetry(`${env.apiUrl}${withQuery(path, options.query)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': currentLanguage(),
      Accept: 'application/json',
      ...(options.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body:
      options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let code = res.status === 401 ? 'unauthorized' : 'internal_error';
    let message = i18n.t('errors.generic');
    let fields: Record<string, string> | undefined;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string; fields?: Record<string, string> };
        if (parsed.error) code = parsed.error;
        if (parsed.message) message = parsed.message;
        fields = parsed.fields;
      } catch {
        // Not JSON (a proxy page, a crash) - keep the generic sentence.
      }
    }
    throw new ApiError(res.status, code, message, fields);
  }

  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? await res.json() : await res.text()) as T;
}
