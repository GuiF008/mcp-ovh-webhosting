#!/usr/bin/env node
/**
 * Serveur MCP OVHcloud Web Hosting
 * Point d'entrée principal
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, getApiBaseUrl } from './config.js';
import { initLogger, getLogger } from './logger.js';
import { createOvhClient, OvhClient } from './ovh/client.js';
import { createAuthProvider } from './ovh/auth/index.js';
import {
  getToolDefinitions,
  executeToolHandler,
  formatToolError,
} from './tools/index.js';

/**
 * Crée et configure le serveur MCP
 */
async function createMcpServer(): Promise<void> {
  // Charger la configuration
  const config = loadConfig();

  // Initialiser le logger
  const logger = initLogger(config.logLevel);
  logger.info({ authMode: config.authMode, region: config.apiRegion }, 'Démarrage du serveur MCP OVHcloud Web Hosting');

  // Créer le provider d'authentification
  const authProvider = createAuthProvider(config);
  logger.info({ provider: authProvider.name }, 'Provider d\'authentification initialisé');

  // Créer le client OVH
  const client = createOvhClient({
    baseUrl: getApiBaseUrl(config),
    authProvider,
    timeoutMs: config.httpTimeoutMs,
    maxRetries: config.maxRetries,
  });

  // Récupérer les définitions de tools
  const toolDefinitions = getToolDefinitions(config.enableWriteTools);
  logger.info(
    {
      toolsCount: toolDefinitions.length,
      writeEnabled: config.enableWriteTools,
    },
    'Tools MCP chargés'
  );

  // Créer le serveur MCP
  const server = new Server(
    {
      name: 'mcp-ovh-webhosting',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handler pour lister les tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Requête ListTools reçue');
    return {
      tools: toolDefinitions,
    };
  });

  // Handler pour appeler un tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug({ tool: name }, 'Requête CallTool reçue');

    try {
      const result = await executeToolHandler(name, client, args, config.enableWriteTools);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const mcpError = formatToolError(error);
      logger.error(
        { tool: name, error: mcpError },
        'Erreur lors de l\'exécution du tool'
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              code: mcpError.code,
              message: mcpError.message,
              data: mcpError.data,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Démarrer le transport stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Serveur MCP connecté et prêt');
}

// Gestion des erreurs non catchées
process.on('uncaughtException', (error) => {
  const logger = getLogger();
  logger.fatal({ error: error.message, stack: error.stack }, 'Erreur non catchée');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const logger = getLogger();
  logger.fatal({ reason }, 'Promise rejection non gérée');
  process.exit(1);
});

// Lancer le serveur
createMcpServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Échec du démarrage du serveur:', error);
  process.exit(1);
});
