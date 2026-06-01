

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MAX_PASTE_BYTES = 1 * 1024 * 1024;

export const ALLOWED_PROGRAMMING_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'
]);

export const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/javascript',
  'application/javascript',
  'application/typescript',
]);
