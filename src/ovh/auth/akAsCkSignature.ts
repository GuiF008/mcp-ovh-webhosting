/**
 * Provider d'authentification AK/AS/CK pour OVHcloud
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

  private timeDelta: number | null = null;

  constructor(private readonly config: AkAsCkConfig) {}

  isConfigured(): boolean {
    return !!(this.config.appKey && this.config.appSecret && this.config.consumerKey && this.config.apiBaseUrl);
  }

  async getHeaders(method: string, url: string, body?: string): Promise<AuthHeaders> {
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
    this.timeDelta = null;
  }

  private computeSignature(method: string, url: string, body: string, timestamp: number): string {
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

  private async syncTime(): Promise<void> {
    const logger = getLogger();

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/auth/time`);
      if (response.ok) {
        const serverTime = (await response.json()) as number;
        this.timeDelta = serverTime - Math.floor(Date.now() / 1000);
        logger.info({ delta: this.timeDelta }, 'Temps synchronisé avec OVH');
      }
    } catch {
      this.timeDelta = 0;
      logger.warn('Synchronisation temps échouée, utilisation temps local');
    }
  }
}

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

export async function requestCredential(
  apiBaseUrl: string,
  appKey: string,
  request: CredentialRequest
): Promise<CredentialResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/credential`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ovh-Application': appKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AuthError(`Échec demande credential: ${response.status} - ${errorText}`, 'CredentialRequest');
  }

  return (await response.json()) as CredentialResponse;
}
