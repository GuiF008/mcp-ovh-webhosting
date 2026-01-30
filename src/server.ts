#!/usr/bin/env node
/**
 * Serveur MCP OVHcloud Web Hosting
 * Point d'entrée principal
 * 
 * Supporte deux modes de transport :
 * - stdio : pour Cursor, Claude Desktop (par défaut)
 * - http : pour SHAI et autres clients HTTP (expose /mcp endpoint)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';

import { loadConfig, getApiBaseUrl, Config } from './config.js';
import { initLogger, getLogger, Logger } from './logger.js';
import { createOvhClient, OvhClient } from './ovh/client.js';
import { createAuthProvider } from './ovh/auth/index.js';
import { extractBearerToken, withBearerTokenAsync } from './ovh/auth/bearerPassthrough.js';
import {
  getToolDefinitions,
  executeToolHandler,
  formatToolError,
} from './tools/index.js';

/**
 * Configure les handlers MCP sur le serveur
 */
function setupMcpHandlers(
  server: Server,
  client: OvhClient,
  config: Config,
  logger: Logger
): void {
  const toolDefinitions = getToolDefinitions(config.enableWriteTools);

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
}

/**
 * Démarre le serveur MCP en mode stdio
 */
async function startStdioServer(config: Config, logger: Logger): Promise<void> {
  logger.info('Démarrage du serveur MCP en mode stdio');

  const authProvider = createAuthProvider(config);
  logger.info({ provider: authProvider.name }, 'Provider d\'authentification initialisé');

  const client = createOvhClient({
    baseUrl: getApiBaseUrl(config),
    authProvider,
    timeoutMs: config.httpTimeoutMs,
    maxRetries: config.maxRetries,
  });

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

  setupMcpHandlers(server, client, config, logger);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Serveur MCP stdio connecté et prêt');
}

/**
 * Démarre le serveur MCP en mode HTTP (pour SHAI)
 */
async function startHttpServer(config: Config, logger: Logger): Promise<void> {
  const { httpPort, httpPath, httpHost } = config;

  logger.info(
    { port: httpPort, path: httpPath, host: httpHost },
    'Démarrage du serveur MCP en mode HTTP'
  );

  const authProvider = createAuthProvider(config);
  logger.info({ provider: authProvider.name }, 'Provider d\'authentification initialisé');

  const client = createOvhClient({
    baseUrl: getApiBaseUrl(config),
    authProvider,
    timeoutMs: config.httpTimeoutMs,
    maxRetries: config.maxRetries,
  });

  const app = express();
  
  // Middleware pour parser le JSON
  app.use(express.json());

  // Middleware de logging
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, path: req.path }, 'Requête HTTP reçue');
    next();
  });

  // Map pour stocker les transports SSE actifs
  const sseTransports = new Map<string, SSEServerTransport>();

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', transport: 'http', version: '1.0.0' });
  });

  // Info endpoint
  app.get('/info', (_req, res) => {
    const toolDefinitions = getToolDefinitions(config.enableWriteTools);
    res.json({
      name: 'mcp-ovh-webhosting',
      version: '1.0.0',
      transport: 'http',
      tools: toolDefinitions.map(t => t.name),
      writeEnabled: config.enableWriteTools,
    });
  });

  // SSE endpoint pour MCP
  app.get(httpPath, async (req: Request, res: Response) => {
    logger.info('Nouvelle connexion SSE MCP');

    // Extraire le bearer token
    const bearerToken = extractBearerToken(req.headers.authorization);

    if (config.authMode === 'bearer' && !bearerToken) {
      logger.warn('Connexion SSE refusée: bearer token manquant');
      res.status(401).json({ error: 'Bearer token required' });
      return;
    }

    // Créer un nouveau serveur MCP pour cette connexion
    const mcpServer = new Server(
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

    // Wrapper les handlers pour injecter le bearer token dans le contexte
    const wrappedClient = client;
    
    // Setup handlers avec le contexte bearer
    const toolDefinitions = getToolDefinitions(config.enableWriteTools);

    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Requête ListTools reçue (HTTP)');
      return { tools: toolDefinitions };
    });

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug({ tool: name }, 'Requête CallTool reçue (HTTP)');

      try {
        // Exécuter avec le bearer token dans le contexte
        const result = await withBearerTokenAsync(bearerToken || '', async () => {
          return executeToolHandler(name, wrappedClient, args, config.enableWriteTools);
        });

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
        logger.error({ tool: name, error: mcpError }, 'Erreur lors de l\'exécution du tool (HTTP)');

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

    // Créer le transport SSE
    const transport = new SSEServerTransport(httpPath, res);
    const sessionId = Math.random().toString(36).substring(7);
    sseTransports.set(sessionId, transport);

    // Nettoyer à la déconnexion
    res.on('close', () => {
      logger.info({ sessionId }, 'Connexion SSE fermée');
      sseTransports.delete(sessionId);
    });

    // Connecter le serveur au transport
    await mcpServer.connect(transport);
    logger.info({ sessionId }, 'Serveur MCP SSE connecté');
  });

  // POST endpoint pour les messages MCP
  app.post(httpPath, async (req: Request, res: Response) => {
    const bearerToken = extractBearerToken(req.headers.authorization);

    if (config.authMode === 'bearer' && !bearerToken) {
      res.status(401).json({ error: 'Bearer token required' });
      return;
    }

    // Trouver le transport SSE associé (via session header ou autre mécanisme)
    // Pour simplifier, on utilise le premier transport actif
    const transport = sseTransports.values().next().value;

    if (!transport) {
      res.status(400).json({ error: 'No active SSE connection' });
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      logger.error({ error }, 'Erreur lors du traitement du message POST');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Démarrer le serveur HTTP
  app.listen(httpPort, httpHost, () => {
    logger.info(
      { url: `http://${httpHost}:${httpPort}${httpPath}` },
      'Serveur MCP HTTP démarré'
    );
    // eslint-disable-next-line no-console
    console.log(`MCP Server is running on http://${httpHost}:${httpPort}${httpPath}`);
  });
}

/**
 * Point d'entrée principal
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = initLogger(config.logLevel);

  logger.info(
    {
      transport: config.transport,
      authMode: config.authMode,
      region: config.apiRegion,
      writeEnabled: config.enableWriteTools,
    },
    'Démarrage du serveur MCP OVHcloud Web Hosting'
  );

  const toolDefinitions = getToolDefinitions(config.enableWriteTools);
  logger.info({ toolsCount: toolDefinitions.length }, 'Tools MCP chargés');

  if (config.transport === 'http') {
    await startHttpServer(config, logger);
  } else {
    await startStdioServer(config, logger);
  }
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
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Échec du démarrage du serveur:', error);
  process.exit(1);
});
