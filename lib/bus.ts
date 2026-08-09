"use client";

/**
 * Transporte em tempo real entre as telas abertas.
 *
 * Em produção isto é um canal servidor→cliente (SSE sobre a borda, com um
 * Durable Object mantendo a sessão da ocorrência e fila offline no
 * dispositivo). Na demonstração o mesmo contrato roda sobre `BroadcastChannel`
 * com espelho em `localStorage`: o celular do produtor e a Central de
 * Operações, lado a lado, veem o mesmo estado no mesmo instante — e continuam
 * funcionando com a internet do evento caída.
 *
 * O estado vive fora do React, num store único por aba, e é lido por
 * `useSyncExternalStore`. É o primitivo certo: o dono da verdade é um sistema
 * externo (o canal), não um `useState` sincronizado na mão dentro de efeitos.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { EMPTY_STATE, type AppState } from "./domain.ts";
import { reduce, type Command } from "./store.ts";

const CHANNEL = "vigia-rural/v1";
const STORAGE_KEY = "vigia-rural:state:v1";
const PRESENCE_INTERVAL_MS = 2_500;
const PRESENCE_TTL_MS = 7_000;

export type PeerRole = "campo" | "central";

export type Peer = {
  id: string;
  role: PeerRole;
  label: string;
  lastSeen: number;
};

type Envelope =
  | { kind: "state"; from: string; state: AppState }
  | { kind: "presence"; from: string; role: PeerRole; label: string }
  | { kind: "bye"; from: string };

type Listener = () => void;

const NO_PEERS: Peer[] = [];

function readStored(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as AppState;
    if (typeof parsed?.version !== "number" || !Array.isArray(parsed.incidents))
      return EMPTY_STATE;
    return parsed;
  } catch {
    return EMPTY_STATE;
  }
}

function createBus() {
  const id = `t_${Math.random().toString(36).slice(2, 8)}`;

  let state: AppState = EMPTY_STATE;
  let peersSnapshot: Peer[] = NO_PEERS;
  let identity: { role: PeerRole; label: string } = { role: "campo", label: "" };
  let channel: BroadcastChannel | null = null;
  let timer = 0;
  let refCount = 0;

  const stateListeners = new Set<Listener>();
  const peerListeners = new Set<Listener>();
  const peers = new Map<string, Peer>();

  const emitState = () => {
    for (const listener of stateListeners) listener();
  };

  const emitPeers = () => {
    peersSnapshot = peers.size ? [...peers.values()] : NO_PEERS;
    for (const listener of peerListeners) listener();
  };

  const adopt = (incoming: AppState) => {
    // Versão monotônica resolve corrida entre abas sem coordenação central.
    if (incoming.version <= state.version) return;
    state = incoming;
    emitState();
  };

  const persist = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Cota cheia ou navegação privada: a sessão segue só em memória.
    }
  };

  const onMessage = (event: MessageEvent<Envelope>) => {
    const message = event.data;
    if (!message || message.from === id) return;
    if (message.kind === "state") adopt(message.state);
    else if (message.kind === "presence") {
      peers.set(message.from, {
        id: message.from,
        role: message.role,
        label: message.label,
        lastSeen: Date.now(),
      });
      emitPeers();
    } else if (message.kind === "bye" && peers.delete(message.from)) emitPeers();
  };

  // Espelho por storage: cobre navegadores sem BroadcastChannel e abas
  // restauradas depois de o aparelho dormir.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      adopt(JSON.parse(event.newValue) as AppState);
    } catch {
      // Payload corrompido: mantém o estado local.
    }
  };

  const announce = () => {
    channel?.postMessage({
      kind: "presence",
      from: id,
      role: identity.role,
      label: identity.label,
    } satisfies Envelope);
    const now = Date.now();
    let expired = false;
    for (const [peerId, peer] of peers)
      if (now - peer.lastSeen > PRESENCE_TTL_MS) {
        peers.delete(peerId);
        expired = true;
      }
    if (expired) emitPeers();
  };

  const sayGoodbye = () => {
    channel?.postMessage({ kind: "bye", from: id } satisfies Envelope);
  };

  const attach = () => {
    state = readStored();
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = onMessage;
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", sayGoodbye);
    timer = window.setInterval(announce, PRESENCE_INTERVAL_MS);
    announce();
    emitState();
  };

  const detach = () => {
    window.clearInterval(timer);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", sayGoodbye);
    sayGoodbye();
    channel?.close();
    channel = null;
    peers.clear();
    emitPeers();
  };

  const retain = () => {
    if (++refCount === 1) attach();
    return () => {
      if (--refCount === 0) detach();
    };
  };

  return {
    id,
    subscribeState(listener: Listener) {
      stateListeners.add(listener);
      const release = retain();
      return () => {
        stateListeners.delete(listener);
        release();
      };
    },
    subscribePeers(listener: Listener) {
      peerListeners.add(listener);
      const release = retain();
      return () => {
        peerListeners.delete(listener);
        release();
      };
    },
    getState: () => state,
    getPeers: () => peersSnapshot,
    identify(role: PeerRole, label: string) {
      identity = { role, label };
      announce();
    },
    dispatch(command: Command) {
      const next = reduce(state, command);
      if (next === state) return;
      state = next;
      persist();
      channel?.postMessage({
        kind: "state",
        from: id,
        state: next,
      } satisfies Envelope);
      emitState();
    },
  };
}

type Bus = ReturnType<typeof createBus>;

let busInstance: Bus | null = null;

/** Instância única por aba, criada só quando o navegador existe. */
function getBus(): Bus {
  if (!busInstance) busInstance = createBus();
  return busInstance;
}

