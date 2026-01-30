/**
 * Index principal des tools MCP OVHcloud Web Hosting
 */

import { OvhClient } from '../ovh/client.js';
import { OvhApiError, ValidationError } from '../ovh/errors.js';
import { getLogger } from '../logger.js';

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

import {
  writeToolDefs,
  attachDomainHandler,
  installSslHandler,
  createDatabaseHandler,
  createDatabaseDumpHandler,
  restoreDatabaseDumpHandler,
  installModuleHandler,
} from './write/index.js';

export { readOnlyToolDefs, writeToolDefs };

type ToolHandler = (client: OvhClient, input: unknown) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {
  'ovh.webhosting.listServices': listServicesHandler,
  'ovh.webhosting.getService': getServiceHandler,
  'ovh.webhosting.getActiveConfiguration': getActiveConfigurationHandler,
  'ovh.webhosting.listDatabases': listDatabasesHandler,
  'ovh.webhosting.listFtpUsers': listFtpUsersHandler,
  'ovh.webhosting.listModuleCatalog': listModuleCatalogHandler,
  'ovh.webhosting.getModuleCatalogItem': getModuleCatalogItemHandler,
  'ovh.webhosting.listDatabaseDumps': listDatabaseDumpsHandler,
  'ovh.webhosting.attachDomain': attachDomainHandler,
  'ovh.webhosting.installSsl': installSslHandler,
  'ovh.webhosting.createDatabase': createDatabaseHandler,
  'ovh.webhosting.createDatabaseDump': createDatabaseDumpHandler,
  'ovh.webhosting.restoreDatabaseDump': restoreDatabaseDumpHandler,
  'ovh.webhosting.installModule': installModuleHandler,
};

export function getToolDefinitions(enableWriteTools: boolean): typeof readOnlyToolDefs {
  if (enableWriteTools) {
    return [...readOnlyToolDefs, ...writeToolDefs];
  }
  return readOnlyToolDefs;
}

export async function executeToolHandler(
  toolName: string,
  client: OvhClient,
  input: unknown,
  enableWriteTools: boolean
): Promise<unknown> {
  const logger = getLogger();

  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new ValidationError(`Tool inconnu: ${toolName}`);
  }

  const isWriteTool = writeToolDefs.some((t) => t.name === toolName);
  if (isWriteTool && !enableWriteTools) {
    throw new ValidationError(`Tool "${toolName}" est désactivé. Activez ENABLE_WRITE_TOOLS=true.`);
  }

  logger.debug({ toolName }, 'Exécution du tool');

  try {
    const result = await handler(client, input);
    logger.debug({ toolName, success: true }, 'Tool exécuté');
    return result;
  } catch (error) {
    logger.error({ toolName, error: error instanceof Error ? error.message : 'Unknown' }, 'Erreur tool');
    throw error;
  }
}

export function formatToolError(error: unknown): { code: number; message: string; data?: unknown } {
  if (error instanceof OvhApiError) return error.toMcpError();
  if (error instanceof ValidationError) return { code: -32602, message: error.message };
  if (error instanceof Error) return { code: -32603, message: error.message };
  return { code: -32603, message: 'Erreur inconnue' };
}
