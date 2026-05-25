/**
 * Payload scrubber utilities — file reading and payload normalisation.
 *
 * Responsibilities:
 * - Async file content reading (browser FileReader API)
 * - Language detection from file extension
 * - Payload normalisation into a typed InputPayload
 * - Human-readable size formatting
 *
 * This module is intentionally free of UI concerns and validation logic
 * (validation lives in src/lib/validation.ts).
 */

import type { InputPayload, InputSource } from '@/types/audit';

// ---------------------------------------------------------------------------
// Language detection map
// ---------------------------------------------------------------------------

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript / React',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript / React',
  '.py': 'Python',
  '.java': 'Java',
  '.go': 'Go',
  '.rs': 'Rust',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.sql': 'SQL',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.json': 'JSON',
  '.xml': 'XML',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.md': 'Markdown',
  '.sh': 'Shell',
  '.bash': 'Bash',
  '.dockerfile': 'Dockerfile',
  '.env': 'Environment Config',
  '.txt': 'Plain Text',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

/**
 * Detects the programming language from a file extension.
 * Falls back to "Unknown" for unrecognised extensions.
 */
export function detectLanguage(extension: string): string {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] ?? 'Unknown';
}

/**
 * Extracts the file extension (including dot) from a filename.
 * Returns an empty string if no extension is found.
 */
export function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === filename.length - 1) return '';
  return filename.substring(dotIndex).toLowerCase();
}

/**
 * Formats a byte count into a human-readable string (e.g. "1.2 KB").
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reads a File object as UTF-8 text asynchronously using the FileReader API.
 * Rejects with an Error if the read fails.
 */
export function readFileAsync(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('FileReader did not return a string result.'));
      }
    };
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Normalises raw code content + optional filename into a typed InputPayload.
 *
 * @param content  Raw string content (from file read or paste)
 * @param filename Filename for file uploads; synthetic label for pastes
 * @param source   Where the input originated
 */
export function normalizePayload(
  content: string,
  filename: string,
  source: InputSource,
): InputPayload {
  const extension = extractExtension(filename);
  const language = detectLanguage(extension);
  const lines = content.split('\n');
  const byteSize = new Blob([content]).size;

  return {
    filename,
    content,
    language,
    extension,
    lineCount: lines.length,
    byteSize,
    source,
    ingestedAt: new Date().toISOString(),
  };
}
