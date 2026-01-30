/**
 * Helpers de validation pour les inputs des tools MCP
 */

import { z } from 'zod';
import { ValidationError } from '../ovh/errors.js';

export const serviceNameSchema = z.string().min(1, 'serviceName est requis').max(253);
export const databaseNameSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/);
export const domainSchema = z.string().min(1).max(253).regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/);
export const pathSchema = z.string().max(1024).refine((p) => !p.includes('..'), 'Path traversal interdit').optional();
export const loginSchema = z.string().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional();
export const databaseModeSchema = z.enum(['besteffort', 'classic', 'module']);
export const moduleBranchSchema = z.enum(['old', 'stable', 'testing']);
export const dumpTypeSchema = z.enum(['daily.1', 'now', 'weekly.1']);
export const cdnStatusSchema = z.enum(['active', 'none']);
export const firewallStatusSchema = z.enum(['active', 'none']);
export const ipLocationSchema = z.enum(['BE', 'CA', 'CZ', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'LT', 'NL', 'PL', 'PT', 'UK']);
export const databaseCapacitySchema = z.enum(['extraSqlPersonal', 'local', 'privateDatabase', 'sqlLocal', 'sqlPersonal', 'sqlPro']);
export const databaseTypeSchema = z.enum(['mariadb', 'mysql', 'postgresql', 'redis']);
export const databaseQuotaSchema = z.enum(['25', '100', '200', '256', '400', '512', '800', '1024']);
export const numericIdSchema = z.coerce.number().int().positive();

export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ValidationError(`Validation échouée: ${errors}`);
  }
  return result.data;
}
