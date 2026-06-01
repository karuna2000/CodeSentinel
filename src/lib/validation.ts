import { 
  MAX_UPLOAD_BYTES, 
  MAX_PASTE_BYTES,
  ALLOWED_PROGRAMMING_EXTENSIONS,
  ALLOWED_MIME_TYPES
} from './config';

export function getByteSize(str: string): number {
  return new Blob([str]).size;
}

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

export function validateFileType(file: File): { valid: boolean; error?: string } {
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  
  if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
    return { valid: false, error: 'Multimedia files (images, videos, audio) are not supported. Please upload code files.' };
  }

  
  
  
  const isExtensionAllowed = ALLOWED_PROGRAMMING_EXTENSIONS.has(extension) ||
                             ALLOWED_PROGRAMMING_EXTENSIONS.has(`.${file.name.toLowerCase()}`);

  const isMimeAllowed = file.type !== '' && ALLOWED_MIME_TYPES.has(file.type);

  if (!isExtensionAllowed && !isMimeAllowed) {
    return {
      valid: false,
      error: `File type not supported (${extension || 'unknown'}). Only JavaScript, TypeScript, Vue, and Svelte files are supported.`,
    };
  }

  return { valid: true };
}

export function validatePasteContent(text: string): { valid: boolean; error?: string } {
  const byteSize = getByteSize(text);
  
  if (byteSize > MAX_PASTE_BYTES) {
    const sizeInMB = (byteSize / (1024 * 1024)).toFixed(1);
    const limitInMB = (MAX_PASTE_BYTES / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Input is too large (${sizeInMB}MB). Maximum allowed size is ${limitInMB}MB.`,
    };
  }
  
  return { valid: true };
}
