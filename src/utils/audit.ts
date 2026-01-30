/**
 * Audit logging pour le serveur MCP
 */

import { getLogger, Logger } from '../logger.js';

export interface AuditContext {
  tool: string;
  tenant?: string;
  serviceName?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditHandle {
  success: (metadata?: Record<string, unknown>) => void;
  error: (error: Error | string, errorCode?: string | number) => void;
}

class AuditLogger {
  private readonly logger: Logger;

  constructor() {
    this.logger = getLogger().child({ component: 'Audit' });
  }

  startAudit(context: AuditContext): AuditHandle {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    return {
      success: (metadata?: Record<string, unknown>) => {
        this.logger.info({
          auditType: 'tool_call',
          timestamp,
          tool: context.tool,
          serviceName: context.serviceName,
          status: 'success',
          durationMs: Date.now() - startTime,
          ...metadata,
        });
      },
      error: (error: Error | string, errorCode?: string | number) => {
        this.logger.warn({
          auditType: 'tool_call',
          timestamp,
          tool: context.tool,
          serviceName: context.serviceName,
          status: 'error',
          durationMs: Date.now() - startTime,
          errorCode,
          errorMessage: typeof error === 'string' ? error : error.message,
        });
      },
    };
  }
}

let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) auditLoggerInstance = new AuditLogger();
  return auditLoggerInstance;
}

export async function withAudit<T>(context: AuditContext, fn: () => Promise<T>): Promise<T> {
  const audit = getAuditLogger().startAudit(context);
  try {
    const result = await fn();
    audit.success();
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    audit.error(err);
    throw error;
  }
}
