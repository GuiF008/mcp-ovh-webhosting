/**
 * Smoke test - Test de base pour vérifier que le serveur fonctionne
 * Ce test peut être exécuté en mode dry-run sans credentials
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadConfig } from '../src/config.js';
import { getToolDefinitions, formatToolError } from '../src/tools/index.js';
import { ValidationError } from '../src/ovh/errors.js';

// Mock du logger pour les tests
vi.mock('../src/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }),
  initLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  })),
}));

describe('Smoke Tests', () => {
  describe('Configuration', () => {
    beforeAll(() => {
      // Set minimal env vars for OAuth2 mode
      process.env.OVH_AUTH_MODE = 'oauth2';
      process.env.OVH_OAUTH_CLIENT_ID = 'test-client-id';
      process.env.OVH_OAUTH_CLIENT_SECRET = 'test-client-secret';
    });

    it('should load configuration with default values', () => {
      const config = loadConfig();

      expect(config.authMode).toBe('oauth2');
      expect(config.apiRegion).toBe('eu');
      expect(config.httpTimeoutMs).toBe(30000);
      expect(config.maxRetries).toBe(3);
      expect(config.enableWriteTools).toBe(false);
    });

    it('should fail with missing OAuth2 credentials', () => {
      const originalClientId = process.env.OVH_OAUTH_CLIENT_ID;
      delete process.env.OVH_OAUTH_CLIENT_ID;

      expect(() => loadConfig()).toThrow('Erreur de configuration');

      process.env.OVH_OAUTH_CLIENT_ID = originalClientId;
    });
  });

  describe('Tool Definitions', () => {
    it('should return 8 read-only tools by default', () => {
      const tools = getToolDefinitions(false);

      expect(tools).toHaveLength(8);
      expect(tools.map((t) => t.name)).toContain('ovh.webhosting.listServices');
      expect(tools.map((t) => t.name)).toContain('ovh.webhosting.getService');
      expect(tools.map((t) => t.name)).toContain('ovh.webhosting.listDatabases');
    });

    it('should return 14 tools when write tools are enabled', () => {
      const tools = getToolDefinitions(true);

      expect(tools).toHaveLength(14);
      expect(tools.map((t) => t.name)).toContain('ovh.webhosting.attachDomain');
      expect(tools.map((t) => t.name)).toContain('ovh.webhosting.createDatabase');
      expect(tools.map((t) => t.name)).toContain('ovh.webhosting.installModule');
    });

    it('should have valid tool definitions with required properties', () => {
      const tools = getToolDefinitions(true);

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.name).toMatch(/^ovh\.webhosting\./);
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });

    it('write tools should be marked in their description', () => {
      const tools = getToolDefinitions(true);
      const writeTools = tools.filter((t) => t.description.includes('[WRITE]'));

      expect(writeTools).toHaveLength(6);
    });

    it('destructive tools should be clearly marked', () => {
      const tools = getToolDefinitions(true);
      const destructiveTools = tools.filter((t) => t.description.includes('[DESTRUCTIF]'));

      expect(destructiveTools.length).toBeGreaterThanOrEqual(1);
      expect(destructiveTools.map((t) => t.name)).toContain(
        'ovh.webhosting.restoreDatabaseDump'
      );
    });
  });

  describe('Error Formatting', () => {
    it('should format ValidationError correctly', () => {
      const error = new ValidationError('Invalid serviceName');
      const mcpError = formatToolError(error);

      expect(mcpError.code).toBe(-32602);
      expect(mcpError.message).toBe('Invalid serviceName');
    });

    it('should format generic Error correctly', () => {
      const error = new Error('Something went wrong');
      const mcpError = formatToolError(error);

      expect(mcpError.code).toBe(-32603);
      expect(mcpError.message).toBe('Something went wrong');
    });

    it('should handle unknown error types', () => {
      const mcpError = formatToolError('string error');

      expect(mcpError.code).toBe(-32603);
      expect(mcpError.message).toBe('Une erreur inconnue est survenue');
    });
  });

  describe('Tool Input Schemas', () => {
    it('listServices should have empty required array', () => {
      const tools = getToolDefinitions(false);
      const listServices = tools.find((t) => t.name === 'ovh.webhosting.listServices');

      expect(listServices?.inputSchema.required).toEqual([]);
    });

    it('getService should require serviceName', () => {
      const tools = getToolDefinitions(false);
      const getService = tools.find((t) => t.name === 'ovh.webhosting.getService');

      expect(getService?.inputSchema.required).toContain('serviceName');
    });

    it('listDatabases should require serviceName and mode', () => {
      const tools = getToolDefinitions(false);
      const listDatabases = tools.find((t) => t.name === 'ovh.webhosting.listDatabases');

      expect(listDatabases?.inputSchema.required).toContain('serviceName');
      expect(listDatabases?.inputSchema.required).toContain('mode');
    });

    it('createDatabase should require serviceName, capacity, user, and type', () => {
      const tools = getToolDefinitions(true);
      const createDatabase = tools.find((t) => t.name === 'ovh.webhosting.createDatabase');

      expect(createDatabase?.inputSchema.required).toContain('serviceName');
      expect(createDatabase?.inputSchema.required).toContain('capacity');
      expect(createDatabase?.inputSchema.required).toContain('user');
      expect(createDatabase?.inputSchema.required).toContain('type');
    });
  });
});


