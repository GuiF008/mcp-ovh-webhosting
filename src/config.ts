/**
 * Configuration du serveur MCP OVHcloud Web Hosting
 * Charge et valide les variables d'environnement au démarrage
 */

import { z } from 'zod';

// Schéma de validation pour le mode OAuth2
const OAuth2ConfigSchema = z.object({
  clientId: z.string().min(1, 'OVH_OAUTH_CLIENT_ID est requis pour le mode oauth2'),
  clientSecret: z.string().min(1, 'OVH_OAUTH_CLIENT_SECRET est requis pour le mode oauth2'),
  scope: z.string().default('all'),
  tokenUrl: z.string().url().optional(),
});

// Schéma de validation pour le mode AK/AS/CK
const AkAsCkConfigSchema = z.object({
  appKey: z.string().min(1, 'OVH_APP_KEY est requis pour le mode akasck'),
  appSecret: z.string().min(1, 'OVH_APP_SECRET est requis pour le mode akasck'),
  consumerKey: z.string().min(1, 'OVH_CONSUMER_KEY est requis pour le mode akasck'),
});

// Schéma principal de configuration
const ConfigSchema = z
  .object({
    // Mode d'authentification
    authMode: z.enum(['oauth2', 'akasck']).default('oauth2'),

    // Région API
    apiRegion: z.enum(['eu', 'ca']).default('eu'),

    // URL de base API (optionnel, auto-détecté)
    apiBaseUrl: z.string().url().optional(),

    // Configuration HTTP
    httpTimeoutMs: z.coerce.number().int().positive().default(30000),
    maxRetries: z.coerce.number().int().min(0).max(10).default(3),

    // Feature flags
    enableWriteTools: z
      .string()
      .transform((v) => v.toLowerCase() === 'true')
      .default('false'),

    // Logging
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

    // OAuth2 config (optionnel selon le mode)
    oauth2: OAuth2ConfigSchema.optional(),

    // AK/AS/CK config (optionnel selon le mode)
    akasck: AkAsCkConfigSchema.optional(),
  })
  .refine(
    (data) => {
      // Validation conditionnelle selon le mode
      if (data.authMode === 'oauth2') {
        return data.oauth2 !== undefined;
      }
      if (data.authMode === 'akasck') {
        return data.akasck !== undefined;
      }
      return true;
    },
    {
      message: 'Configuration auth manquante pour le mode sélectionné',
    }
  );

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Charge la configuration depuis les variables d'environnement
 */
export function loadConfig(): Config {
  const authMode = process.env.OVH_AUTH_MODE || 'oauth2';

  // Préparer l'objet de configuration brut
  const rawConfig: Record<string, unknown> = {
    authMode,
    apiRegion: process.env.OVH_API_REGION,
    apiBaseUrl: process.env.OVH_API_BASE_URL,
    httpTimeoutMs: process.env.OVH_HTTP_TIMEOUT_MS,
    maxRetries: process.env.OVH_MAX_RETRIES,
    enableWriteTools: process.env.ENABLE_WRITE_TOOLS,
    logLevel: process.env.LOG_LEVEL,
  };

  // Charger la config OAuth2 si le mode est oauth2
  if (authMode === 'oauth2') {
    rawConfig.oauth2 = {
      clientId: process.env.OVH_OAUTH_CLIENT_ID,
      clientSecret: process.env.OVH_OAUTH_CLIENT_SECRET,
      scope: process.env.OVH_OAUTH_SCOPE,
      tokenUrl: process.env.OVH_OAUTH_TOKEN_URL,
    };
  }

  // Charger la config AK/AS/CK si le mode est akasck
  if (authMode === 'akasck') {
    rawConfig.akasck = {
      appKey: process.env.OVH_APP_KEY,
      appSecret: process.env.OVH_APP_SECRET,
      consumerKey: process.env.OVH_CONSUMER_KEY,
    };
  }

  // Valider et parser la configuration
  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Erreur de configuration:\n${errors}`);
  }

  return result.data;
}

/**
 * Retourne l'URL de base de l'API OVH selon la région
 */
export function getApiBaseUrl(config: Config): string {
  if (config.apiBaseUrl) {
    return config.apiBaseUrl;
  }

  // URLs par défaut selon la région et le mode auth
  const isOAuth2 = config.authMode === 'oauth2';

  if (config.apiRegion === 'eu') {
    return isOAuth2 ? 'https://eu.api.ovh.com/v1' : 'https://eu.api.ovh.com/1.0';
  }

  return isOAuth2 ? 'https://ca.api.ovh.com/v1' : 'https://ca.api.ovh.com/1.0';
}

/**
 * Retourne l'URL du token OAuth2 selon la région
 */
export function getOAuth2TokenUrl(config: Config): string {
  if (config.oauth2?.tokenUrl) {
    return config.oauth2.tokenUrl;
  }

  return config.apiRegion === 'eu'
    ? 'https://www.ovh.com/auth/oauth2/token'
    : 'https://ca.ovh.com/auth/oauth2/token';
}
