/**
 * Tool MCP : ovh.webhosting.listDatabases
 * Liste les bases de données d'un service Web Hosting
 *
 * OVH API : GET /hosting/web/{serviceName}/database
 * Input : { serviceName: string, mode: 'besteffort' | 'classic' | 'module' }
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { serviceNameSchema, databaseModeSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const listDatabasesInputSchema = z.object({
  serviceName: serviceNameSchema,
  mode: databaseModeSchema,
}).strict();

export type ListDatabasesInput = z.infer<typeof listDatabasesInputSchema>;

// Type de sortie (liste de noms de bases de données)
export type ListDatabasesOutput = string[];

/**
 * Définition du tool pour le serveur MCP
 */
export const listDatabasesToolDef = {
  name: 'ovh.webhosting.listDatabases',
  description: 'Liste les bases de données d\'un service Web Hosting OVH',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      mode: {
        type: 'string',
        enum: ['besteffort', 'classic', 'module'],
        description: 'Mode de la base de données',
      },
    },
    required: ['serviceName', 'mode'],
  },
};

/**
 * Handler du tool listDatabases
 */
export async function listDatabasesHandler(
  client: OvhClient,
  input: unknown
): Promise<ListDatabasesOutput> {
  const validatedInput = validateInput(listDatabasesInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.listDatabases',
      serviceName: validatedInput.serviceName,
      metadata: { mode: validatedInput.mode },
    },
    async () => {
      const response = await client.get<string[]>(
        `/hosting/web/${encodeURIComponent(validatedInput.serviceName)}/database`,
        { query: { mode: validatedInput.mode } }
      );
      return response.data;
    }
  );
}
