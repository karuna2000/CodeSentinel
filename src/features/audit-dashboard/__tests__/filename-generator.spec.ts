

import { describe, it, expect } from 'vitest';
import { generateVirtualFilename } from '@/features/audit-dashboard/utils/filename-generator';

describe('generateVirtualFilename', () => {
  
  
  
  it('detects SQL from SELECT statement', () => {
    const result = generateVirtualFilename('SELECT id, name FROM users WHERE active = 1;');
    expect(result.filename).toBe('pasted-query.sql');
    expect(result.language).toBe('SQL');
    expect(result.extension).toBe('.sql');
  });

  it('detects SQL from CREATE TABLE', () => {
    const result = generateVirtualFilename('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255));');
    expect(result.filename).toBe('pasted-query.sql');
  });

  
  
  
  it('detects JSON from object literal', () => {
    const result = generateVirtualFilename('{ "name": "John", "age": 30 }');
    expect(result.filename).toBe('pasted-data.json');
    expect(result.language).toBe('JSON');
  });

  it('detects JSON from array literal', () => {
    const result = generateVirtualFilename('[{"id": 1}, {"id": 2}]');
    expect(result.filename).toBe('pasted-data.json');
  });

  
  
  
  it('detects Python from def keyword', () => {
    const code = `def add(a, b):\n    return a + b\n\nprint(add(1, 2))`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.py');
    expect(result.language).toBe('Python');
  });

  it('detects Python from import statement', () => {
    const result = generateVirtualFilename('import os\nimport sys\n\nfrom pathlib import Path');
    expect(result.filename).toBe('pasted-input.py');
  });

  
  
  
  it('detects TypeScript from interface keyword', () => {
    const code = `interface User {\n  id: number;\n  name: string;\n}`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.ts');
    expect(result.language).toBe('TypeScript');
  });

  it('detects TypeScript from type annotation', () => {
    const code = `function greet(name: string): string {\n  return \`Hello \${name}\`;\n}`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.ts');
  });

  
  
  
  it('detects TSX from JSX component usage', () => {
    const code = `import React from 'react';\nreturn (\n  <Button variant="primary">Click me</Button>\n);`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-component.tsx');
    expect(result.language).toBe('TypeScript / React');
  });

  
  
  
  it('detects JavaScript from const/arrow function', () => {
    const code = `const greet = (name) => {\n  console.log(\`Hello \${name}\`);\n};\nmodule.exports = { greet };`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.js');
    expect(result.language).toBe('JavaScript');
  });

  it('detects JavaScript from require()', () => {
    const code = `const express = require('express');\nconst app = express();\napp.listen(3000);`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.js');
  });

  
  
  
  it('detects Go from func keyword', () => {
    const code = `package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello")\n}`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.go');
    expect(result.language).toBe('Go');
  });

  
  
  
  it('detects Rust from fn keyword and println!', () => {
    const code = `fn main() {\n  let mut x = 5;\n  println!("{}", x);\n}`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-input.rs');
    expect(result.language).toBe('Rust');
  });

  
  
  
  it('detects shell script from shebang', () => {
    const code = `#!/bin/bash\necho "Hello"\nexport PATH=$PATH:/usr/local/bin`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-script.sh');
    expect(result.language).toBe('Shell');
  });

  
  
  
  it('detects HTML from DOCTYPE', () => {
    const code = `<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body></body>\n</html>`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-markup.html');
    expect(result.language).toBe('HTML');
  });

  
  
  
  it('detects CSS from rule block', () => {
    const code = `.container {\n  display: flex;\n  align-items: center;\n  padding: 16px;\n}`;
    const result = generateVirtualFilename(code);
    expect(result.filename).toBe('pasted-styles.css');
    expect(result.language).toBe('CSS');
  });

  
  
  
  it('falls back to pasted-snippet.txt for unrecognised content', () => {
    const result = generateVirtualFilename('This is some generic plain text content with no code patterns.');
    expect(result.filename).toBe('pasted-snippet.txt');
    expect(result.language).toBe('Plain Text');
    expect(result.extension).toBe('.txt');
  });

  it('only samples first 800 chars for performance (does not throw on large input)', () => {
    const largeCode = 'const x = 1;\n'.repeat(10000);
    expect(() => generateVirtualFilename(largeCode)).not.toThrow();
    const result = generateVirtualFilename(largeCode);
    expect(result.filename).toBe('pasted-input.js');
  });
});
