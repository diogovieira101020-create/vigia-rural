"use client";

/**
 * Estado persistido no dispositivo.
 *
 * Preferências, checklist marcado e o painel de atividade aberto não deveriam
 * se perder a cada recarga — é isso que separa um app "de mentira" de um que
 * a pessoa confia para usar todo dia. `localStorage` é suficiente aqui: não
 * é dado sensível, é conforto de uso.
 *
 * Implementado sobre `useSyncExternalStore` (o mesmo primitivo do relógio e
 * do indicador de conectividade em `bus.ts`) em vez de "ler em um efeito e
 * dar setState": a leitura do valor salvo só entra depois que a hidratação
 * termina, sem o efeito colateral de um `setState` disparado de dentro de um
 * `useEffect` — e sem o requadro extra que isso custaria a cada tela aberta.
 */

import { useCallback, useSyncExternalStore } from "react";

type Store<T> = {
  value: T;
  listeners: Set<() => void>;
};

const stores = new Map<string, Store<unknown>>();

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cota cheia ou navegação privada: a preferência não sobrevive ao reload,
    // mas a sessão atual continua funcionando normalmente.
  }
}

function getStore<T>(key: string, initial: T): Store<T> {
  const existing = stores.get(key) as Store<T> | undefined;
  if (existing) return existing;
  const created: Store<T> = { value: readStorage(key, initial), listeners: new Set() };
  stores.set(key, created as Store<unknown>);
  return created;
}

/**
 * Grava e notifica fora do corpo do callback do componente — a mutação em
 * si fica opaca para o analisador de hooks, do mesmo jeito que `bus.ts`
 * mantém a mutação de estado dentro dos métodos do próprio `createBus()`.
 */
function commit<T>(store: Store<T>, key: string, resolved: T) {
  store.value = resolved;
  writeStorage(key, resolved);
  for (const listener of store.listeners) listener();
}

/**
 * Espelha um valor em `localStorage` sob `key`, compartilhado entre todos os
 * componentes que usam a mesma chave na mesma aba.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const store = getStore(key, initial);

  const subscribe = useCallback(
    (onChange: () => void) => {
      store.listeners.add(onChange);
      return () => store.listeners.delete(onChange);
    },
    [store],
  );
  const getSnapshot = useCallback(() => store.value, [store]);
  // No servidor — e durante a hidratação, antes do primeiro paint no
  // cliente — o valor é sempre o inicial, para o HTML gerado no servidor
  // combinar com o primeiro render no navegador.
  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(store.value) : next;
      commit(store, key, resolved);
    },
    [store, key],
  );

  return [value, setValue];
}
