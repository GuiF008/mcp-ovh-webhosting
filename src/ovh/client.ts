/**
 * Client HTTP pour les APIs OVHcloud
 * Gère les requêtes avec authentification, timeouts, retries et rate limiting
 */

import { AuthProvider, AuthError } from './auth/provider.js';
import { OvhApiError, parseOvhError, TimeoutError } from './errors.js';
import { TokenBucketRateLimiter, createDefaultRateLimiter } from '../utils/rateLimiter.js';
import { getLogger, Logger } from '../logger.js';

export interface OvhClientConfig {
  /** URL de base de l'API OVH */
  baseUrl: string;
  /** Provider d'authentification */
  authProvider: AuthProvider;
  /** Timeout HTTP en ms */
  timeoutMs: number;
  /** Nombre max de retries */
  maxRetries: number;
  /** Rate limiter (optionnel) */
  rateLimiter?: TokenBucketRateLimiter;
}

export interface RequestOptions {
  /** Query parameters */
  query?: Record<string, string | number | boolean | undefined>;
  /** Corps de la requête */
  body?: unknown;
  /** Headers additionnels */
  headers?: Record<string, string>;
  /** Désactiver le rate limiting pour cette requête */
  skipRateLimit?: boolean;
  /** Désactiver les retries pour cette requête */
  skipRetry?: boolean;
}

/**
 * Réponse typée du client OVH
 */
export interface OvhResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Client HTTP pour les APIs OVHcloud
 */
export class OvhClient {
  private readonly logger: Logger;
  private readonly rateLimiter: TokenBucketRateLimiter;

  // Délais de backoff pour les retries (en ms)
  private readonly RETRY_DELAYS = [1000, 2000, 4000];

  constructor(private readonly config: OvhClientConfig) {
    this.logger = getLogger().child({ component: 'OvhClient' });
    this.rateLimiter = config.rateLimiter || createDefaultRateLimiter();
  }

  /**
   * Effectue une requête GET
   */
  async get<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  /**
   * Effectue une requête POST
   */
  async post<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('POST', path, options);
  }

  /**
   * Effectue une requête PUT
   */
  async put<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('PUT', path, options);
  }

  /**
   * Effectue une requête DELETE
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<OvhResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Effectue une requête HTTP avec retries et gestion d'erreurs
   */
  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<OvhResponse<T>> {
    // Rate limiting
    if (!options.skipRateLimit) {
      await this.rateLimiter.acquire();
    }

    const url = this.buildUrl(path, options.query);
    const body = options.body ? JSON.stringify(options.body) : undefined;

    let lastError: Error | null = null;
    const maxAttempts = options.skipRetry ? 1 : this.config.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(
          { method, url, attempt, maxAttempts },
          'Envoi requête OVH'
        );

        const response = await this.executeRequest(method, url, body, options.headers);

        this.logger.debug(
          { method, url, status: response.status, attempt },
          'Réponse OVH reçue'
        );

        return response;
      } catch (error) {
        lastError = error as Error;

        // Vérifier si l'erreur est retryable
        const shouldRetry = this.shouldRetry(error, attempt, maxAttempts);

        if (shouldRetry) {
          const delay = this.getRetryDelay(attempt);
          this.logger.warn(
            {
              method,
              url,
              attempt,
              maxAttempts,
              error: error instanceof Error ? error.message : 'Unknown',
              retryDelay: delay,
            },
            'Erreur retryable, nouvelle tentative'
          );

          await this.sleep(delay);
          continue;
        }

        // Erreur non retryable ou max retries atteint
        break;
      }
    }

    // Propager l'erreur finale
    throw lastError;
  }

  /**
   * Exécute une requête HTTP avec timeout
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    body?: string,
    additionalHeaders?: Record<string, string>
  ): Promise<OvhResponse<T>> {
    // Obtenir les headers d'authentification
    let authHeaders: Record<string, string>;
    try {
      authHeaders = await this.config.authProvider.getHeaders(method, url, body);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new OvhApiError(
          error.message,
          401,
          'AUTH_ERROR',
          -32002,
          false,
          error
        );
      }
      throw error;
    }

    // Combiner les headers
    const headers = {
      ...authHeaders,
      ...additionalHeaders,
    };

    // Créer le controller pour le timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Gérer les erreurs HTTP
      if (!response.ok) {
        const responseText = await response.text();
        throw parseOvhError(response.status, responseText);
      }

      // Parser la réponse
      const data = (await response.json()) as T;

      return {
        data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Gérer le timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(this.config.timeoutMs);
      }

      // Propager les erreurs OVH
      if (error instanceof OvhApiError) {
        throw error;
      }

      // Erreur réseau ou autre
      throw new OvhApiError(
        `Erreur réseau: ${error instanceof Error ? error.message : 'Unknown'}`,
        0,
        'NETWORK_ERROR',
        -32603,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Construit l'URL complète avec query parameters
   */
  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.config.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Détermine si une erreur est retryable
   */
  private shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    if (error instanceof OvhApiError) {
      return error.retryable;
    }

    // Erreurs réseau sont généralement retryable
    if (error instanceof Error) {
      return error.name === 'TypeError' || error.message.includes('network');
    }

    return false;
  }

  /**
   * Calcule le délai avant retry (backoff exponentiel)
   */
  private getRetryDelay(attempt: number): number {
    const index = Math.min(attempt - 1, this.RETRY_DELAYS.length - 1);
    const baseDelay = this.RETRY_DELAYS[index];
    // Ajouter un jitter aléatoire (0-25% du délai)
    const jitter = Math.random() * baseDelay * 0.25;
    return Math.floor(baseDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Crée une instance du client OVH avec la configuration fournie
 */
export function createOvhClient(config: OvhClientConfig): OvhClient {
  return new OvhClient(config);
}