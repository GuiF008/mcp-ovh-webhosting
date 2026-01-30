/**
 * Client HTTP pour les APIs OVHcloud
 */

import { AuthProvider } from './auth/provider.js';
import { OvhApiError, parseOvhError, TimeoutError } from './errors.js';
import { getLogger, Logger } from '../logger.js';

export interface OvhClientConfig {
  baseUrl: string;
  authProvider: AuthProvider;
  timeoutMs: number;
  maxRetries: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  skipRetry?: boolean;
}

export interface OvhResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class OvhClient {
  private readonly logger: Logger;
  private readonly RETRY_DELAYS = [1000, 2000, 4000];

  constructor(private readonly config: OvhClientConfig) {
    this.logger = getLogger().child({ component: 'OvhClient' });
  }

  async get<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('POST', path, options);
  }

  async put<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('PUT', path, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<OvhResponse<T>> {
    const url = this.buildUrl(path, options.query);
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const maxAttempts = options.skipRetry ? 1 : this.config.maxRetries + 1;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeRequest<T>(method, url, body, options.headers);
      } catch (error) {
        lastError = error as Error;

        if (this.shouldRetry(error, attempt, maxAttempts)) {
          const delay = this.RETRY_DELAYS[Math.min(attempt - 1, this.RETRY_DELAYS.length - 1)];
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  private async executeRequest<T>(method: string, url: string, body?: string, additionalHeaders?: Record<string, string>): Promise<OvhResponse<T>> {
    const authHeaders = await this.config.authProvider.getHeaders(method, url, body);
    const headers = { ...authHeaders, ...additionalHeaders };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseText = await response.text();
        throw parseOvhError(response.status, responseText);
      }

      const data = (await response.json()) as T;
      return { data, status: response.status, headers: response.headers };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(this.config.timeoutMs);
      }
      if (error instanceof OvhApiError) throw error;
      throw new OvhApiError(`Erreur réseau: ${error instanceof Error ? error.message : 'Unknown'}`, 0, 'NETWORK_ERROR', -32603, true);
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.config.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) return false;
    if (error instanceof OvhApiError) return error.retryable;
    return false;
  }
}

export function createOvhClient(config: OvhClientConfig): OvhClient {
  return new OvhClient(config);
}
