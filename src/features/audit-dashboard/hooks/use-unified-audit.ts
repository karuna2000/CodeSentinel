'use client';

import { useState, useEffect, useCallback } from 'react';
import { appStore } from '@/stores/app.store';
import type { AppStoreState } from '@/stores/app.store';
import {
  validateFileSize,
  validateFileType,
  validatePasteContent,
} from '@/lib/validation';
import type { InputPayload, ProcessingResult } from '@/types/audit';
import { readFileAsync, normalizePayload } from '../utils/payload-scrubber';
import { generateVirtualFilename } from '../utils/filename-generator';
import { processPayload } from '../services/audit-engine';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runProcessingPipeline(
  payload: InputPayload,
  onParsed?: (result: ProcessingResult) => void,
): Promise<ProcessingResult> {
  const result = processPayload(payload);

  if (onParsed) {
    onParsed(result);
  }

  appStore.setState({ processingState: 'normalizing', processingResult: result });
  await delay(600);

  appStore.setState({ processingState: 'understanding' });
  await delay(600);

  appStore.setState({ processingState: 'grounding' });
  await delay(600);

  appStore.setState({
    inputPayload: payload,
    processingResult: result,
    processingState: 'reasoning',
    validationError: null,
  });

  return result;
}

export function useUnifiedAudit() {
  const [state, setState] = useState<AppStoreState>(appStore.getState());

  useEffect(() => {
    const unsubscribe = appStore.subscribe((newState) => setState(newState));
    return unsubscribe;
  }, []);

  const setPayloadFromFile = useCallback(async (
    file: File,
    onParsed?: (result: ProcessingResult) => void,
  ): Promise<ProcessingResult | null> => {
    appStore.setState({ validationError: null, processingState: 'reading' });

    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      appStore.setState({
        processingState: 'error',
        validationError: sizeCheck.error ?? 'File is too large.',
      });
      return null;
    }

    const typeCheck = validateFileType(file);
    if (!typeCheck.valid) {
      appStore.setState({
        processingState: 'error',
        validationError: typeCheck.error ?? 'File type is not supported.',
      });
      return null;
    }

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

    const payload = normalizePayload(content, file.name, 'file-upload');
    appStore.setState({ stagedPayload: payload, processingState: 'idle' });
    return null;
  }, []);

  const setPayloadFromText = useCallback(async (
    text: string,
    explicitFilename?: string,
    onParsed?: (result: ProcessingResult) => void,
  ): Promise<ProcessingResult | null> => {
    appStore.setState({ validationError: null, processingState: 'normalizing' });

    const pasteCheck = validatePasteContent(text);
    if (!pasteCheck.valid) {
      appStore.setState({
        processingState: 'error',
        validationError: pasteCheck.error ?? 'Pasted content is not valid.',
      });
      return null;
    }

    await delay(600);

    const virtual = generateVirtualFilename(text);
    
    if (virtual.extension === '.txt') {
      appStore.setState({
        processingState: 'error',
        validationError: 'Pasted content was not recognised as valid JavaScript, TypeScript, Vue, or Svelte code.',
      });
      return null;
    }

    const resolvedFilename = explicitFilename ?? virtual.filename;
    const payload = normalizePayload(text, resolvedFilename, 'paste');

    appStore.setState({ stagedPayload: payload, processingState: 'idle' });
    return null;
  }, []);

  const confirmAndAnalyze = useCallback(async (
    payload: InputPayload,
    userContext?: string,
    userCorrection?: string,
    onParsed?: (result: ProcessingResult) => void
  ): Promise<ProcessingResult | null> => {
    const payloadWithContext = {
      ...payload,
      userContext,
      userCorrection,
    };

    appStore.setState({ stagedPayload: null });
    return runProcessingPipeline(payloadWithContext, onParsed);
  }, []);

  const reset = useCallback((): void => {
    appStore.setState({
      stagedPayload: null,
      inputPayload: null,
      processingResult: null,
      processingState: 'idle',
      validationError: null,
    });
  }, []);

  return {
    stagedPayload: state.stagedPayload,
    inputPayload: state.inputPayload,
    processingResult: state.processingResult,
    processingState: state.processingState,
    validationError: state.validationError,
    isProcessing: ['reading', 'normalizing', 'understanding', 'grounding'].includes(state.processingState),
    isReasoning: state.processingState === 'reasoning',
    hasError: state.processingState === 'error',
    setPayloadFromFile,
    setPayloadFromText,
    confirmAndAnalyze,
    reset,
  };
}
