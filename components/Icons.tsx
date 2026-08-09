/**
 * Conjunto de ícones do produto.
 *
 * Desenhados aqui em vez de importados de uma biblioteca por três motivos:
 * o app precisa funcionar sem rede (nenhum arquivo externo), o traço precisa
 * ser o mesmo em todos eles (1,6 px, pontas redondas, grade de 24) e alguns
 * são específicos do domínio — aceiro, talhão, pipa, foco de satélite.
 */

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const base = (size: number, strokeWidth: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
  focusable: false as const,
});

function make(path: React.ReactNode) {
  return function Icon({ size = 20, className, strokeWidth = 1.6 }: IconProps) {
    return <svg {...base(size, strokeWidth, className)}>{path}</svg>;
  };
}

/*
 * Fogo — massa cheia, é o único ícone que não é de traço: precisa pesar mais
 * que os outros. A ponta é assimétrica e há um recorte no flanco direito;
 * sem isso a silhueta fecha demais e o ícone passa a ler como gota d'água,
 * que num app de incêndio é exatamente o contrassenso a evitar.
 */
export function Flame({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M12.4 1.7c-.3-.5-1-.4-1.2.1-.5 1.4-1.4 2.5-2.5 3.6C7.2 7 4.9 9 4.9 12.6c0 4 3.2 7.2 7.1 7.2s7.1-3.2 7.1-7.2c0-2.4-1-4.1-2.2-5.6-.3-.4-1-.3-1.2.2-.3.8-.7 1.5-1.3 2.1.4-2.9-.4-5.4-2-7.6Z" />
      <path
        d="M12 19.8c-1.9 0-3.4-1.5-3.4-3.4 0-1.3.7-2.2 1.5-3 .6-.6 1.2-1.2 1.5-2 .2-.5.8-.5 1 0 .4.9.9 1.5 1.4 2.1.7.8 1.4 1.6 1.4 2.9 0 1.9-1.5 3.4-3.4 3.4Z"
        fill="rgba(255,255,255,.44)"
      />
    </svg>
  );
}

export const Smoke = make(
  <>
    <path d="M4 17h11.5a3 3 0 1 0-1.1-5.8A4.5 4.5 0 0 0 6.2 12" />
    <path d="M6 20.5h9" />
    <path d="M13 7.5c1.2-1 1.2-2.6 0-3.5" />
    <path d="M16.5 8.2c1.8-1.5 1.8-3.9 0-5.2" />
  </>,
);

export const Satellite = make(
  <>
    <path d="m6.5 10.5 7 7" />
    <path d="M9.4 4.6 4.6 9.4a1.4 1.4 0 0 0 0 2l1.9 1.9a1.4 1.4 0 0 0 2 0l4.8-4.8a1.4 1.4 0 0 0 0-2l-1.9-1.9a1.4 1.4 0 0 0-2 0Z" />
    <path d="m14.2 14.2 5.2 5.2a1.5 1.5 0 0 1-2.1 2.1l-5.2-5.2" />
    <path d="M15.5 3a5.5 5.5 0 0 1 5.5 5.5" />
    <path d="M15.5 6.5a2 2 0 0 1 2 2" />
  </>,
);

export const Wind = make(
  <>
    <path d="M3 8.5h9.5a2.75 2.75 0 1 0-2.75-2.75" />
    <path d="M3 12.5h13a3 3 0 1 1-3 3" />
    <path d="M3 16.5h6.5" />
  </>,
);

export const Drop = make(
  <path d="M12 3.2c3 3.4 5.8 6.3 5.8 9.6A5.8 5.8 0 0 1 12 20.8a5.8 5.8 0 0 1-5.8-8c0-3.3 2.8-6.2 5.8-9.6Z" />,
);

export const Truck = make(
  <>
    <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V16H2Z" />
    <path d="M14 10h3.6a2 2 0 0 1 1.7 1l1.7 3v2H14Z" />
    <circle cx="6" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </>,
);

export const Tractor = make(
  <>
    <path d="M4 13V7h5l2 5" />
    <path d="M11 12h6" />
    <path d="M17 8v5" />
    <circle cx="7" cy="16.5" r="3.5" />
    <circle cx="17.5" cy="17" r="2.5" />
  </>,
);

export const Drone = make(
  <>
    <rect x="9" y="9" width="6" height="6" rx="1.6" />
    <path d="M9.4 9.4 6 6M14.6 9.4 18 6M9.4 14.6 6 18M14.6 14.6 18 18" />
    <circle cx="4.6" cy="4.6" r="2" />
    <circle cx="19.4" cy="4.6" r="2" />
    <circle cx="4.6" cy="19.4" r="2" />
    <circle cx="19.4" cy="19.4" r="2" />
  </>,
);

export const Users = make(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2" />
    <path d="M17.5 14.9c2 .7 3.5 2.3 3.5 4.6" />
  </>,
);

export const Shield = make(
  <>
    <path d="M12 2.8 4.8 5.6v5.9c0 4.3 3 8.2 7.2 9.7 4.2-1.5 7.2-5.4 7.2-9.7V5.6Z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </>,
);

export const Pin = make(
  <>
    <path d="M12 21.5c4-4.4 6.2-7.6 6.2-10.4a6.2 6.2 0 1 0-12.4 0c0 2.8 2.2 6 6.2 10.4Z" />
    <circle cx="12" cy="11" r="2.4" />
  </>,
);

export const Crosshair = make(
  <>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 1.8v3.2M12 19v3.2M22.2 12H19M5 12H1.8" />
  </>,
);

