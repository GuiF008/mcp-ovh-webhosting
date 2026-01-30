/**
 * Index des tools read-only MCP
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { withAudit } from '../../utils/audit.js';
import {
  serviceNameSchema,
  databaseNameSchema,
  databaseModeSchema,
  moduleBranchSchema,
  dumpTypeSchema,
  numericIdSchema,
  loginSchema,
  validateInput,
} from '../../utils/validation.js';

// Tool definitions
export const readOnlyToolDefs = [
  {
    name: 'ovh.webhosting.listServices',
    description: 'Liste tous les services Web Hosting du compte OVH',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'ovh.webhosting.getService',
    description: 'Récupère les détails d\'un service Web Hosting',
    inputSchema: {
      type: 'object' as const,
      properties: { serviceName: { type: 'string', description: 'Nom du service' } },
      required: ['serviceName'],
    },
  },
  {
    name: 'ovh.webhosting.getActiveConfiguration',
    description: 'Récupère la configuration active d\'un service',
    inputSchema: {
      type: 'object' as const,
      properties: { serviceName: { type: 'string' } },
      required: ['serviceName'],
    },
  },
  {
    name: 'ovh.webhosting.listDatabases',
    description: 'Liste les bases de données d\'un service',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        mode: { type: 'string', enum: ['besteffort', 'classic', 'module'] },
      },
      required: ['serviceName', 'mode'],
    },
  },
  {
    name: 'ovh.webhosting.listFtpUsers',
    description: 'Liste les utilisateurs FTP/SSH',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        home: { type: 'string' },
        login: { type: 'string' },
      },
      required: ['serviceName'],
    },
  },
  {
    name: 'ovh.webhosting.listModuleCatalog',
    description: 'Liste les modules disponibles',
    inputSchema: {
      type: 'object' as const,
      properties: {
        active: { type: 'boolean' },
        branch: { type: 'string', enum: ['old', 'stable', 'testing'] },
        latest: { type: 'boolean' },
      },
      required: [],
    },
  },
  {
    name: 'ovh.webhosting.getModuleCatalogItem',
    description: 'Détails d\'un module du catalogue',
    inputSchema: {
      type: 'object' as const,
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  },
  {
    name: 'ovh.webhosting.listDatabaseDumps',
    description: 'Liste les dumps d\'une base de données',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['daily.1', 'now', 'weekly.1'] },
      },
      required: ['serviceName', 'name'],
    },
  },
];

// Handlers
export async function listServicesHandler(client: OvhClient, _input: unknown): Promise<string[]> {
  return withAudit({ tool: 'ovh.webhosting.listServices' }, async () => {
    const response = await client.get<string[]>('/hosting/web');
    return response.data;
  });
}

export async function getServiceHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({ serviceName: serviceNameSchema });
  const { serviceName } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.getService', serviceName }, async () => {
    const response = await client.get(`/hosting/web/${encodeURIComponent(serviceName)}`);
    return response.data;
  });
}

export async function getActiveConfigurationHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({ serviceName: serviceNameSchema });
  const { serviceName } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.getActiveConfiguration', serviceName }, async () => {
    const response = await client.get(`/hosting/web/${encodeURIComponent(serviceName)}/configuration`);
    return response.data;
  });
}

export async function listDatabasesHandler(client: OvhClient, input: unknown): Promise<string[]> {
  const schema = z.object({ serviceName: serviceNameSchema, mode: databaseModeSchema });
  const { serviceName, mode } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.listDatabases', serviceName }, async () => {
    const response = await client.get<string[]>(`/hosting/web/${encodeURIComponent(serviceName)}/database`, { query: { mode } });
    return response.data;
  });
}

export async function listFtpUsersHandler(client: OvhClient, input: unknown): Promise<string[]> {
  const schema = z.object({ serviceName: serviceNameSchema, home: z.string().optional(), login: loginSchema });
  const { serviceName, home, login } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.listFtpUsers', serviceName }, async () => {
    const query: Record<string, string | undefined> = {};
    if (home) query.home = home;
    if (login) query.login = login;
    const response = await client.get<string[]>(`/hosting/web/${encodeURIComponent(serviceName)}/user`, { query });
    return response.data;
  });
}

export async function listModuleCatalogHandler(client: OvhClient, input: unknown): Promise<number[]> {
  const schema = z.object({ active: z.boolean().optional(), branch: moduleBranchSchema.optional(), latest: z.boolean().optional() });
  const validated = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.listModuleCatalog' }, async () => {
    const response = await client.get<number[]>('/hosting/web/moduleList', { query: validated as Record<string, unknown> });
    return response.data;
  });
}

export async function getModuleCatalogItemHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({ id: numericIdSchema });
  const { id } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.getModuleCatalogItem' }, async () => {
    const response = await client.get(`/hosting/web/moduleList/${id}`);
    return response.data;
  });
}

export async function listDatabaseDumpsHandler(client: OvhClient, input: unknown): Promise<number[]> {
  const schema = z.object({ serviceName: serviceNameSchema, name: databaseNameSchema, type: dumpTypeSchema.optional() });
  const { serviceName, name, type } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.listDatabaseDumps', serviceName }, async () => {
    const query: Record<string, string | undefined> = {};
    if (type) query.type = type;
    const response = await client.get<number[]>(`/hosting/web/${encodeURIComponent(serviceName)}/database/${encodeURIComponent(name)}/dump`, { query });
    return response.data;
  });
}
