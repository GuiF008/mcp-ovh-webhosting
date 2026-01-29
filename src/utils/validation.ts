/**
 * Helpers de validation pour les inputs des tools MCP
 * Utilise Zod pour la validation typée
 */

import { z } from 'zod';
import { ValidationError } from '../ovh/errors.js';

/**
 * Schéma pour un nom de service OVH (serviceName)
 * Format typique : nom-de-domaine.ovh ou identifiant unique
 */
export const serviceNameSchema = z
  .string()
  .min(1, 'serviceName est requis')
  .max(253, 'serviceName trop long')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
    'serviceName invalide'
  );

/**
 * Schéma pour un nom de base de données
 */
export const databaseNameSchema = z
  .string()
  .min(1, 'database name est requis')
  .max(64, 'database name trop long')
  .regex(/^[a-zA-Z0-9_]+$/, 'database name invalide (alphanumériques et underscore)');

/**
 * Schéma pour un nom de domaine
 */
export const domainSchema = z
  .string()
  .min(1, 'domain est requis')
  .max(253, 'domain trop long')
  .regex(
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    'domain invalide'
  );

/**
 * Schéma pour un chemin (path) sur l'hébergement
 */
export const pathSchema = z
  .string()
  .max(1024, 'path trop long')
  .refine(
    (path) => !path.includes('..'),
    'path ne peut pas contenir ".." (path traversal)'
  )
  .refine(
    (path) => !path.startsWith('/'),
    'path ne doit pas commencer par /'
  )
  .optional();

/**
 * Schéma pour un login utilisateur FTP/SSH
 */
export const loginSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, 'login invalide')
  .optional();

/**
 * Enum pour les modes de base de données
 */
export const databaseModeSchema = z.enum(['besteffort', 'classic', 'module']);

/**
 * Enum pour les branches de modules
 */
export const moduleBranchSchema = z.enum(['old', 'stable', 'testing']);

/**
 * Enum pour les types de dump
 */
export const dumpTypeSchema = z.enum(['daily.1', 'now', 'weekly.1']);

/**
 * Enum pour CDN
 */
export const cdnStatusSchema = z.enum(['active', 'none']);

/**
 * Enum pour Firewall
 */
export const firewallStatusSchema = z.enum(['active', 'none']);

/**
 * Enum pour localisation IP
 */
export const ipLocationSchema = z.enum([
  'BE', 'CA', 'CZ', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'LT', 'NL', 'PL', 'PT', 'UK',
]);

/**
 * Enum pour les capacités de base de données
 */
export const databaseCapacitySchema = z.enum([
  'extraSqlPersonal',
  'local',
  'privateDatabase',
  'sqlLocal',
  'sqlPersonal',
  'sqlPro',
]);

/**
 * Enum pour les types de base de données
 */
export const databaseTypeSchema = z.enum(['mariadb', 'mysql', 'postgresql', 'redis']);

/**
 * Enum pour les quotas de base de données (en MB)
 */
export const databaseQuotaSchema = z.enum(['25', '100', '200', '256', '400', '512', '800', '1024']);

/**
 * Schéma pour un ID numérique
 */
export const numericIdSchema = z.coerce.number().int().positive();

/**
 * Valide un input avec un schéma Zod et lance une ValidationError si invalide
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new ValidationError(`Validation échouée: ${errors}`);
  }

  return result.data;
}

/**
 * Crée un schéma de validation pour les inputs d'un tool
 */
export function createToolInputSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape);
}
