/**
 * Tool MCP : ovh.webhosting.listServices
 * Liste tous les services Web Hosting du compte OVH
 *
 * OVH API : GET /hosting/web/
 * Input : {}
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input (aucun paramètre requis)
export const listServicesInputSchema = z.object({}).strict();

export type ListServicesInput = z.infer<typeof listServicesInputSchema>;

// Type de sortie (liste de noms de services)
export type ListServicesOutput = string[];

/**
 * Définition du tool pour le serveur MCP
 */
export const listServicesToolDef = {
  name: 'ovh.webhosting.listServices',
  description: 'Liste tous les services Web Hosting du compte OVH',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

/**
 * Handler du tool listServices
 */
export async function listServicesHandler(
  client: OvhClient,
  _input: ListServicesInput
): Promise<ListServicesOutput> {
  return withAudit(
    { tool: 'ovh.webhosting.listServices' },
    async () => {
      const response = await client.get<string[]>('/hosting/web');
      return response.data;
    }
  );
}
