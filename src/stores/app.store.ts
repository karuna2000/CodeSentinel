/**
 * Application-level input store — centralised state for the real ingestion pipeline.
 *
 * Uses a module-level singleton with a subscriber pattern (no external state library
 * dependencies required — works with React's built-in hooks).
 *
 * State:
 *  - inputPayload      The normalised input payload from the user
 *  - processingResult  The output of the audit engine
 *  - processingState   Lifecycle state of the current processing run
 *  - validationError   Set when validation fails; cleared on new input
 *
 * Actions (exposed via useAppStore / useUnifiedAudit):
 *  - setPayloadFromFile(file)  Reads, validates, normalises a File
 *  - setPayloadFromText(text)  Validates, normalises pasted/typed text
 *  - reset()                   Clears all state back to idle
 */

import type { InputPayload, ProcessingResult, ProcessingState } from '@/types/audit';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface AppStoreState {
  inputPayload: InputPayload | null;
  processingResult: ProcessingResult | null;
  processingState: ProcessingState;
  validationError: string | null;
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _state: AppStoreState = {
  inputPayload: null,
  processingResult: null,
  processingState: 'idle',
  validationError: null,
};

type Listener = (state: AppStoreState) => void;
const _listeners = new Set<Listener>();

function getState(): AppStoreState {
  return _state;
}

function setState(patch: Partial<AppStoreState>): void {
  _state = { ..._state, ...patch };
  _listeners.forEach((l) => l(_state));
}

function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Exported store object
// ---------------------------------------------------------------------------

export const appStore = { getState, setState, subscribe };
