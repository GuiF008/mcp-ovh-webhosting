/**
 * Tool MCP : ovh.webhosting.getModuleCatalogItem
 * Récupère les détails d'un module du catalogue OVH
 *
 * OVH API : GET /hosting/web/moduleList/{id}
 * Input : { id: number }
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { numericIdSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const getModuleCatalogItemInputSchema = z.object({
  id: numericIdSchema,
}).strict();

export type GetModuleCatalogItemInput = z.infer<typeof getModuleCatalogItemInputSchema>;

// Type de sortie (détails d'un module)
export interface ModuleCatalogItem {
  id: number;
  name: string;
  version?: string;
  active?: boolean;
  adminNameType?: string;
  author?: string;
  branch?: string;
  keywords?: string[];
  language?: string[];
  languageRequirement?: Record<string, string>;
  latest?: boolean;
  size?: number;
  upgradeFrom?: number[];
}

export type GetModuleCatalogItemOutput = ModuleCatalogItem;

/**
 * Définition du tool pour le serveur MCP
 */
export const getModuleCatalogItemToolDef = {
  name: 'ovh.webhosting.getModuleCatalogItem',
  description: 'Récupère les détails d\'un module du catalogue OVH Web Hosting',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'number',
        description: 'ID du module dans le catalogue',
      },
    },
    required: ['id'],
  },
};

/**
 * Handler du tool getModuleCatalogItem
 */
export async function getModuleCatalogItemHandler(
  client: OvhClient,
  input: unknown
): Promise<GetModuleCatalogItemOutput> {
  const validatedInput = validateInput(getModuleCatalogItemInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.getModuleCatalogItem',
      metadata: { moduleId: validatedInput.id },
    },
    async () => {
      const response = await client.get<ModuleCatalogItem>(
        `/hosting/web/moduleList/${validatedInput.id}`
      );
      return response.data;
    }
  );
}