export const Alert = make(
  <>
    <path d="M12 3.6 2.6 19.4h18.8Z" />
    <path d="M12 9.4v4.4" />
    <path d="M12 17h.01" />
  </>,
);

export const Check = make(<path d="m4.5 12.5 5 5 10-11" />);

export const X = make(<path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />);

export const ChevronRight = make(<path d="m9 5 7 7-7 7" />);

export const ChevronDown = make(<path d="m5 9 7 7 7-7" />);

export const ArrowUpRight = make(
  <>
    <path d="M7 17 17 7" />
    <path d="M8.5 7H17v8.5" />
  </>,
);

export const Clock = make(
  <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 6.6V12l3.4 2" />
  </>,
);

export const Radio = make(
  <>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4" />
    <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" />
  </>,
);

export const Layers = make(
  <>
    <path d="m12 3 8.5 4.5L12 12 3.5 7.5Z" />
    <path d="m4.6 12 7.4 4 7.4-4" />
    <path d="m4.6 16.4 7.4 4 7.4-4" />
  </>,
);

export const Lock = make(
  <>
    <rect x="4.4" y="10" width="15.2" height="10.4" rx="2.4" />
    <path d="M8 10V7.4a4 4 0 0 1 8 0V10" />
    <path d="M12 14v2.6" />
  </>,
);

export const Eye = make(
  <>
    <path d="M1.8 12S5.6 5.6 12 5.6 22.2 12 22.2 12 18.4 18.4 12 18.4 1.8 12 1.8 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </>,
);

export const EyeOff = make(
  <>
    <path d="M9.6 6a9.7 9.7 0 0 1 2.4-.3c6.4 0 10.2 6.3 10.2 6.3a17.7 17.7 0 0 1-3 3.7" />
    <path d="M6 7.7A17.4 17.4 0 0 0 1.8 12S5.6 18.3 12 18.3c1.5 0 2.8-.3 4-.9" />
    <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </>,
);

export const Home = make(
  <>
    <path d="M3.6 10.4 12 3.6l8.4 6.8V20a.9.9 0 0 1-.9.9h-4.6v-6h-5.8v6H4.5a.9.9 0 0 1-.9-.9Z" />
  </>,
);

export const MapIcon = make(
  <>
    <path d="m2.8 6.4 6-2.6v13.8l-6 2.6Z" />
    <path d="m8.8 3.8 6.4 2.6v13.8L8.8 17.6Z" />
    <path d="m15.2 6.4 6-2.6v13.8l-6 2.6Z" />
  </>,
);

export const Bell = make(
  <>
    <path d="M6.2 10.4a5.8 5.8 0 1 1 11.6 0c0 4.2 1.6 5.6 1.6 5.6H4.6s1.6-1.4 1.6-5.6Z" />
    <path d="M10.2 19.2a2 2 0 0 0 3.6 0" />
  </>,
);

export const FileText = make(
  <>
    <path d="M13.4 2.8H6.6a1.8 1.8 0 0 0-1.8 1.8v14.8a1.8 1.8 0 0 0 1.8 1.8h10.8a1.8 1.8 0 0 0 1.8-1.8V8.4Z" />
    <path d="M13.4 2.8v5.6h5.8" />
    <path d="M8.6 13h6.8M8.6 16.6h4.8" />
  </>,
);

export const Link = make(
  <>
    <path d="M10.2 13.8a3.6 3.6 0 0 0 5.4.4l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.5 1.5" />
    <path d="M13.8 10.2a3.6 3.6 0 0 0-5.4-.4l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.5-1.5" />
  </>,
);

export const Activity = make(
  <path d="M2.8 12h4l2.6-7 4.4 14 2.8-7h4.6" />,
);

export const Thermometer = make(
  <>
    <path d="M13.8 13.4V5.2a1.8 1.8 0 1 0-3.6 0v8.2a4 4 0 1 0 3.6 0Z" />
    <path d="M12 16.4v-3" />
  </>,
);

export const Aceiro = make(
  <>
    <path d="M2.6 15.4h18.8" />
    <path d="M2.6 19h18.8" />
    <path d="M4.6 8.6v-2M8.2 9.4v-3M11.8 8.2v-2.4M15.4 9.4v-3M19 8.6v-2" />
    <path d="M2.6 11.8h18.8" strokeDasharray="2.4 2.6" />
  </>,
);

export const Parcel = make(
  <>
    <rect x="3" y="3.6" width="18" height="16.8" rx="1.8" />
    <path d="M3 12h18" />
    <path d="M12 3.6v8.4" />
  </>,
);

export const Phone = make(
  <path d="M8.1 3.6H5.4a2 2 0 0 0-2 2.2c.5 6.9 6 12.4 12.9 12.9a2 2 0 0 0 2.1-2v-2.7l-3.9-1.3-1.8 1.8a13.6 13.6 0 0 1-5.3-5.3l1.8-1.8Z" />,
);

export const Message = make(
  <path d="M20.4 12.6c0 3.9-3.8 7-8.4 7a9.9 9.9 0 0 1-3-.5l-5 1.6 1.6-4a6.5 6.5 0 0 1-1.4-4.1c0-3.9 3.8-7 8.4-7s7.8 3.1 7.8 7Z" />,
);

export const Signal = make(
  <>
    <path d="M4 20v-4.4M9.3 20v-8M14.7 20v-12M20 20V4" />
  </>,
);

export const Play = make(<path d="M7 4.6 19 12 7 19.4Z" />);

export const Pause = make(<path d="M8.6 5v14M15.4 5v14" />);

export const Plus = make(<path d="M12 5v14M5 12h14" />);

export const Minus = make(<path d="M5 12h14" />);
