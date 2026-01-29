/**
 * Tool MCP : ovh.webhosting.createDatabase
 * Crée une nouvelle base de données sur un service Web Hosting
 *
 * OVH API : POST /hosting/web/{serviceName}/database
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import {
  serviceNameSchema,
  databaseCapacitySchema,
  databaseTypeSchema,
  databaseQuotaSchema,
  validateInput,
} from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const createDatabaseInputSchema = z.object({
  serviceName: serviceNameSchema,
  capacity: databaseCapacitySchema,
  user: z.string().min(1).max(32).regex(/^[a-zA-Z0-9_]+$/, 'user invalide'),
  type: databaseTypeSchema,
  password: z.string().min(8).max(128).optional(),
  quota: databaseQuotaSchema.optional(),
  version: z.string().optional(),
}).strict();

export type CreateDatabaseInput = z.infer<typeof createDatabaseInputSchema>;

// Type de sortie (tâche créée)
export interface DatabaseTask {
  id?: number;
  function?: string;
  status?: string;
  startDate?: string;
  doneDate?: string;
}

export type CreateDatabaseOutput = DatabaseTask;

/**
 * Définition du tool pour le serveur MCP
 */
export const createDatabaseToolDef = {
  name: 'ovh.webhosting.createDatabase',
  description: '[WRITE] Crée une nouvelle base de données sur un service Web Hosting. Nécessite ENABLE_WRITE_TOOLS=true.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      capacity: {
        type: 'string',
        enum: ['extraSqlPersonal', 'local', 'privateDatabase', 'sqlLocal', 'sqlPersonal', 'sqlPro'],
        description: 'Type de capacité de la base de données',
      },
      user: {
        type: 'string',
        description: 'Nom d\'utilisateur pour la base de données',
      },
      type: {
        type: 'string',
        enum: ['mariadb', 'mysql', 'postgresql', 'redis'],
        description: 'Type de base de données',
      },
      password: {
        type: 'string',
        description: 'Mot de passe (min 8 caractères). Si absent, un mot de passe sera généré.',
      },
      quota: {
        type: 'string',
        enum: ['25', '100', '200', '256', '400', '512', '800', '1024'],
        description: 'Quota en MB',
      },
      version: {
        type: 'string',
        description: 'Version de la base de données',
      },
    },
    required: ['serviceName', 'capacity', 'user', 'type'],
  },
};

/**
 * Handler du tool createDatabase
 */
export async function createDatabaseHandler(
  client: OvhClient,
  input: unknown
): Promise<CreateDatabaseOutput> {
  const validatedInput = validateInput(createDatabaseInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.createDatabase',
      serviceName: validatedInput.serviceName,
      metadata: {
        dbType: validatedInput.type,
        capacity: validatedInput.capacity,
        user: validatedInput.user,
      },
    },
    async () => {
      const { serviceName, ...body } = validatedInput;

      const response = await client.post<DatabaseTask>(
        `/hosting/web/${encodeURIComponent(serviceName)}/database`,
        { body }
      );
      return response.data;
    }
  );
}
