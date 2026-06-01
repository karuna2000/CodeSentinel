

import type { InputPayload, ProcessingResult, ProcessingState } from '@/types/audit';

export interface AppStoreState {
  stagedPayload: InputPayload | null;
  inputPayload: InputPayload | null;
  processingResult: ProcessingResult | null;
  processingState: ProcessingState;
  validationError: string | null;
}

let _state: AppStoreState = {
  stagedPayload: null,
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

type SetStatePayload = Partial<AppStoreState> | ((prev: AppStoreState) => Partial<AppStoreState>);

function setState(patch: SetStatePayload): void {
  const nextPatch = typeof patch === 'function' ? patch(_state) : patch;
  _state = { ..._state, ...nextPatch };
  _listeners.forEach((l) => l(_state));
}

function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function resetStoreForTesting(): void {
  _state = {
    stagedPayload: null,
    inputPayload: null,
    processingResult: null,
    processingState: 'idle',
    validationError: null,
  };
  _listeners.clear();
}

export const appStore = { getState, setState, subscribe };
