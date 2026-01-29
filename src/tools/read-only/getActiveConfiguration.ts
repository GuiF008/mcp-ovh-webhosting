/**
 * Tool MCP : ovh.webhosting.getActiveConfiguration
 * Récupère la configuration active d'un service Web Hosting
 *
 * OVH API : GET /hosting/web/{serviceName}/configuration
 * Input : { serviceName: string }
 *
 * NOTE: Cet endpoint peut varier selon les offres OVH.
 * À VALIDER dans la console OVH si des erreurs surviennent.
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { serviceNameSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const getActiveConfigurationInputSchema = z.object({
  serviceName: serviceNameSchema,
}).strict();

export type GetActiveConfigurationInput = z.infer<typeof getActiveConfigurationInputSchema>;

// Type de sortie (structure de configuration)
export interface WebHostingConfiguration {
  // La structure exacte dépend de l'API OVH
  // Ces champs sont basés sur la documentation disponible
  id?: number;
  status?: string;
  container?: string;
  creationDate?: string;
  environment?: Record<string, string>;
  filesBrowser?: boolean;
  engineName?: string;
  engineVersion?: string;
  path?: string;
  // Champs additionnels possibles
  [key: string]: unknown;
}

export type GetActiveConfigurationOutput = WebHostingConfiguration | WebHostingConfiguration[];

/**
 * Définition du tool pour le serveur MCP
 */
export const getActiveConfigurationToolDef = {
  name: 'ovh.webhosting.getActiveConfiguration',
  description: 'Récupère la configuration active d\'un service Web Hosting OVH',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
    },
    required: ['serviceName'],
  },
};

/**
 * Handler du tool getActiveConfiguration
 */
export async function getActiveConfigurationHandler(
  client: OvhClient,
  input: unknown
): Promise<GetActiveConfigurationOutput> {
  const validatedInput = validateInput(getActiveConfigurationInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.getActiveConfiguration',
      serviceName: validatedInput.serviceName,
    },
    async () => {
      const response = await client.get<GetActiveConfigurationOutput>(
        `/hosting/web/${encodeURIComponent(validatedInput.serviceName)}/configuration`
      );
      return response.data;
    }
  );
}
