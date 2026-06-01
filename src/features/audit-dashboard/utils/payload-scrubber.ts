

import type { InputPayload, InputSource } from '@/types/audit';

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

export function detectLanguage(extension: string): string {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] ?? 'Unknown';
}

export function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === filename.length - 1) return '';
  return filename.substring(dotIndex).toLowerCase();
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
