/**
 * Tests unitaires pour la validation
 */
import { describe, it, expect } from 'vitest';
import { serviceNameSchema, databaseModeSchema, validateInput } from '../../src/utils/validation.js';
import { ValidationError } from '../../src/ovh/errors.js';

describe('Validation', () => {
  describe('serviceNameSchema', () => {
    it('should accept valid service names', () => {
      expect(serviceNameSchema.parse('monsite.ovh')).toBe('monsite.ovh');
      expect(serviceNameSchema.parse('test123')).toBe('test123');
    });

    it('should reject empty strings', () => {
      expect(() => serviceNameSchema.parse('')).toThrow();
    });
  });

  describe('databaseModeSchema', () => {
    it('should accept valid modes', () => {
      expect(databaseModeSchema.parse('classic')).toBe('classic');
      expect(databaseModeSchema.parse('besteffort')).toBe('besteffort');
      expect(databaseModeSchema.parse('module')).toBe('module');
    });

    it('should reject invalid modes', () => {
      expect(() => databaseModeSchema.parse('invalid')).toThrow();
    });
  });

  describe('validateInput', () => {
    it('should throw ValidationError on invalid input', () => {
      expect(() => validateInput(serviceNameSchema, '')).toThrow(ValidationError);
    });
  });
});
