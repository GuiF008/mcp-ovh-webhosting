/**
 * Tool MCP : ovh.webhosting.getService
 * Récupère les détails d'un service Web Hosting
 *
 * OVH API : GET /hosting/web/{serviceName}
 * Input : { serviceName: string }
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { serviceNameSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const getServiceInputSchema = z.object({
  serviceName: serviceNameSchema,
}).strict();

export type GetServiceInput = z.infer<typeof getServiceInputSchema>;

// Type de sortie (structure d'un service Web Hosting)
export interface WebHostingService {
  serviceName: string;
  displayName?: string;
  offer: string;
  operatingSystem: string;
  state: string;
  clusterIp?: string;
  clusterIpv6?: string;
  hostingIp?: string;
  hostingIpv6?: string;
  filer?: string;
  cluster?: string;
  datacenter?: string;
  resourceType?: string;
  availableBoostOffer?: unknown[];
  boostOffer?: unknown;
  hasCdn?: boolean;
  hasHostedSsl?: boolean;
  home?: string;
  primaryLogin?: string;
  quotaSize?: number;
  quotaUsed?: number;
  serviceManagementAccess?: {
    ssh?: { state: string; port: number };
    ftp?: { state: string; port: number };
    http?: { state: string; port: number };
  };
  updates?: string[];
}

export type GetServiceOutput = WebHostingService;

/**
 * Définition du tool pour le serveur MCP
 */
export const getServiceToolDef = {
  name: 'ovh.webhosting.getService',
  description: 'Récupère les détails d\'un service Web Hosting OVH',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting (ex: monsite.ovh)',
      },
    },
    required: ['serviceName'],
  },
};

/**
 * Handler du tool getService
 */
export async function getServiceHandler(
  client: OvhClient,
  input: unknown
): Promise<GetServiceOutput> {
  const validatedInput = validateInput(getServiceInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.getService',
      serviceName: validatedInput.serviceName,
    },
    async () => {
      const response = await client.get<WebHostingService>(
        `/hosting/web/${encodeURIComponent(validatedInput.serviceName)}`
      );
      return response.data;
    }
  );
}
