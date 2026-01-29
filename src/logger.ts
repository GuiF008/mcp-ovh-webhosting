/**
 * Logger structuré pour le serveur MCP OVHcloud Web Hosting
 * Utilise Pino pour des logs JSON performants avec masquage des secrets
 */

import pino from 'pino';

// Liste des clés à masquer dans les logs
const REDACTED_KEYS = [
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'appSecret',
  'consumerKey',
  'authorization',
  'apiKey',
  'key',
  'certificate',
  'privateKey',
];

// Créer le pattern de redaction pour Pino
const redactPaths = REDACTED_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
  `*.*.${key}`,
  `headers.${key}`,
  `headers.Authorization`,
  `body.${key}`,
  `body.*.${key}`,
]);

/**
 * Crée une instance de logger avec la configuration appropriée
 */
export function createLogger(level: string = 'info'): pino.Logger {
  return pino({
    level,
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // En dev, on peut utiliser pino-pretty pour des logs lisibles
    // En prod, on garde le JSON pour les outils d'analyse
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  });
}

// Instance singleton du logger
let loggerInstance: pino.Logger | null = null;

/**
 * Initialise le logger global avec le niveau spécifié
 */
export function initLogger(level: string = 'info'): pino.Logger {
  loggerInstance = createLogger(level);
  return loggerInstance;
}

/**
 * Retourne l'instance du logger global
 * Lance une erreur si le logger n'a pas été initialisé
 */
export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    // Initialiser avec le niveau par défaut si non initialisé
    loggerInstance = createLogger('info');
  }
  return loggerInstance;
}

/**
 * Crée un child logger avec un contexte spécifique
 */
export function createChildLogger(
  context: Record<string, unknown>,
  parent?: pino.Logger
): pino.Logger {
  const logger = parent || getLogger();
  return logger.child(context);
}

export type Logger = pino.Logger;
