/**
 * Tool MCP : ovh.webhosting.createDatabaseDump
 * Crée un dump (sauvegarde) d'une base de données
 *
 * OVH API : POST /hosting/web/{serviceName}/database/{name}/dump
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import {
  serviceNameSchema,
  databaseNameSchema,
  dumpTypeSchema,
  validateInput,
} from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const createDatabaseDumpInputSchema = z.object({
  serviceName: serviceNameSchema,
  name: databaseNameSchema,
  date: dumpTypeSchema,
  sendEmail: z.boolean().optional(),
}).strict();

export type CreateDatabaseDumpInput = z.infer<typeof createDatabaseDumpInputSchema>;

// Type de sortie (tâche créée)
export interface DumpTask {
  id?: number;
  function?: string;
  status?: string;
  startDate?: string;
  doneDate?: string;
}

export type CreateDatabaseDumpOutput = DumpTask;

/**
 * Définition du tool pour le serveur MCP
 */
export const createDatabaseDumpToolDef = {
  name: 'ovh.webhosting.createDatabaseDump',
  description: '[WRITE] Crée un dump (sauvegarde) d\'une base de données. Nécessite ENABLE_WRITE_TOOLS=true.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      name: {
        type: 'string',
        description: 'Nom de la base de données',
      },
      date: {
        type: 'string',
        enum: ['daily.1', 'now', 'weekly.1'],
        description: 'Type de dump: daily.1 (journalier), now (instantané), weekly.1 (hebdomadaire)',
      },
      sendEmail: {
        type: 'boolean',
        description: 'Envoyer un email une fois le dump terminé',
      },
    },
    required: ['serviceName', 'name', 'date'],
  },
};

/**
 * Handler du tool createDatabaseDump
 */
export async function createDatabaseDumpHandler(
  client: OvhClient,
  input: unknown
): Promise<CreateDatabaseDumpOutput> {
  const validatedInput = validateInput(createDatabaseDumpInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.createDatabaseDump',
      serviceName: validatedInput.serviceName,
      metadata: {
        database: validatedInput.name,
        dumpType: validatedInput.date,
      },
    },
    async () => {
      const { serviceName, name, ...body } = validatedInput;

      const response = await client.post<DumpTask>(
        `/hosting/web/${encodeURIComponent(serviceName)}/database/${encodeURIComponent(name)}/dump`,
        { body }
      );
      return response.data;
    }
  );
}
