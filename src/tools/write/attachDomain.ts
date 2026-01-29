/**
 * Tool MCP : ovh.webhosting.attachDomain
 * Attache un domaine à un service Web Hosting
 *
 * OVH API : POST /hosting/web/{serviceName}/attachedDomain
 *
 * NOTE: Le paramètre "domain" est marqué optionnel dans la doc OVH,
 * mais est probablement requis en pratique. À VALIDER.
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import {
  serviceNameSchema,
  domainSchema,
  pathSchema,
  cdnStatusSchema,
  firewallStatusSchema,
  ipLocationSchema,
  validateInput,
} from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const attachDomainInputSchema = z.object({
  serviceName: serviceNameSchema,
  // À VALIDER: marqué optionnel dans la doc mais requis en pratique?
  domain: domainSchema.optional(),
  bypassDNSConfiguration: z.boolean().optional(),
  cdn: cdnStatusSchema.optional(),
  firewall: firewallStatusSchema.optional(),
  ipLocation: ipLocationSchema.optional(),
  ownLog: z.string().optional(),
  path: pathSchema,
  runtimeId: z.number().int().positive().optional(),
  ssl: z.boolean().optional(),
}).strict();

export type AttachDomainInput = z.infer<typeof attachDomainInputSchema>;

// Type de sortie (tâche créée)
export interface AttachedDomainTask {
  id?: number;
  function?: string;
  status?: string;
  startDate?: string;
  doneDate?: string;
}

export type AttachDomainOutput = AttachedDomainTask;

/**
 * Définition du tool pour le serveur MCP
 */
export const attachDomainToolDef = {
  name: 'ovh.webhosting.attachDomain',
  description: '[WRITE] Attache un domaine à un service Web Hosting OVH. Nécessite ENABLE_WRITE_TOOLS=true.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      domain: {
        type: 'string',
        description: 'Domaine à attacher (ex: www.monsite.com). À VALIDER si requis.',
      },
      bypassDNSConfiguration: {
        type: 'boolean',
        description: 'Ignorer la configuration DNS automatique',
      },
      cdn: {
        type: 'string',
        enum: ['active', 'none'],
        description: 'Activer le CDN pour ce domaine',
      },
      firewall: {
        type: 'string',
        enum: ['active', 'none'],
        description: 'Activer le firewall pour ce domaine',
      },
      ipLocation: {
        type: 'string',
        enum: ['BE', 'CA', 'CZ', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'LT', 'NL', 'PL', 'PT', 'UK'],
        description: 'Localisation IP',
      },
      ownLog: {
        type: 'string',
        description: 'Nom de domaine pour les logs personnalisés',
      },
      path: {
        type: 'string',
        description: 'Chemin relatif sur l\'hébergement',
      },
      runtimeId: {
        type: 'number',
        description: 'ID du runtime à utiliser',
      },
      ssl: {
        type: 'boolean',
        description: 'Activer SSL pour ce domaine',
      },
    },
    required: ['serviceName'],
  },
};

/**
 * Handler du tool attachDomain
 */
export async function attachDomainHandler(
  client: OvhClient,
  input: unknown
): Promise<AttachDomainOutput> {
  const validatedInput = validateInput(attachDomainInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.attachDomain',
      serviceName: validatedInput.serviceName,
      metadata: { domain: validatedInput.domain },
    },
    async () => {
      // Construire le body sans le serviceName
      const { serviceName, ...body } = validatedInput;

      const response = await client.post<AttachedDomainTask>(
        `/hosting/web/${encodeURIComponent(serviceName)}/attachedDomain`,
        { body }
      );
      return response.data;
    }
  );
}
