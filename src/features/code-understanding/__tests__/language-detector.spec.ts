

import { describe, it, expect } from 'vitest';
import { detectLanguage } from '@/features/code-understanding/pipeline/language-detector';

describe('detectLanguage — extension-based detection', () => {
  it('detects TypeScript from .ts extension', () => {
    const result = detectLanguage('const x = 1;', 'auth.service.ts');
    expect(result.name).toBe('TypeScript');
    expect(result.detectedVia).toBe('extension');
    expect(result.confidence).toBeGreaterThan(0.90);
  });

  it('detects JavaScript from .js extension', () => {
    const result = detectLanguage('const x = 1;', 'index.js');
    expect(result.name).toBe('JavaScript');
    expect(result.detectedVia).toBe('extension');
  });

  it('detects Python from .py extension', () => {
    const result = detectLanguage('def foo(): pass', 'main.py');
    expect(result.name).toBe('Python');
    expect(result.detectedVia).toBe('extension');
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it('detects Go from .go extension', () => {
    const result = detectLanguage('package main', 'main.go');
    expect(result.name).toBe('Go');
    expect(result.detectedVia).toBe('extension');
  });

  it('detects Rust from .rs extension', () => {
    const result = detectLanguage('fn main() {}', 'main.rs');
    expect(result.name).toBe('Rust');
    expect(result.detectedVia).toBe('extension');
  });

  it('detects SQL from .sql extension', () => {
    const result = detectLanguage('SELECT * FROM users;', 'query.sql');
    expect(result.name).toBe('SQL');
    expect(result.detectedVia).toBe('extension');
  });

  it('detects YAML from .yaml and .yml extensions', () => {
    expect(detectLanguage('key: value', 'config.yaml').name).toBe('YAML');
    expect(detectLanguage('key: value', 'config.yml').name).toBe('YAML');
  });

  it('detects Dockerfile by filename', () => {
    const result = detectLanguage('FROM node:18\nRUN npm install', 'Dockerfile');
    expect(result.name).toBe('Dockerfile');
    expect(result.confidence).toBeGreaterThan(0.95);
  });
});

describe('detectLanguage — shebang detection', () => {
  it('detects Python from #!/usr/bin/python3 shebang', () => {
    const result = detectLanguage('#!/usr/bin/python3\nprint("hello")', 'script');
    expect(result.name).toBe('Python');
    expect(result.detectedVia).toBe('shebang');
  });

  it('detects Shell from #!/bin/bash shebang', () => {
    const result = detectLanguage('#!/bin/bash\necho "hello"', 'deploy');
    expect(result.name).toBe('Shell');
    expect(result.detectedVia).toBe('shebang');
  });
});

describe('detectLanguage — heuristic detection', () => {
  it('detects TypeScript from interface and type annotations', () => {
    const code = `interface User { id: string; name: string; }
type Role = 'admin' | 'user';
const greet = (u: User): string => u.name;`;
    const result = detectLanguage(code);
    expect(result.name).toBe('TypeScript');
    expect(result.confidence).toBeGreaterThan(0.50);
  });

  it('detects Python from def/class/import patterns', () => {
    const code = `from flask import Flask
def hello():
    return "world"`;
    const result = detectLanguage(code);
    expect(result.name).toBe('Python');
    expect(result.confidence).toBeGreaterThan(0.50);
  });

  it('detects Go from package/func pattern', () => {
    const code = `package main
import "fmt"
func main() { fmt.Println("hello") }`;
    const result = detectLanguage(code);
    expect(result.name).toBe('Go');
    expect(result.confidence).toBeGreaterThan(0.50);
  });

  it('detects SQL from SELECT FROM pattern', () => {
    const code = 'SELECT id, name FROM users WHERE active = true;';
    const result = detectLanguage(code);
    expect(result.name).toBe('SQL');
  });

  it('detects HTML from DOCTYPE', () => {
    const code = '<!DOCTYPE html><html><body><p>Hello</p></body></html>';
    const result = detectLanguage(code);
    expect(result.name).toBe('HTML');
    expect(result.confidence).toBeGreaterThan(0.80);
  });

  it('falls back to Unknown for unrecognisable content', () => {
    const result = detectLanguage('qwerty azerty dvorak');
    expect(result.name).toBe('Unknown');
    expect(result.detectedVia).toBe('fallback');
    expect(result.confidence).toBeLessThan(0.30);
  });
});
