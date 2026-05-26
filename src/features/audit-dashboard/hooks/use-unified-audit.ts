/**
 * useUnifiedAudit — the primary hook connecting UI components to the
 * centralised real input-processing pipeline.
 *
 * Responsibilities:
 * - Subscribe to appStore and expose reactive state to components
 * - Orchestrate the full ingestion lifecycle:
 *     file/paste → validate → read → normalise → process → store
 * - Expose typed action dispatchers (setPayloadFromFile, setPayloadFromText, reset)
 *
 * Design:
 * - Decoupled from UI rendering
 * - Validation errors surface through state (not thrown) for UX-safe handling
 * - Async-safe (processing state tracked, no race conditions)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { appStore } from '@/stores/app.store';
import type { AppStoreState } from '@/stores/app.store';
import type { ReasoningOutput } from '@/types/llm-reasoning';
import {
  validateFileSize,
  validateFileType,
  validatePasteContent,
} from '@/lib/validation';
import type { InputPayload, ProcessingResult, ProcessingState } from '@/types/audit';
import { readFileAsync, normalizePayload } from '../utils/payload-scrubber';
import { generateVirtualFilename } from '../utils/filename-generator';
import { processPayload } from '../services/audit-engine';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUnifiedAudit() {
  const [state, setState] = useState<AppStoreState>(appStore.getState());

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = appStore.subscribe((newState) => setState(newState));
    return unsubscribe;
  }, []);

  // -------------------------------------------------------------------------
  // Action: ingest a File object
  // -------------------------------------------------------------------------
  const setPayloadFromFile = useCallback(async (file: File): Promise<ProcessingResult | null> => {
    // Reset error state
    appStore.setState({ validationError: null, processingState: 'reading' });

    // 1. Validate file size
    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      appStore.setState({
        processingState: 'error',
        validationError: sizeCheck.error ?? 'File is too large.',
      });
      return null;
    }

    // 2. Validate file type
    const typeCheck = validateFileType(file);
    if (!typeCheck.valid) {
      appStore.setState({
        processingState: 'error',
        validationError: typeCheck.error ?? 'File type is not supported.',
      });
      return null;
    }

    // 3. Read file content asynchronously
    let content: string;
    try {
      content = await readFileAsync(file);
    } catch {
      appStore.setState({
        processingState: 'error',
        validationError: `Could not read file: ${file.name}`,
      });
      return null;
    }

    // 4. Normalise into InputPayload
    appStore.setState({ processingState: 'normalizing' });
    await delay(600);
    const payload = normalizePayload(content, file.name, 'file-upload');

    appStore.setState({ processingState: 'understanding' });
    await delay(600);
    
    appStore.setState({ processingState: 'grounding' });
    await delay(600);

    // 5. Run audit engine
    const result = processPayload(payload);

    appStore.setState({
      inputPayload: payload,
      processingResult: result,
      processingState: 'reasoning',
      validationError: null,
    });

    return result;
  }, []);

  // -------------------------------------------------------------------------
  // Action: ingest pasted / typed text
  // -------------------------------------------------------------------------
  const setPayloadFromText = useCallback(async (text: string, explicitFilename?: string): Promise<ProcessingResult | null> => {
    // Reset
    appStore.setState({ validationError: null, processingState: 'normalizing' });

    // 1. Validate paste content (size + heuristic)
    const pasteCheck = validatePasteContent(text);
    if (!pasteCheck.valid) {
      appStore.setState({
        processingState: 'error',
        validationError: pasteCheck.error ?? 'Pasted content is not valid.',
      });
      return null;
    }

    await delay(600);
    // 2. Derive a meaningful virtual filename + language if not explicitly provided
    const virtual = generateVirtualFilename(text);
    const resolvedFilename = explicitFilename ?? virtual.filename;

    // 3. Normalise — use the virtual extension-based filename so detectLanguage
    //    in normalizePayload picks up the correct language label
    const payload = normalizePayload(text, resolvedFilename, 'paste');

    appStore.setState({ processingState: 'understanding' });
    await delay(600);

    appStore.setState({ processingState: 'grounding' });
    await delay(600);

    // 4. Process
    const result = processPayload(payload);

    appStore.setState({
      inputPayload: payload,
      processingResult: result,
      processingState: 'reasoning',
      validationError: null,
    });

    return result;
  }, []);

  // Action: reset everything back to idle
  // -------------------------------------------------------------------------
  const reset = useCallback((): void => {
    appStore.setState({
      inputPayload: null,
      processingResult: null,
      processingState: 'idle',
      validationError: null,
    });
  }, []);

  return {
    // State
    inputPayload: state.inputPayload,
    processingResult: state.processingResult,
    processingState: state.processingState,
    validationError: state.validationError,
    // Derived convenience flags
    isProcessing: ['reading', 'normalizing', 'understanding', 'grounding'].includes(state.processingState),
    isReasoning: state.processingState === 'reasoning',
    hasError: state.processingState === 'error',
    // Actions
    setPayloadFromFile,
    setPayloadFromText,
    reset,
  };
}
