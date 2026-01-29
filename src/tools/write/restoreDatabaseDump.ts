/**
 * Tool MCP : ovh.webhosting.restoreDatabaseDump
 * Restaure un dump (sauvegarde) vers une base de données
 *
 * OVH API : POST /hosting/web/{serviceName}/database/{name}/dump/{id}/restore
 *
 * ⚠️ ATTENTION: Cette action est destructive et écrasera les données actuelles.
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import {
  serviceNameSchema,
  databaseNameSchema,
  numericIdSchema,
  validateInput,
} from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const restoreDatabaseDumpInputSchema = z.object({
  serviceName: serviceNameSchema,
  name: databaseNameSchema,
  id: numericIdSchema,
}).strict();

export type RestoreDatabaseDumpInput = z.infer<typeof restoreDatabaseDumpInputSchema>;

// Type de sortie (tâche créée)
export interface RestoreTask {
  id?: number;
  function?: string;
  status?: string;
  startDate?: string;
  doneDate?: string;
}

export type RestoreDatabaseDumpOutput = RestoreTask;

/**
 * Définition du tool pour le serveur MCP
 */
export const restoreDatabaseDumpToolDef = {
  name: 'ovh.webhosting.restoreDatabaseDump',
  description: '[WRITE] [DESTRUCTIF] Restaure un dump vers une base de données. ATTENTION: écrase les données actuelles. Nécessite ENABLE_WRITE_TOOLS=true.',
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
      id: {
        type: 'number',
        description: 'ID du dump à restaurer',
      },
    },
    required: ['serviceName', 'name', 'id'],
  },
};

/**
 * Handler du tool restoreDatabaseDump
 */
export async function restoreDatabaseDumpHandler(
  client: OvhClient,
  input: unknown
): Promise<RestoreDatabaseDumpOutput> {
  const validatedInput = validateInput(restoreDatabaseDumpInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.restoreDatabaseDump',
      serviceName: validatedInput.serviceName,
      metadata: {
        database: validatedInput.name,
        dumpId: validatedInput.id,
        destructive: true,
      },
    },
    async () => {
      const response = await client.post<RestoreTask>(
        `/hosting/web/${encodeURIComponent(validatedInput.serviceName)}/database/${encodeURIComponent(validatedInput.name)}/dump/${validatedInput.id}/restore`
      );
      return response.data;
    }
  );
}
