/**
 * Tool MCP : ovh.webhosting.listFtpUsers
 * Liste les utilisateurs FTP/SSH d'un service Web Hosting
 *
 * OVH API : GET /hosting/web/{serviceName}/user
 * Input : { serviceName: string, home?: string, login?: string }
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import { serviceNameSchema, loginSchema, validateInput } from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma d'input
export const listFtpUsersInputSchema = z.object({
  serviceName: serviceNameSchema,
  home: z.string().max(1024).optional(),
  login: loginSchema,
}).strict();

export type ListFtpUsersInput = z.infer<typeof listFtpUsersInputSchema>;

// Type de sortie (liste de logins)
export type ListFtpUsersOutput = string[];

/**
 * Définition du tool pour le serveur MCP
 */
export const listFtpUsersToolDef = {
  name: 'ovh.webhosting.listFtpUsers',
  description: 'Liste les utilisateurs FTP/SSH d\'un service Web Hosting OVH',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      home: {
        type: 'string',
        description: 'Filtrer par répertoire home (optionnel)',
      },
      login: {
        type: 'string',
        description: 'Filtrer par login (optionnel)',
      },
    },
    required: ['serviceName'],
  },
};

/**
 * Handler du tool listFtpUsers
 */
export async function listFtpUsersHandler(
  client: OvhClient,
  input: unknown
): Promise<ListFtpUsersOutput> {
  const validatedInput = validateInput(listFtpUsersInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.listFtpUsers',
      serviceName: validatedInput.serviceName,
    },
    async () => {
      const query: Record<string, string | undefined> = {};
      if (validatedInput.home) query.home = validatedInput.home;
      if (validatedInput.login) query.login = validatedInput.login;

      const response = await client.get<string[]>(
        `/hosting/web/${encodeURIComponent(validatedInput.serviceName)}/user`,
        { query }
      );
      return response.data;
    }
  );
}
