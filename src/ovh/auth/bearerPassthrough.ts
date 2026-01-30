/**
 * Provider d'authentification Bearer Passthrough pour SHAI
 * 
 * Ce provider utilise le bearer token passé par le client MCP (SHAI)
 * pour authentifier les requêtes vers l'API OVH.
 * 
 * Le token est extrait de la requête HTTP entrante et transmis
 * tel quel à l'API OVH (passthrough).
 */

import { AuthProvider, AuthHeaders } from './provider.js';
import { getLogger } from '../../logger.js';

/**
 * Storage thread-local pour le bearer token de la requête courante
 * Utilise AsyncLocalStorage pour isoler le token par requête
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface BearerContext {
  token: string;
}

// Storage global pour le contexte bearer par requête
export const bearerStorage = new AsyncLocalStorage<BearerContext>();

/**
 * Provider qui transmet le bearer token reçu du client MCP vers l'API OVH
 */
export class BearerPassthroughProvider implements AuthProvider {
  readonly name = 'BearerPassthrough';

  isConfigured(): boolean {
    // Toujours configuré, le token vient de la requête
    return true;
  }

  async getHeaders(_method: string, _url: string, _body?: string): Promise<AuthHeaders> {
    const context = bearerStorage.getStore();
    
    if (!context?.token) {
      throw new Error(
        'Aucun bearer token disponible. En mode HTTP, le client doit fournir un bearer_token.'
      );
    }

    getLogger().debug(
      { provider: this.name, hasToken: true },
      'Utilisation du bearer token passthrough'
    );

    return {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    };
  }

  invalidateCache(): void {
    // Pas de cache en mode passthrough
  }
}

/**
 * Exécute une fonction dans un contexte avec le bearer token
 * @param token - Le bearer token à utiliser
 * @param fn - La fonction à exécuter
 */
export function withBearerToken<T>(token: string, fn: () => T): T {
  return bearerStorage.run({ token }, fn);
}

/**
 * Version async de withBearerToken
 */
export async function withBearerTokenAsync<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return bearerStorage.run({ token }, fn);
}

/**
 * Extrait le bearer token d'un header Authorization
 * @param authHeader - Le header Authorization (format: "Bearer <token>")
 * @returns Le token ou undefined si invalide
 */
export function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) {
    return undefined;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
