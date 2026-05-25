import { describe, it, expect } from 'vitest';
import { isLikelyCodeOrTechContent, validatePasteContent, validateFileType, getByteSize } from '../validation';
import { MAX_PASTE_BYTES } from '../config';

describe('Validation Utilities', () => {
  
  describe('getByteSize', () => {
    it('should correctly calculate byte size of ASCII string', () => {
      expect(getByteSize('hello')).toBe(5);
    });

    it('should correctly calculate byte size of UTF-8 string', () => {
      expect(getByteSize('👋🌍')).toBe(8); // Emojis are 4 bytes each usually
    });
  });

  describe('isLikelyCodeOrTechContent', () => {
    it('should allow short text strings regardless of content', () => {
      const shortText = "This is just a normal question about my code";
      expect(isLikelyCodeOrTechContent(shortText)).toBe(true);
    });

    it('should allow code snippets with high structural density', () => {
      const codeSnippet = `
        function doSomething() {
          if (x === 1) {
            console.log("test");
          }
        }
      `;
      expect(isLikelyCodeOrTechContent(codeSnippet)).toBe(true);
    });

    it('should allow configuration content with keywords', () => {
      const config = `
        import { defineConfig } from 'vite';
        export default defineConfig({
          plugins: [],
        });
      `;
      expect(isLikelyCodeOrTechContent(config)).toBe(true);
    });

    it('should reject long essays of natural language', () => {
      // Create a long prose text with almost no special characters
      const prose = "This is a very long essay that someone might try to paste into the box. ".repeat(20);
      expect(isLikelyCodeOrTechContent(prose)).toBe(false);
    });
  });

  describe('validatePasteContent', () => {
    it('should reject text that exceeds MAX_PASTE_BYTES', () => {
      // Mocking a huge string efficiently
      const hugeString = "a".repeat(MAX_PASTE_BYTES + 10);
      const result = validatePasteContent(hugeString);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Input is too large');
    });

    it('should reject invalid content', () => {
      const prose = "This is a very long essay that someone might try to paste into the box. ".repeat(20);
      const result = validatePasteContent(prose);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Pasted content does not appear to be source code');
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
