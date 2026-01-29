/**
 * Tool MCP : ovh.webhosting.listDatabaseDumps
 * Liste les dumps (sauvegardes) d'une base de données
 *
 * OVH API : GET /hosting/web/{serviceName}/database/{name}/dump
 * Input : { serviceName, name, creationDate.from?, creationDate.to?, deletionDate.from?, deletionDate.to?, type? }
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { serviceNameSchema, databaseNameSchema, dumpTypeSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const listDatabaseDumpsInputSchema = z.object({
  serviceName: serviceNameSchema,
  name: databaseNameSchema,
  'creationDate.from': z.string().datetime().optional(),
  'creationDate.to': z.string().datetime().optional(),
  'deletionDate.from': z.string().datetime().optional(),
  'deletionDate.to': z.string().datetime().optional(),
  type: dumpTypeSchema.optional(),
}).strict();

export type ListDatabaseDumpsInput = z.infer<typeof listDatabaseDumpsInputSchema>;

// Type de sortie (liste d'IDs de dumps)
export type ListDatabaseDumpsOutput = number[];

/**
 * Définition du tool pour le serveur MCP
 */
export const listDatabaseDumpsToolDef = {
  name: 'ovh.webhosting.listDatabaseDumps',
  description: 'Liste les dumps (sauvegardes) d\'une base de données Web Hosting OVH',
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
      'creationDate.from': {
        type: 'string',
        format: 'date-time',
        description: 'Filtrer par date de création minimum (ISO 8601)',
      },
      'creationDate.to': {
        type: 'string',
        format: 'date-time',
        description: 'Filtrer par date de création maximum (ISO 8601)',
      },
      'deletionDate.from': {
        type: 'string',
        format: 'date-time',
        description: 'Filtrer par date de suppression minimum (ISO 8601)',
      },
      'deletionDate.to': {
        type: 'string',
        format: 'date-time',
        description: 'Filtrer par date de suppression maximum (ISO 8601)',
      },
      type: {
        type: 'string',
        enum: ['daily.1', 'now', 'weekly.1'],
        description: 'Type de dump (optionnel)',
      },
    },
    required: ['serviceName', 'name'],
  },
};

/**
 * Handler du tool listDatabaseDumps
 */
export async function listDatabaseDumpsHandler(
  client: OvhClient,
  input: unknown
): Promise<ListDatabaseDumpsOutput> {
  const validatedInput = validateInput(listDatabaseDumpsInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.listDatabaseDumps',
      serviceName: validatedInput.serviceName,
      metadata: { database: validatedInput.name },
    },
    async () => {
      const query: Record<string, string | undefined> = {};
      if (validatedInput['creationDate.from']) query['creationDate.from'] = validatedInput['creationDate.from'];
      if (validatedInput['creationDate.to']) query['creationDate.to'] = validatedInput['creationDate.to'];
      if (validatedInput['deletionDate.from']) query['deletionDate.from'] = validatedInput['deletionDate.from'];
      if (validatedInput['deletionDate.to']) query['deletionDate.to'] = validatedInput['deletionDate.to'];
      if (validatedInput.type) query.type = validatedInput.type;

      const response = await client.get<number[]>(
        `/hosting/web/${encodeURIComponent(validatedInput.serviceName)}/database/${encodeURIComponent(validatedInput.name)}/dump`,
        { query }
      );
      return response.data;
    }
  );
}
