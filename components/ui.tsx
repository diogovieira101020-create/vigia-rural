"use client";

/**
 * Primitivas de interface compartilhadas pelo app de campo e pela Central.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, X } from "./Icons.tsx";

// ---------------------------------------------------------------------------
// Botão de manter pressionado
// ---------------------------------------------------------------------------

/**
 * Confirmação por pressão contínua.
 *
 * Substitui a caixa "eu confirmo" nas ações irreversíveis. Numa emergência
 * ninguém lê um termo — mas ninguém segura o dedo 1,2 s por acidente. O gesto
 * protege contra toque no bolso sem cobrar leitura de quem está com pressa,
 * e a barra de progresso deixa claro que a ação ainda pode ser abortada.
 */
export function HoldButton({
  children,
  onComplete,
  holdMs = 1200,
  disabled = false,
  tone = "danger",
  className,
}: {
  children: ReactNode;
  onComplete: () => void;
  holdMs?: number;
  disabled?: boolean;
  tone?: "danger" | "primary";
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(0);

  // A barra é animada pelo CSS, não quadro a quadro no React: um `setState` por
  // frame em um botão de emergência é justamente o tipo de trabalho que trava
  // a interface no aparelho fraco de quem mais precisa dela.
  const start = useCallback(() => {
    if (disabled || timerRef.current) return;
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = 0;
      setHolding(false);
      onComplete();
    }, holdMs);
  }, [disabled, holdMs, onComplete]);

  const stop = useCallback(() => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    setHolding(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <button
      type="button"
      className={`holdbtn holdbtn--${tone}${holding ? " is-holding" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={{ "--hold-ms": `${holdMs}ms` } as React.CSSProperties}
      disabled={disabled}
      aria-disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={stop}
      onBlur={stop}
    >
      <span className="holdbtn__fill" aria-hidden />
      <span className="holdbtn__label">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Folha inferior
// ---------------------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  kicker,
  children,
  tone = "neutral",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children: ReactNode;
  tone?: "neutral" | "danger";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`sheet sheet--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <span className="sheet__grip" aria-hidden />
        <button
          type="button"
          className="sheet__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
        <header className="sheet__head">
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h2>{title}</h2>
        </header>
        <div className="sheet__body scroll-slim">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aviso temporário
// ---------------------------------------------------------------------------

export type ToastState = {
  message: string;
  tone?: "ok" | "warn" | "error";
  detail?: string;
} | null;

export function Toast({
  state,
  onDismiss,
}: {
  state: ToastState;
  onDismiss: () => void;
}) {
  // `onDismiss` costuma ser uma seta declarada no corpo da página, ou seja, uma
  // função nova a cada render. Se ela entrasse nas dependências, o relógio de
  // 1 s reiniciaria o temporizador para sempre e o aviso nunca sumiria.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(
      () => dismissRef.current(),
      state.detail ? 6500 : 4200,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  if (!state) return null;

  return (
    <div className={`toast toast--${state.tone ?? "ok"}`} role="status">
      <span className="toast__icon" aria-hidden>
        {state.tone === "ok" || !state.tone ? <Check size={13} /> : "!"}
      </span>
      <div>
        <strong>{state.message}</strong>
        {state.detail && <small>{state.detail}</small>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medidor em arco — usado no índice de risco
// ---------------------------------------------------------------------------

export function Gauge({
  ratio,
  size = 96,
  stroke = 9,
  color = "var(--ember)",
  children,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * radius * 1.5; // arco de 270°
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference * 3}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * clamped} ${circumference * 3}`}
            style={{ transition: "stroke-dasharray .6s var(--ease-out)" }}
          />
        </g>
      </svg>
      <div className="gauge__value">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar de organização
// ---------------------------------------------------------------------------

export function OrgAvatar({
  initials,
  accent = "verde",
  size = 40,
  online,
}: {
  initials: string;
  accent?: string;
  size?: number;
  online?: boolean;
}) {
  return (
    <span
      className={`orgavatar orgavatar--${accent}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
      {online && <i aria-hidden />}
    </span>
  );
}
