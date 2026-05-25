/**
 * Centralized configuration constants for the application.
 */

// Maximum file upload size allowed (in bytes) - 5MB
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Maximum textarea paste size allowed (in bytes) - 1MB
export const MAX_PASTE_BYTES = 1 * 1024 * 1024;

// Allowed programming-related file extensions
export const ALLOWED_PROGRAMMING_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.scss', 
  '.md', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp', 
  '.cs', '.php', '.rb', '.swift', '.kt', '.sql', '.yaml', '.yml', 
  '.xml', '.sh', '.bash', '.dockerfile', '.env', '.txt', '.vue', '.svelte'
]);

// Allowed MIME types for programming-related content
export const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/x-python',
  'text/x-java-source',
  'text/markdown',
  'text/x-sh',
  'application/json',
  'application/xml',
  'application/x-sh',
  'application/x-yaml',
  'application/javascript',
  'application/typescript',
]);
