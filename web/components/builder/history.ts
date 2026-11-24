"use client";

import { useCallback, useState } from "react";

// Annulla e ripristina. Le modifiche ravvicinate dello stesso campo (digitare un testo) fanno un solo passo.
const LIMIT = 100;
const COALESCE_MS = 900;

type State<T> = { past: T[]; present: T; future: T[]; group: string | null; at: number };

export function useHistory<T>(initial: T) {
  const [state, setState] = useState<State<T>>({ past: [], present: initial, future: [], group: null, at: 0 });

  const set = useCallback((next: T, group?: string) => {
    setState((s) => {
      if (next === s.present) return s;
      const now = Date.now();
      if (group && group === s.group && now - s.at < COALESCE_MS) {
        return { ...s, present: next, future: [], at: now };
      }
      return { past: [...s.past, s.present].slice(-LIMIT), present: next, future: [], group: group ?? null, at: now };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future], group: null, at: 0 };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return { past: [...s.past, s.present], present: next, future: rest, group: null, at: 0 };
    });
  }, []);

  // Nuovo punto di partenza senza passi da annullare (es. dopo un cambio di template confermato dal server).
  const reset = useCallback((next: T) => setState({ past: [], present: next, future: [], group: null, at: 0 }), []);

  return { present: state.present, set, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
