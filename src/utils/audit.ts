/**
 * Audit logging pour le serveur MCP
 * Trace les appels de tools avec métriques (sans secrets)
 */

import { getLogger, Logger } from '../logger.js';

/**
 * Entrée d'audit log
 */
export interface AuditEntry {
  /** Timestamp de début */
  timestamp: string;
  /** Nom du tool appelé */
  tool: string;
  /** Identifiant du tenant (pour futur multi-tenant) */
  tenant?: string;
  /** Service OVH concerné (si applicable) */
  serviceName?: string;
  /** Statut de l'appel */
  status: 'success' | 'error';
  /** Durée en ms */
  durationMs: number;
  /** Code d'erreur (si erreur) */
  errorCode?: string | number;
  /** Message d'erreur (si erreur) */
  errorMessage?: string;
  /** Metadata additionnelle (sans secrets) */
  metadata?: Record<string, unknown>;
}

/**
 * Contexte d'un appel de tool pour l'audit
 */
export interface AuditContext {
  tool: string;
  tenant?: string;
  serviceName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Classe pour la gestion de l'audit logging
 */
export class AuditLogger {
  private readonly logger: Logger;

  constructor() {
    this.logger = getLogger().child({ component: 'Audit' });
  }

  /**
   * Démarre un contexte d'audit et retourne une fonction pour le terminer
   */
  startAudit(context: AuditContext): AuditHandle {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    return {
      success: (metadata?: Record<string, unknown>) => {
        this.logEntry({
          timestamp,
          tool: context.tool,
          tenant: context.tenant,
          serviceName: context.serviceName,
          status: 'success',
          durationMs: Date.now() - startTime,
          metadata: { ...context.metadata, ...metadata },
        });
      },
      error: (error: Error | string, errorCode?: string | number) => {
        const errorMessage = typeof error === 'string' ? error : error.message;
        this.logEntry({
          timestamp,
          tool: context.tool,
          tenant: context.tenant,
          serviceName: context.serviceName,
          status: 'error',
          durationMs: Date.now() - startTime,
          errorCode,
          errorMessage,
          metadata: context.metadata,
        });
      },
    };
  }

  /**
   * Log une entrée d'audit
   */
  private logEntry(entry: AuditEntry): void {
    const logData = {
      auditType: 'tool_call',
      ...entry,
    };

    if (entry.status === 'success') {
      this.logger.info(logData, `Tool ${entry.tool} exécuté avec succès`);
    } else {
      this.logger.warn(logData, `Tool ${entry.tool} en erreur: ${entry.errorMessage}`);
    }
  }
}

/**
 * Handle retourné par startAudit pour terminer l'audit
 */
export interface AuditHandle {
  /** Termine l'audit avec succès */
  success: (metadata?: Record<string, unknown>) => void;
  /** Termine l'audit avec une erreur */
  error: (error: Error | string, errorCode?: string | number) => void;
}

// Instance singleton
let auditLoggerInstance: AuditLogger | null = null;

/**
 * Retourne l'instance singleton de l'AuditLogger
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

/**
 * Wrapper pour exécuter une fonction avec audit automatique
 */
export async function withAudit<T>(
  context: AuditContext,
  fn: () => Promise<T>
): Promise<T> {
  const audit = getAuditLogger().startAudit(context);

  try {
    const result = await fn();
    audit.success();
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorCode = (error as { code?: string | number })?.code;
    audit.error(err, errorCode);
    throw error;
  }
}
