/**
 * Index principal des tools MCP OVHcloud Web Hosting
 * Gère l'enregistrement des tools et le dispatch des handlers
 */

import { OvhClient } from '../ovh/client.js';
import { OvhApiError, ValidationError } from '../ovh/errors.js';
import { getLogger } from '../logger.js';

// Import des tools read-only
import {
  readOnlyToolDefs,
  listServicesHandler,
  getServiceHandler,
  getActiveConfigurationHandler,
  listDatabasesHandler,
  listFtpUsersHandler,
  listModuleCatalogHandler,
  getModuleCatalogItemHandler,
  listDatabaseDumpsHandler,
} from './read-only/index.js';

// Import des tools write (à activer via feature flag)
import {
  writeToolDefs,
  attachDomainHandler,
  installSslHandler,
  createDatabaseHandler,
  createDatabaseDumpHandler,
  restoreDatabaseDumpHandler,
  installModuleHandler,
} from './write/index.js';

export { readOnlyToolDefs } from './read-only/index.js';
export { writeToolDefs } from './write/index.js';

/**
 * Map des handlers par nom de tool
 */
type ToolHandler = (client: OvhClient, input: unknown) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {
  // Read-only tools
  'ovh.webhosting.listServices': listServicesHandler,
  'ovh.webhosting.getService': getServiceHandler,
  'ovh.webhosting.getActiveConfiguration': getActiveConfigurationHandler,
  'ovh.webhosting.listDatabases': listDatabasesHandler,
  'ovh.webhosting.listFtpUsers': listFtpUsersHandler,
  'ovh.webhosting.listModuleCatalog': listModuleCatalogHandler,
  'ovh.webhosting.getModuleCatalogItem': getModuleCatalogItemHandler,
  'ovh.webhosting.listDatabaseDumps': listDatabaseDumpsHandler,

  // Write tools
  'ovh.webhosting.attachDomain': attachDomainHandler,
  'ovh.webhosting.installSsl': installSslHandler,
  'ovh.webhosting.createDatabase': createDatabaseHandler,
  'ovh.webhosting.createDatabaseDump': createDatabaseDumpHandler,
  'ovh.webhosting.restoreDatabaseDump': restoreDatabaseDumpHandler,
  'ovh.webhosting.installModule': installModuleHandler,
};

/**
 * Retourne toutes les définitions de tools selon la configuration
 */
export function getToolDefinitions(enableWriteTools: boolean): typeof readOnlyToolDefs {
  if (enableWriteTools) {
    return [...readOnlyToolDefs, ...writeToolDefs];
  }
  return readOnlyToolDefs;
}

/**
 * Exécute un tool par son nom
 */
export async function executeToolHandler(
  toolName: string,
  client: OvhClient,
  input: unknown,
  enableWriteTools: boolean
): Promise<unknown> {
  const logger = getLogger();

  // Vérifier si le tool existe
  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new ValidationError(`Tool inconnu: ${toolName}`);
  }

  // Vérifier si c'est un tool write et si les writes sont activés
  const isWriteTool = writeToolDefs.some((t) => t.name === toolName);
  if (isWriteTool && !enableWriteTools) {
    throw new ValidationError(
      `Tool "${toolName}" est un tool d'écriture. Activez ENABLE_WRITE_TOOLS=true pour l'utiliser.`
    );
  }

  logger.debug({ toolName, input }, 'Exécution du tool');

  try {
    const result = await handler(client, input);
    logger.debug({ toolName, success: true }, 'Tool exécuté avec succès');
    return result;
  } catch (error) {
    logger.error(
      {
        toolName,
        error: error instanceof Error ? error.message : 'Unknown',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
      'Erreur lors de l\'exécution du tool'
    );
    throw error;
  }
}

/**
 * Formate une erreur pour la réponse MCP
 */
export function formatToolError(error: unknown): { code: number; message: string; data?: unknown } {
  if (error instanceof OvhApiError) {
    return error.toMcpError();
  }

  if (error instanceof ValidationError) {
    return {
      code: -32602, // Invalid params
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: -32603, // Internal error
      message: error.message,
    };
  }

  return {
    code: -32603,
    message: 'Une erreur inconnue est survenue',
  };
}
