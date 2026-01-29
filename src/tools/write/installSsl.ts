/**
 * Tool MCP : ovh.webhosting.installSsl
 * Installe un certificat SSL sur un service Web Hosting
 *
 * OVH API : POST /hosting/web/{serviceName}/ssl
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { serviceNameSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const installSslInputSchema = z.object({
  serviceName: serviceNameSchema,
  // Si aucun certificat n'est fourni, OVH génère un certificat Let's Encrypt
  certificate: z.string().optional(),
  chain: z.string().optional(),
  key: z.string().optional(),
}).strict();

export type InstallSslInput = z.infer<typeof installSslInputSchema>;

// Type de sortie (tâche créée)
export interface SslTask {
  id?: number;
  function?: string;
  status?: string;
  startDate?: string;
  doneDate?: string;
}

export type InstallSslOutput = SslTask;

/**
 * Définition du tool pour le serveur MCP
 */
export const installSslToolDef = {
  name: 'ovh.webhosting.installSsl',
  description: '[WRITE] Installe un certificat SSL sur un service Web Hosting. Sans certificat fourni, génère un Let\'s Encrypt. Nécessite ENABLE_WRITE_TOOLS=true.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      certificate: {
        type: 'string',
        description: 'Certificat SSL (PEM). Si absent, un certificat Let\'s Encrypt sera généré.',
      },
      chain: {
        type: 'string',
        description: 'Chaîne de certificats intermédiaires (PEM)',
      },
      key: {
        type: 'string',
        description: 'Clé privée du certificat (PEM)',
      },
    },
    required: ['serviceName'],
  },
};

/**
 * Handler du tool installSsl
 */
export async function installSslHandler(
  client: OvhClient,
  input: unknown
): Promise<InstallSslOutput> {
  const validatedInput = validateInput(installSslInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.installSsl',
      serviceName: validatedInput.serviceName,
      metadata: {
        hasCustomCert: !!validatedInput.certificate,
      },
    },
    async () => {
      const { serviceName, ...body } = validatedInput;

      // Ne pas envoyer de body vide
      const requestBody = Object.keys(body).length > 0 ? body : undefined;

      const response = await client.post<SslTask>(
        `/hosting/web/${encodeURIComponent(serviceName)}/ssl`,
        { body: requestBody }
      );
      return response.data;
    }
  );
}
