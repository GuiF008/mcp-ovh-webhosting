/**
 * Provider d'authentification OAuth2 Service Account pour OVHcloud
 * Basé sur le guide : https://help.ovhcloud.com/csm/en-api-service-account-connection
 *
 * Utilise le client credentials flow :
 * - POST https://www.ovh.com/auth/oauth2/token (EU) ou https://ca.ovh.com/auth/oauth2/token (CA)
 * - grant_type=client_credentials, client_id, client_secret, scope
 * - Retourne access_token avec expires_in
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
  expiresAt: number; // timestamp ms
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

  // Marge de sécurité avant expiration (60 secondes)
  private readonly TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

  constructor(private readonly config: OAuth2ServiceAccountConfig) {}

  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.tokenUrl
    );
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
    getLogger().debug({ provider: this.name }, 'Cache token invalidé');
  }

  /**
   * Retourne un token valide (depuis le cache ou en le rafraîchissant)
   */
  private async getValidToken(): Promise<string> {
    // Vérifier si le token en cache est encore valide
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    // Éviter les appels concurrents pour refresh le token
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Refresh le token
    this.tokenRefreshPromise = this.refreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Vérifie si un token est encore valide (avec marge de sécurité)
   */
  private isTokenValid(token: CachedToken): boolean {
    return Date.now() < token.expiresAt - this.TOKEN_REFRESH_MARGIN_MS;
  }

  /**
   * Récupère un nouveau token OAuth2 via client credentials flow
   */
  private async refreshToken(): Promise<string> {
    const logger = getLogger();

    logger.debug(
      { provider: this.name, tokenUrl: this.config.tokenUrl },
      'Récupération du token OAuth2'
    );

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
    });

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AuthError(
          `Échec récupération token OAuth2: ${response.status} - ${errorText}`,
          this.name
        );
      }

      const data = (await response.json()) as TokenResponse;

      if (!data.access_token) {
        throw new AuthError('Réponse OAuth2 invalide: access_token manquant', this.name);
      }

      // Mettre en cache le token
      this.cachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      logger.info(
        {
          provider: this.name,
          expiresIn: data.expires_in,
          scope: data.scope,
        },
        'Token OAuth2 obtenu avec succès'
      );

      return data.access_token;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError(
        `Erreur lors de la récupération du token OAuth2: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }
}
