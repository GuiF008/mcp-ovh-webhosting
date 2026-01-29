/**
 * Provider d'authentification AK/AS/CK (Application Key/Secret + Consumer Key) pour OVHcloud
 * Basé sur le guide : https://help.ovhcloud.com/csm/fr-api-getting-started-ovhcloud-api
 *
 * Signature : "$1$" + SHA1_HEX(AS + "+" + CK + "+" + METHOD + "+" + URL + "+" + BODY + "+" + TIMESTAMP)
 */

import { createHash } from 'crypto';
import { AuthProvider, AuthHeaders, AuthError } from './provider.js';
import { getLogger } from '../../logger.js';

export interface AkAsCkConfig {
  appKey: string;
  appSecret: string;
  consumerKey: string;
  apiBaseUrl: string;
}

export class AkAsCkSignatureProvider implements AuthProvider {
  readonly name = 'AkAsCkSignature';

  // Delta de temps avec le serveur OVH (calculé au premier appel)
  private timeDelta: number | null = null;

  constructor(private readonly config: AkAsCkConfig) {}

  isConfigured(): boolean {
    return !!(
      this.config.appKey &&
      this.config.appSecret &&
      this.config.consumerKey &&
      this.config.apiBaseUrl
    );
  }

  async getHeaders(method: string, url: string, body?: string): Promise<AuthHeaders> {
    // Synchroniser l'heure avec le serveur OVH si nécessaire
    if (this.timeDelta === null) {
      await this.syncTime();
    }

    const timestamp = Math.floor(Date.now() / 1000) + (this.timeDelta || 0);
    const signature = this.computeSignature(method, url, body || '', timestamp);

    return {
      'X-Ovh-Application': this.config.appKey,
      'X-Ovh-Consumer': this.config.consumerKey,
      'X-Ovh-Timestamp': timestamp.toString(),
      'X-Ovh-Signature': signature,
      'Content-Type': 'application/json',
    };
  }

  invalidateCache(): void {
    // Réinitialiser le delta de temps pour forcer une resynchronisation
    this.timeDelta = null;
    getLogger().debug({ provider: this.name }, 'Cache time delta invalidé');
  }

  /**
   * Calcule la signature OVH
   * Format : "$1$" + SHA1_HEX(AS + "+" + CK + "+" + METHOD + "+" + URL + "+" + BODY + "+" + TIMESTAMP)
   */
  private computeSignature(
    method: string,
    url: string,
    body: string,
    timestamp: number
  ): string {
    const toSign = [
      this.config.appSecret,
      this.config.consumerKey,
      method.toUpperCase(),
      url,
      body,
      timestamp.toString(),
    ].join('+');

    const hash = createHash('sha1').update(toSign).digest('hex');

    return `$1$${hash}`;
  }

  /**
   * Synchronise l'heure locale avec le serveur OVH
   * Nécessaire car la signature inclut un timestamp qui doit être proche de l'heure serveur
   */
  private async syncTime(): Promise<void> {
    const logger = getLogger();

    logger.debug({ provider: this.name }, 'Synchronisation du temps avec le serveur OVH');

    try {
      // Endpoint pour récupérer l'heure du serveur OVH
      const timeUrl = `${this.config.apiBaseUrl}/auth/time`;

      const response = await fetch(timeUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const serverTime = (await response.json()) as number;
      const localTime = Math.floor(Date.now() / 1000);

      this.timeDelta = serverTime - localTime;

      logger.info(
        {
          provider: this.name,
          serverTime,
          localTime,
          delta: this.timeDelta,
        },
        'Temps synchronisé avec le serveur OVH'
      );
    } catch (error) {
      // En cas d'erreur, on utilise un delta de 0
      logger.warn(
        {
          provider: this.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Impossible de synchroniser le temps avec OVH, utilisation du temps local'
      );

      this.timeDelta = 0;
    }
  }
}

/**
 * Utilitaire pour créer une demande de délégation de droits (consumer key)
 * Endpoint : POST /auth/credential
 */
export interface AccessRule {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
}

export interface CredentialRequest {
  accessRules: AccessRule[];
  redirection?: string;
}

export interface CredentialResponse {
  validationUrl: string;
  consumerKey: string;
  state: string;
}

/**
 * Crée une demande de consumer key pour la délégation de droits
 * Utile pour l'onboarding multi-tenant (Mode B)
 *
 * @param apiBaseUrl - URL de base de l'API OVH
 * @param appKey - Application Key
 * @param request - Configuration de la demande (accessRules, redirection)
 * @returns Réponse contenant validationUrl, consumerKey et state
 */
export async function requestCredential(
  apiBaseUrl: string,
  appKey: string,
  request: CredentialRequest
): Promise<CredentialResponse> {
  const logger = getLogger();

  logger.info(
    { appKey, rulesCount: request.accessRules.length },
    'Demande de consumer key pour délégation'
  );

  const url = `${apiBaseUrl}/auth/credential`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ovh-Application': appKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AuthError(
      `Échec demande credential: ${response.status} - ${errorText}`,
      'CredentialRequest'
    );
  }

  const data = (await response.json()) as CredentialResponse;

  logger.info(
    { validationUrl: data.validationUrl, state: data.state },
    'Consumer key créé, en attente de validation'
  );  return data;
}
