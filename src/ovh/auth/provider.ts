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
   * @param method - Méthode HTTP (GET, POST, PUT, DELETE)
   * @param url - URL complète de la requête
   * @param body - Corps de la requête (optionnel)
   * @returns Headers d'authentification
   */
  getHeaders(method: string, url: string, body?: string): Promise<AuthHeaders>;

  /**
   * Vérifie si le provider est correctement configuré
   * @returns true si le provider est prêt à être utilisé
   */
  isConfigured(): boolean;

  /**
   * Invalide le cache d'authentification (si applicable)
   * Utile pour forcer un refresh après une erreur 401
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