import { 
  MAX_UPLOAD_BYTES, 
  MAX_PASTE_BYTES,
  ALLOWED_PROGRAMMING_EXTENSIONS,
  ALLOWED_MIME_TYPES
} from './config';

/**
 * Calculates the exact byte size of a UTF-8 string safely.
 * @param str The string to calculate the size of.
 * @returns The size in bytes.
 */
export function getByteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Validates a file's size against the global maximum upload limit.
 * @param file The File object to validate.
 * @returns An object containing validation status and optional error message.
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    const limitInMB = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeInMB}MB). Maximum allowed size is ${limitInMB}MB.`,
    };
  }
  return { valid: true };
}

/**
 * Validates a file's type against the global allowed extensions and MIME types.
 * @param file The File object to validate.
 * @returns An object containing validation status and optional error message.
 */
export function validateFileType(file: File): { valid: boolean; error?: string } {
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  // Exclude explicit binary/media types via simple matching if they somehow bypass the extension check
  if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
    return { valid: false, error: 'Multimedia files (images, videos, audio) are not supported. Please upload code files.' };
  }

  // Check extension first
  // Note: some valid files like Dockerfile or Makefile might not have an extension, 
  // so we check if the entire name is in the allowed list or if it has no extension but is a text file.
  const isExtensionAllowed = ALLOWED_PROGRAMMING_EXTENSIONS.has(extension) || 
                             ALLOWED_PROGRAMMING_EXTENSIONS.has(`.${file.name.toLowerCase()}`);
                             
  const isMimeAllowed = ALLOWED_MIME_TYPES.has(file.type) || file.type === ''; // sometimes type is empty for obscure code files

  if (!isExtensionAllowed && !isMimeAllowed) {
    return { 
      valid: false, 
      error: `File type not supported (${extension || 'unknown'}). Only programming/code-related files are supported.` 
    };
  }

  return { valid: true };
}

/**
 * Lightweight heuristic to determine if text is likely code, logs, config, or technical content.
 * @param text The text to evaluate.
 * @returns true if likely code/tech, false if likely non-tech prose/spam.
 */
export function isLikelyCodeOrTechContent(text: string): boolean {
  // Short texts (e.g. questions, single lines) are always allowed.
  if (text.length < 50) return true;

  // Calculate density of strict structural/special characters commonly used in programming
  // Excluded ., -, :, ', " because they are extremely common in English prose.
  const strictCodeChars = text.match(/[{}[\]()=<>_/#$\\;]/g);
  const codeCharDensity = strictCodeChars ? strictCodeChars.length / text.length : 0;

  // Scan for STRICT programming/config keywords that rarely appear in casual prose
  const strictCodeKeywords = /\b(const|console|namespace|typedef|struct|impl|async|await|require|debugger|println|printf|std::|mysqli|psql|def|func)\b/i;
  
  const hasStrictKeywords = strictCodeKeywords.test(text);

  // Consider it valid tech content if it has a > 1% density of strict code characters,
  // or it contains explicit, unambiguous programming keywords.
  return codeCharDensity >= 0.01 || hasStrictKeywords;
}

/**
 * Validates a text payload against both size constraints and content heuristics.
 * @param text The text string to validate.
 * @returns An object containing validation status and optional error message.
 */
export function validatePasteContent(text: string): { valid: boolean; error?: string } {
  const byteSize = getByteSize(text);
  
  // 1. Check size
  if (byteSize > MAX_PASTE_BYTES) {
    const sizeInMB = (byteSize / (1024 * 1024)).toFixed(1);
    const limitInMB = (MAX_PASTE_BYTES / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Input is too large (${sizeInMB}MB). Maximum allowed size is ${limitInMB}MB.`,
    };
  }
  
  // 2. Check content heuristic
  if (!isLikelyCodeOrTechContent(text)) {
    return {
      valid: false,
      error: 'Pasted content does not appear to be source code or technical content.',
    };
  }

  return { valid: true };
}
