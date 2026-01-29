/**
 * Tests unitaires pour la validation des inputs
 */

import { describe, it, expect } from 'vitest';
import {
  serviceNameSchema,
  databaseNameSchema,
  domainSchema,
  pathSchema,
  databaseModeSchema,
  validateInput,
} from '../../src/utils/validation.js';
import { ValidationError } from '../../src/ovh/errors.js';

describe('serviceNameSchema', () => {
  it('should accept valid service names', () => {
    expect(serviceNameSchema.parse('monsite.ovh')).toBe('monsite.ovh');
    expect(serviceNameSchema.parse('my-site.com')).toBe('my-site.com');
    expect(serviceNameSchema.parse('test123')).toBe('test123');
    expect(serviceNameSchema.parse('a')).toBe('a');
  });

  it('should reject empty service names', () => {
    expect(() => serviceNameSchema.parse('')).toThrow();
  });

  it('should reject service names with invalid characters', () => {
    expect(() => serviceNameSchema.parse('site with spaces')).toThrow();
    expect(() => serviceNameSchema.parse('-invalid')).toThrow();
    expect(() => serviceNameSchema.parse('invalid-')).toThrow();
  });

  it('should reject service names that are too long', () => {
    const longName = 'a'.repeat(300);
    expect(() => serviceNameSchema.parse(longName)).toThrow();
  });
});

describe('databaseNameSchema', () => {
  it('should accept valid database names', () => {
    expect(databaseNameSchema.parse('mydb')).toBe('mydb');
    expect(databaseNameSchema.parse('my_database_123')).toBe('my_database_123');
    expect(databaseNameSchema.parse('DB1')).toBe('DB1');
  });

  it('should reject invalid database names', () => {
    expect(() => databaseNameSchema.parse('')).toThrow();
    expect(() => databaseNameSchema.parse('db-name')).toThrow(); // hyphens not allowed
    expect(() => databaseNameSchema.parse('db.name')).toThrow(); // dots not allowed
    expect(() => databaseNameSchema.parse('db name')).toThrow(); // spaces not allowed
  });
});

describe('domainSchema', () => {
  it('should accept valid domains', () => {
    expect(domainSchema.parse('example.com')).toBe('example.com');
    expect(domainSchema.parse('www.example.com')).toBe('www.example.com');
    expect(domainSchema.parse('sub.domain.example.co.uk')).toBe('sub.domain.example.co.uk');
    expect(domainSchema.parse('my-site.fr')).toBe('my-site.fr');
  });

  it('should reject invalid domains', () => {
    expect(() => domainSchema.parse('')).toThrow();
    expect(() => domainSchema.parse('not-a-domain')).toThrow();
    expect(() => domainSchema.parse('http://example.com')).toThrow(); // no protocol
    expect(() => domainSchema.parse('example')).toThrow(); // no TLD
    expect(() => domainSchema.parse('.example.com')).toThrow(); // starts with dot
  });
});

describe('pathSchema', () => {
  it('should accept valid paths', () => {
    expect(pathSchema.parse('www')).toBe('www');
    expect(pathSchema.parse('public_html')).toBe('public_html');
    expect(pathSchema.parse('sites/mysite')).toBe('sites/mysite');
    expect(pathSchema.parse(undefined)).toBeUndefined();
  });

  it('should reject path traversal attempts', () => {
    expect(() => pathSchema.parse('../etc/passwd')).toThrow();
    expect(() => pathSchema.parse('sites/../../../')).toThrow();
    expect(() => pathSchema.parse('..')).toThrow();
  });

  it('should reject absolute paths', () => {
    expect(() => pathSchema.parse('/var/www')).toThrow();
    expect(() => pathSchema.parse('/home/user')).toThrow();
  });

  it('should reject paths that are too long', () => {
    const longPath = 'a'.repeat(2000);
    expect(() => pathSchema.parse(longPath)).toThrow();
  });
});

describe('databaseModeSchema', () => {
  it('should accept valid modes', () => {
    expect(databaseModeSchema.parse('besteffort')).toBe('besteffort');
    expect(databaseModeSchema.parse('classic')).toBe('classic');
    expect(databaseModeSchema.parse('module')).toBe('module');
  });

  it('should reject invalid modes', () => {
    expect(() => databaseModeSchema.parse('invalid')).toThrow();
    expect(() => databaseModeSchema.parse('CLASSIC')).toThrow(); // case sensitive
    expect(() => databaseModeSchema.parse('')).toThrow();
  });
});

describe('validateInput', () => {
  const testSchema = serviceNameSchema;

  it('should return validated value on success', () => {
    const result = validateInput(testSchema, 'valid-service.com');
    expect(result).toBe('valid-service.com');
  });

  it('should throw ValidationError on failure', () => {
    expect(() => validateInput(testSchema, '')).toThrow(ValidationError);
    expect(() => validateInput(testSchema, '')).toThrow('Validation échouée');
  });

  it('should include field information in error message', () => {
    try {
      validateInput(testSchema, '');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toContain('serviceName');
    }
  });
});
