/**
 * Tool MCP : ovh.webhosting.installModule
 * Installe un module (WordPress, PrestaShop, etc.) sur un service Web Hosting
 *
 * OVH API : POST /hosting/web/{serviceName}/module
 */

import { z } from 'zod';
import { OvhClient } from '../../ovh/client.js';
import {
  serviceNameSchema,
  domainSchema,
  pathSchema,
  numericIdSchema,
  validateInput,
} from '../../utils/validation.js';
import { withAudit } from '../../utils/audit.js';

// Schéma pour les dépendances (base de données)
const moduleDependenciesSchema = z.object({
  name: z.string().optional(),
  password: z.string().optional(),
  port: z.number().int().positive().optional(),
  prefix: z.string().optional(),
  server: z.string().optional(),
  type: z.string().optional(),
  user: z.string().optional(),
}).optional();

// Schéma d'input
export const installModuleInputSchema = z.object({
  serviceName: serviceNameSchema,
  moduleId: numericIdSchema,
  domain: domainSchema.optional(),
  language: z.string().min(2).max(10).optional(),
  path: pathSchema,
  adminName: z.string().min(1).max(64).optional(),
  adminPassword: z.string().min(8).max(128).optional(),
  dependencies: moduleDependenciesSchema,
}).strict();

export type InstallModuleInput = z.infer<typeof installModuleInputSchema>;

// Type de sortie (tâche créée)
export interface ModuleTask {
  id?: number;
  function?: string;
  status?: string;
  startDate?: string;
  doneDate?: string;
}

export type InstallModuleOutput = ModuleTask;

/**
 * Définition du tool pour le serveur MCP
 */
export const installModuleToolDef = {
  name: 'ovh.webhosting.installModule',
  description: '[WRITE] Installe un module (WordPress, PrestaShop, etc.) sur un service Web Hosting. Nécessite ENABLE_WRITE_TOOLS=true.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceName: {
        type: 'string',
        description: 'Nom du service Web Hosting',
      },
      moduleId: {
        type: 'number',
        description: 'ID du module à installer (voir listModuleCatalog)',
      },
      domain: {
        type: 'string',
        description: 'Domaine sur lequel installer le module',
      },
      language: {
        type: 'string',
        description: 'Langue du module (fr, en, etc.)',
      },
      path: {
        type: 'string',
        description: 'Chemin d\'installation relatif',
      },
      adminName: {
        type: 'string',
        description: 'Nom de l\'administrateur du module',
      },
      adminPassword: {
        type: 'string',
        description: 'Mot de passe administrateur (min 8 caractères)',
      },
      dependencies: {
        type: 'object',
        description: 'Configuration de la base de données',
        properties: {
          name: { type: 'string', description: 'Nom de la base de données' },
          password: { type: 'string', description: 'Mot de passe de la base de données' },
          port: { type: 'number', description: 'Port de la base de données' },
          prefix: { type: 'string', description: 'Préfixe des tables' },
          server: { type: 'string', description: 'Serveur de la base de données' },
          type: { type: 'string', description: 'Type de base de données' },
          user: { type: 'string', description: 'Utilisateur de la base de données' },
        },
      },
    },
    required: ['serviceName', 'moduleId'],
  },
};

/**
 * Handler du tool installModule
 */
export async function installModuleHandler(
  client: OvhClient,
  input: unknown
): Promise<InstallModuleOutput> {
  const validatedInput = validateInput(installModuleInputSchema, input);

  return withAudit(
    {
      tool: 'ovh.webhosting.installModule',
      serviceName: validatedInput.serviceName,
      metadata: {
        moduleId: validatedInput.moduleId,
        domain: validatedInput.domain,
        path: validatedInput.path,
      },
    },
    async () => {
      const { serviceName, ...body } = validatedInput;

      const response = await client.post<ModuleTask>(
        `/hosting/web/${encodeURIComponent(serviceName)}/module`,
        { body }
      );
      return response.data;
    }
  );
}
