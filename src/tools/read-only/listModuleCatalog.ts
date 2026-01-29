/**
 * Tool MCP : ovh.webhosting.listModuleCatalog
 * Liste les modules disponibles dans le catalogue OVH
 *
 * OVH API : GET /hosting/web/moduleList
 * Input : { active?: boolean, branch?: 'old' | 'stable' | 'testing', latest?: boolean }
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { moduleBranchSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const listModuleCatalogInputSchema = z.object({
  active: z.boolean().optional(),
  branch: moduleBranchSchema.optional(),
  latest: z.boolean().optional(),
}).strict();

export type ListModuleCatalogInput = z.infer<typeof listModuleCatalogInputSchema>;

// Type de sortie (liste d'IDs de modules)
export type ListModuleCatalogOutput = number[];

/**
 * Définition du tool pour le serveur MCP
 */
export const listModuleCatalogToolDef = {
  name: 'ovh.webhosting.listModuleCatalog',
  description: 'Liste les modules disponibles dans le catalogue OVH Web Hosting',
  inputSchema: {
    type: 'object' as const,
    properties: {
      active: {
        type: 'boolean',
        description: 'Filtrer par modules actifs (optionnel)',
      },
      branch: {
        type: 'string',
        enum: ['old', 'stable', 'testing'],
        description: 'Filtrer par branche (optionnel)',
      },
      latest: {
        type: 'boolean',
        description: 'Ne retourner que les dernières versions (optionnel)',
      },
    },
    required: [],
  },
};

/**
 * Handler du tool listModuleCatalog
 */
export async function listModuleCatalogHandler(
  client: OvhClient,
  input: unknown
): Promise<ListModuleCatalogOutput> {
  const validatedInput = validateInput(listModuleCatalogInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.listModuleCatalog',
      metadata: validatedInput,
    },
    async () => {
      const query: Record<string, string | boolean | undefined> = {};
      if (validatedInput.active !== undefined) query.active = validatedInput.active;
      if (validatedInput.branch) query.branch = validatedInput.branch;
      if (validatedInput.latest !== undefined) query.latest = validatedInput.latest;

      const response = await client.get<number[]>('/hosting/web/moduleList', { query });
      return response.data;
    }
  );
}
