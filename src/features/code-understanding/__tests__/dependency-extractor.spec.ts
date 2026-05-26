/**
 * Tests for the Dependency Extractor.
 */

import { describe, it, expect } from 'vitest';
import {
  extractDependencies,
  getExternalDependencies,
} from '@/features/code-understanding/pipeline/dependency-extractor';

describe('extractDependencies — TypeScript/JavaScript', () => {
  it('extracts named imports', () => {
    const code = `import { useState, useEffect } from 'react';
import type { FC } from 'react';`;
    const deps = extractDependencies(code, 'TypeScript');
    expect(deps).toContain('react');
  });

  it('extracts default imports', () => {
    const code = `import express from 'express';
import axios from 'axios';`;
    const deps = extractDependencies(code, 'JavaScript');
    expect(deps).toContain('express');
    expect(deps).toContain('axios');
  });

  it('extracts require() calls', () => {
    const code = `const path = require('path');
const fs = require('fs');`;
    const deps = extractDependencies(code, 'JavaScript');
    expect(deps).toContain('path');
    expect(deps).toContain('fs');
  });

  it('extracts relative imports', () => {
    const code = `import { authOptions } from './auth.config';
import { db } from '../lib/db';`;
    const deps = extractDependencies(code, 'TypeScript');
    expect(deps).toContain('./auth.config');
    expect(deps).toContain('../lib/db');
  });

  it('deduplicates repeated imports', () => {
    const code = `import { a } from 'react';
import { b } from 'react';
import React from 'react';`;
    const deps = extractDependencies(code, 'TypeScript');
    const reactOccurrences = deps.filter((d) => d === 'react');
    expect(reactOccurrences).toHaveLength(1);
  });

  it('extracts @-scoped packages', () => {
    const code = `import { PrismaClient } from '@prisma/client';
import { Injectable } from '@nestjs/common';`;
    const deps = extractDependencies(code, 'TypeScript');
    expect(deps).toContain('@prisma/client');
    expect(deps).toContain('@nestjs/common');
  });

  it('preserves order of first appearance', () => {
    const code = `import A from 'aaa';
import B from 'bbb';
import C from 'ccc';`;
    const deps = extractDependencies(code, 'TypeScript');
    const indices = ['aaa', 'bbb', 'ccc'].map((d) => deps.indexOf(d));
    expect(indices[0]).toBeLessThan(indices[1]);
    expect(indices[1]).toBeLessThan(indices[2]);
  });
});

describe('extractDependencies — Python', () => {
  it('extracts Python import statements', () => {
    const code = `import os
import sys
from flask import Flask, request`;
    const deps = extractDependencies(code, 'Python');
    expect(deps).toContain('os');
    expect(deps).toContain('sys');
    expect(deps).toContain('flask');
  });
});

describe('extractDependencies — Go', () => {
  it('extracts Go import paths', () => {
    const code = `package main
import (
  "fmt"
  "net/http"
  "encoding/json"
)`;
    const deps = extractDependencies(code, 'Go');
    expect(deps).toContain('fmt');
    expect(deps).toContain('net/http');
    expect(deps).toContain('encoding/json');
  });
});

describe('getExternalDependencies', () => {
  it('filters out relative imports', () => {
    const deps = ['react', './utils', '../lib/db', '@prisma/client', '@/config'];
    const external = getExternalDependencies(deps);
    expect(external).toContain('react');
    expect(external).toContain('@prisma/client');
    expect(external).not.toContain('./utils');
    expect(external).not.toContain('../lib/db');
    expect(external).not.toContain('@/config');
  });

  it('returns all items for a fully-external dependency list', () => {
    const deps = ['express', 'axios', 'zod'];
    expect(getExternalDependencies(deps)).toEqual(deps);
  });
});
