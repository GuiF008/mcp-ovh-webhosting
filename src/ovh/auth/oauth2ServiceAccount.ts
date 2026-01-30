/**
 * Provider d'authentification OAuth2 Service Account pour OVHcloud
 */

import { AuthProvider, AuthHeaders, AuthError } from './provider.js';
import { getLogger } from '../../logger.js';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export interface OAuth2ServiceAccountConfig {
  clientId: string;
  clientSecret: string;
  scope: string;
  tokenUrl: string;
}

export class OAuth2ServiceAccountProvider implements AuthProvider {
  readonly name = 'OAuth2ServiceAccount';

  private cachedToken: CachedToken | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;
  private readonly TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

  constructor(private readonly config: OAuth2ServiceAccountConfig) {}

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.tokenUrl);
  }

  async getHeaders(_method: string, _url: string, _body?: string): Promise<AuthHeaders> {
    const token = await this.getValidToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  invalidateCache(): void {
    this.cachedToken = null;
    this.tokenRefreshPromise = null;
  }

  private async getValidToken(): Promise<string> {
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.refreshToken();

    try {
      return await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private isTokenValid(token: CachedToken): boolean {
    return Date.now() < token.expiresAt - this.TOKEN_REFRESH_MARGIN_MS;
  }

  private async refreshToken(): Promise<string> {
    const logger = getLogger();

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AuthError(`Échec récupération token OAuth2: ${response.status} - ${errorText}`, this.name);
    }

    const data = (await response.json()) as TokenResponse;

    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    logger.info({ provider: this.name, expiresIn: data.expires_in }, 'Token OAuth2 obtenu');

    return data.access_token;
  }
}
