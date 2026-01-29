/**
 * Rate Limiter basé sur Token Bucket
 * Contrôle le débit des requêtes côté client MCP
 */

import { RateLimitError } from '../ovh/errors.js';
import { getLogger } from '../logger.js';

export interface RateLimiterConfig {
  /** Nombre max de tokens (capacité du bucket) */
  maxTokens: number;
  /** Tokens ajoutés par seconde */
  refillRate: number;
  /** Temps max d'attente en ms (0 = pas d'attente, échec immédiat) */
  maxWaitMs?: number;
}

/**
 * Implémentation Token Bucket pour rate limiting
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTime: number;

  constructor(private readonly config: RateLimiterConfig) {
    this.tokens = config.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Tente d'acquérir un token pour effectuer une requête
   * @param waitIfNeeded - Si true, attend qu'un token soit disponible
   * @returns true si un token a été acquis
   * @throws RateLimitError si pas de token disponible et waitIfNeeded=false
   */
  async acquire(waitIfNeeded: boolean = true): Promise<boolean> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    if (!waitIfNeeded || !this.config.maxWaitMs) {
      throw new RateLimitError('Rate limit atteint, réessayez plus tard');
    }

    // Calculer le temps d'attente pour avoir un token
    const tokensNeeded = 1 - this.tokens;
    const waitTimeMs = Math.ceil((tokensNeeded / this.config.refillRate) * 1000);

    if (waitTimeMs > this.config.maxWaitMs) {
      throw new RateLimitError(
        `Rate limit atteint, temps d'attente ${waitTimeMs}ms > max ${this.config.maxWaitMs}ms`
      );
    }

    getLogger().debug({ waitTimeMs }, 'Rate limiter: attente avant requête');

    await this.sleep(waitTimeMs);
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    throw new RateLimitError('Rate limit: impossible d\'acquérir un token après attente');
  }

  /**
   * Recharge les tokens selon le temps écoulé
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    const tokensToAdd = (elapsedMs / 1000) * this.config.refillRate;

    this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Retourne le nombre de tokens disponibles
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Réinitialise le bucket à sa capacité maximale
   */
  reset(): void {
    this.tokens = this.config.maxTokens;
    this.lastRefillTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Configuration par défaut du rate limiter
 * 30 requêtes par minute = 0.5 req/sec
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxTokens: 30,
  refillRate: 0.5, // 30 tokens par minute
  maxWaitMs: 5000, // Attente max 5 secondes
};

/**
 * Crée un rate limiter avec la configuration par défaut
 */
export function createDefaultRateLimiter(): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter(DEFAULT_RATE_LIMITER_CONFIG);
}
