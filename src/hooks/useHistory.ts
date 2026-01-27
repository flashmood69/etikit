import { useState, useCallback } from 'react';
import { EditorState } from '../types';

interface HistoryState {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
}

export function useHistory(initialState: EditorState) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, current.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory((current) => {
      const next = current.future[0];
      const newFuture = current.future.slice(1);

      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
  }, [canRedo]);

  const pushState = useCallback((nextState: EditorState) => {
    setHistory((current) => {
      // Don't push if the state is the same as the present
      if (JSON.stringify(current.present) === JSON.stringify(nextState)) {
        return current;
      }

      return {
        past: [...current.past, current.present].slice(-50), // Limit history to 50 steps
        present: nextState,
        future: [],
      };
    });
  }, []);

  const resetState = useCallback((nextState: EditorState) => {
    setHistory({
      past: [],
      present: nextState,
      future: [],
    });
  }, []);

  const replaceState = useCallback((nextState: EditorState) => {
    setHistory((current) => ({
      ...current,
      present: nextState,
    }));
  }, []);

  return {
    state: history.present,
    undo,
    redo,
    pushState,
    replaceState,
    resetState,
    canUndo,
    canRedo,
  };
}
