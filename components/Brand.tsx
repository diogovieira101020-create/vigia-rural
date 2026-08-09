/**
 * Marca.
 *
 * O símbolo é um ponto de origem com três arcos que se abrem para fora — um
 * alerta partindo de um lugar e alcançando círculos cada vez maiores da rede.
 * O arco mais externo é da cor de emergência: o alcance máximo só é usado
 * quando o caso justifica.
 */

type MarkProps = {
  size?: number;
  className?: string;
  /** Fundo arredondado sólido, para uso sobre foto ou como ícone de app. */
  boxed?: boolean;
};

export function Logomark({ size = 28, className, boxed = false }: MarkProps) {
  const mark = (
    <>
      <circle cx="7" cy="17" r="2.7" fill="currentColor" />
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M7 11a6 6 0 0 1 6 6" opacity="0.95" />
        <path d="M7 7a10 10 0 0 1 10 10" opacity="0.55" />
      </g>
      <path
        d="M7 3a14 14 0 0 1 14 14"
        fill="none"
        stroke="var(--ember)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </>
  );

  if (!boxed)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        aria-hidden
        focusable="false"
      >
        {mark}
      </svg>
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="-4 -4 32 32"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect
        x="-4"
        y="-4"
        width="32"
        height="32"
        rx="9"
        fill="var(--brand)"
      />
      <g color="#fff">{mark}</g>
    </svg>
  );
}

type WordmarkProps = {
  size?: number;
  className?: string;
  /** Some com o texto abaixo de determinada largura. */
  compact?: boolean;
};

export function Wordmark({ size = 28, className, compact }: WordmarkProps) {
  return (
    <span
      className={`wordmark${compact ? " wordmark--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <Logomark size={size} className="wordmark__mark" />
      <span className="wordmark__text">
        Vigia <b>Rural</b>
      </span>
    </span>
  );
}
