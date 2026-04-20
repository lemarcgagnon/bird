// src/store.js
// Mini-store inspiré de Zustand. API minimale :
//   const store = createStore(initialState);
//   store.getState()                           → état courant (lecture seule)
//   store.setState(patch)                      → merge superficiel + notifie
//   store.setState(prev => newState)           → forme fonctionnelle
//   store.subscribe(listener)                  → appelé à chaque changement
//   store.subscribeSelector(selector, cb)      → cb uniquement si la slice change
//
// Comparaison superficielle par === pour les sélecteurs : suffit si on évite
// les mutations en place sur les objets nichés (règle d'or Zustand).

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  const setState = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
    if (next === state) return;
    state = next;
    listeners.forEach(l => l(state));
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const subscribeSelector = (selector, callback) => {
    let prev = selector(state);
    return subscribe((s) => {
      const curr = selector(s);
      if (!shallowEqual(prev, curr)) {
        const old = prev;
        prev = curr;
        callback(curr, old);
      }
    });
  };

  return { getState, setState, subscribe, subscribeSelector };
}

// Égalité superficielle : deux primitives identiques, ou deux objets avec
// mêmes clés et mêmes valeurs par ===. Ne descend PAS dans les sous-objets.
function shallowEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}
