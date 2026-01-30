/**
 * Interface AuthProvider pour l'authentification OVH
 * Abstraction permettant de supporter plusieurs modes d'auth
 */

/**
 * Headers d'authentification retournés par le provider
 */
export type AuthHeaders = Record<string, string>;

/**
 * Interface pour les providers d'authentification OVH
 */
export interface AuthProvider {
  /**
   * Nom du provider pour le logging
   */
  readonly name: string;

  /**
   * Génère les headers d'authentification pour une requête OVH
   */
  getHeaders(method: string, url: string, body?: string): Promise<AuthHeaders>;

  /**
   * Vérifie si le provider est correctement configuré
   */
  isConfigured(): boolean;

  /**
   * Invalide le cache d'authentification (si applicable)
   */
  invalidateCache?(): void;
}

/**
 * Erreur spécifique à l'authentification
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
