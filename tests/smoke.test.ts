/**
 * Smoke test - Vérifie que le serveur peut démarrer
 */
import { describe, it, expect, vi } from 'vitest';
import { getToolDefinitions, formatToolError } from '../src/tools/index.js';
import { ValidationError } from '../src/ovh/errors.js';

// Mock logger
vi.mock('../src/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }),
  initLogger: vi.fn(),
}));

describe('Smoke Tests', () => {
  describe('Tool Definitions', () => {
    it('should return 8 read-only tools by default', () => {
      const tools = getToolDefinitions(false);
      expect(tools).toHaveLength(8);
    });

    it('should return 14 tools when write enabled', () => {
      const tools = getToolDefinitions(true);
      expect(tools).toHaveLength(14);
    });
  });

  describe('Error Formatting', () => {
    it('should format ValidationError correctly', () => {
      const error = new ValidationError('Test error');
      const result = formatToolError(error);
      expect(result.code).toBe(-32602);
    });
  });
});
