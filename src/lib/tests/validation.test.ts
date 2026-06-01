import { describe, it, expect } from 'vitest';
import { validatePasteContent, validateFileType, getByteSize } from '../validation';
import { MAX_PASTE_BYTES } from '../config';

describe('Validation Utilities', () => {
  
  describe('getByteSize', () => {
    it('should correctly calculate byte size of ASCII string', () => {
      expect(getByteSize('hello')).toBe(5);
    });

    it('should correctly calculate byte size of UTF-8 string', () => {
      expect(getByteSize('👋🌍')).toBe(8); 
    });
  });


  describe('validatePasteContent', () => {
    it('should reject text that exceeds MAX_PASTE_BYTES', () => {
      
      const hugeString = "a".repeat(MAX_PASTE_BYTES + 10);
      const result = validatePasteContent(hugeString);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Input is too large');
    });


    it('should allow valid code snippets within size limits', () => {
      const validCode = "function test() { return true; }".repeat(10);
      const result = validatePasteContent(validCode);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFileType', () => {
    it('should accept allowed extensions', () => {
      const file = new File(['console.log("test")'], 'test.js', { type: 'application/javascript' });
      expect(validateFileType(file).valid).toBe(true);
    });

    it('should reject unsupported explicit multimedia types', () => {
      const file = new File(['fake data'], 'test.mp4', { type: 'video/mp4' });
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Multimedia files');
    });

    it('should reject unsupported text file types based on extension', () => {
      const file = new File(['some text'], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type not supported');
    });
  });
});
