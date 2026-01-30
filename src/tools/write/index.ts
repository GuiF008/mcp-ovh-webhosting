/**
 * Index des tools write MCP (nécessite ENABLE_WRITE_TOOLS=true)
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { withAudit } from '../../utils/audit.js';
import {
  serviceNameSchema,
  databaseNameSchema,
  domainSchema,
  pathSchema,
  cdnStatusSchema,
  firewallStatusSchema,
  ipLocationSchema,
  databaseCapacitySchema,
  databaseTypeSchema,
  databaseQuotaSchema,
  dumpTypeSchema,
  numericIdSchema,
  validateInput,
} from '../../utils/validation.js';

export const writeToolDefs = [
  {
    name: 'ovh.webhosting.attachDomain',
    description: '[WRITE] Attache un domaine à un service Web Hosting',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        domain: { type: 'string' },
        cdn: { type: 'string', enum: ['active', 'none'] },
        firewall: { type: 'string', enum: ['active', 'none'] },
        path: { type: 'string' },
        ssl: { type: 'boolean' },
      },
      required: ['serviceName'],
    },
  },
  {
    name: 'ovh.webhosting.installSsl',
    description: '[WRITE] Installe un certificat SSL',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        certificate: { type: 'string' },
        chain: { type: 'string' },
        key: { type: 'string' },
      },
      required: ['serviceName'],
    },
  },
  {
    name: 'ovh.webhosting.createDatabase',
    description: '[WRITE] Crée une base de données',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        capacity: { type: 'string', enum: ['extraSqlPersonal', 'local', 'privateDatabase', 'sqlLocal', 'sqlPersonal', 'sqlPro'] },
        user: { type: 'string' },
        type: { type: 'string', enum: ['mariadb', 'mysql', 'postgresql', 'redis'] },
        password: { type: 'string' },
        quota: { type: 'string' },
      },
      required: ['serviceName', 'capacity', 'user', 'type'],
    },
  },
  {
    name: 'ovh.webhosting.createDatabaseDump',
    description: '[WRITE] Crée un dump de base de données',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        name: { type: 'string' },
        date: { type: 'string', enum: ['daily.1', 'now', 'weekly.1'] },
        sendEmail: { type: 'boolean' },
      },
      required: ['serviceName', 'name', 'date'],
    },
  },
  {
    name: 'ovh.webhosting.restoreDatabaseDump',
    description: '[WRITE] [DESTRUCTIF] Restaure un dump vers une base de données',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        name: { type: 'string' },
        id: { type: 'number' },
      },
      required: ['serviceName', 'name', 'id'],
    },
  },
  {
    name: 'ovh.webhosting.installModule',
    description: '[WRITE] Installe un module (WordPress, etc.)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceName: { type: 'string' },
        moduleId: { type: 'number' },
        domain: { type: 'string' },
        language: { type: 'string' },
        path: { type: 'string' },
      },
      required: ['serviceName', 'moduleId'],
    },
  },
];

// Handlers
export async function attachDomainHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({
    serviceName: serviceNameSchema,
    domain: domainSchema.optional(),
    cdn: cdnStatusSchema.optional(),
    firewall: firewallStatusSchema.optional(),
    ipLocation: ipLocationSchema.optional(),
    path: pathSchema,
    ssl: z.boolean().optional(),
  });
  const { serviceName, ...body } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.attachDomain', serviceName }, async () => {
    const response = await client.post(`/hosting/web/${encodeURIComponent(serviceName)}/attachedDomain`, { body });
    return response.data;
  });
}

export async function installSslHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({
    serviceName: serviceNameSchema,
    certificate: z.string().optional(),
    chain: z.string().optional(),
    key: z.string().optional(),
  });
  const { serviceName, ...body } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.installSsl', serviceName }, async () => {
    const requestBody = Object.keys(body).length > 0 ? body : undefined;
    const response = await client.post(`/hosting/web/${encodeURIComponent(serviceName)}/ssl`, { body: requestBody });
    return response.data;
  });
}

export async function createDatabaseHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({
    serviceName: serviceNameSchema,
    capacity: databaseCapacitySchema,
    user: z.string().min(1).max(32),
    type: databaseTypeSchema,
    password: z.string().min(8).max(128).optional(),
    quota: databaseQuotaSchema.optional(),
    version: z.string().optional(),
  });
  const { serviceName, ...body } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.createDatabase', serviceName }, async () => {
    const response = await client.post(`/hosting/web/${encodeURIComponent(serviceName)}/database`, { body });
    return response.data;
  });
}

export async function createDatabaseDumpHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({
    serviceName: serviceNameSchema,
    name: databaseNameSchema,
    date: dumpTypeSchema,
    sendEmail: z.boolean().optional(),
  });
  const { serviceName, name, ...body } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.createDatabaseDump', serviceName }, async () => {
    const response = await client.post(`/hosting/web/${encodeURIComponent(serviceName)}/database/${encodeURIComponent(name)}/dump`, { body });
    return response.data;
  });
}

export async function restoreDatabaseDumpHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({
    serviceName: serviceNameSchema,
    name: databaseNameSchema,
    id: numericIdSchema,
  });
  const { serviceName, name, id } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.restoreDatabaseDump', serviceName, metadata: { destructive: true } }, async () => {
    const response = await client.post(`/hosting/web/${encodeURIComponent(serviceName)}/database/${encodeURIComponent(name)}/dump/${id}/restore`);
    return response.data;
  });
}

export async function installModuleHandler(client: OvhClient, input: unknown): Promise<unknown> {
  const schema = z.object({
    serviceName: serviceNameSchema,
    moduleId: numericIdSchema,
    domain: domainSchema.optional(),
    language: z.string().min(2).max(10).optional(),
    path: pathSchema,
    adminName: z.string().optional(),
    adminPassword: z.string().optional(),
  });
  const { serviceName, ...body } = validateInput(schema, input);
  return withAudit({ tool: 'ovh.webhosting.installModule', serviceName }, async () => {
    const response = await client.post(`/hosting/web/${encodeURIComponent(serviceName)}/module`, { body });
    return response.data;
  });
}