const serverState = () => EMPTY_STATE;
const serverPeers = () => NO_PEERS;

export type BusApi = {
  state: AppState;
  dispatch: (command: Command) => void;
  peers: Peer[];
  selfId: string;
  online: boolean;
  reset: () => void;
};

/** Assina o estado compartilhado e anuncia a presença desta tela. */
export function useVigiaBus(role: PeerRole, label: string): BusApi {
  const bus = getBus();

  const state = useSyncExternalStore(
    bus.subscribeState,
    bus.getState,
    serverState,
  );
  const peers = useSyncExternalStore(
    bus.subscribePeers,
    bus.getPeers,
    serverPeers,
  );

  useEffect(() => {
    bus.identify(role, label);
  }, [bus, role, label]);

  const reset = useCallback(() => {
    bus.dispatch({ type: "limpar", at: Date.now() });
  }, [bus]);

  return {
    state,
    dispatch: bus.dispatch,
    peers,
    selfId: bus.id,
    online: useOnline(),
    reset,
  };
}

// ---------------------------------------------------------------------------
// Conectividade
// ---------------------------------------------------------------------------

const subscribeOnline = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

/** Conectividade real do aparelho — o app precisa se comportar sem ela. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

// ---------------------------------------------------------------------------
// Relógio
// ---------------------------------------------------------------------------

/**
 * Um único temporizador por intervalo, compartilhado por toda a página.
 * Sem isso, cada card com contagem regressiva abriria o seu — dezenas de
 * temporizadores desalinhados desenhando em quadros diferentes.
 */
function createTicker(intervalMs: number) {
  let now = 0;
  let timer = 0;
  const listeners = new Set<Listener>();

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        now = Date.now();
        timer = window.setInterval(() => {
          now = Date.now();
          for (const fn of listeners) fn();
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.clearInterval(timer);
      };
    },
    getSnapshot: () => now,
  };
}

const tickers = new Map<number, ReturnType<typeof createTicker>>();

function getTicker(intervalMs: number) {
  let ticker = tickers.get(intervalMs);
  if (!ticker) {
    ticker = createTicker(intervalMs);
    tickers.set(intervalMs, ticker);
  }
  return ticker;
}

const serverNow = () => 0;

/**
 * Instante atual em ms, ou 0 antes da montagem — o zero é proposital: as telas
 * usam isso para não renderizar horário no servidor e evitar divergência de
 * hidratação.
 */
export function useTicker(intervalMs = 1000): number {
  const ticker = getTicker(intervalMs);
  return useSyncExternalStore(ticker.subscribe, ticker.getSnapshot, serverNow);
}
