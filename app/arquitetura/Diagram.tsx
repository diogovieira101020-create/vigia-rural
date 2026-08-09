/**
 * Diagrama de arquitetura.
 *
 * Desenhado à mão em SVG para dizer uma coisa só: o núcleo de decisão é o
 * mesmo nas duas pontas. A caixa do meio atravessa o diagrama inteiro porque
 * as mesmas funções puras rodam no aparelho (para responder sem rede) e na
 * borda (para não confiar no que o aparelho diz).
 */

const SURFACES = [
  {
    title: "App de campo",
    body: "Produtor, colaborador, brigadista. Tema claro, uma ação por tela.",
  },
  {
    title: "Central de Operações",
    body: "Brigada e Defesa Civil. Fila, mapa e decisão em três painéis.",
  },
  {
    title: "SMS · voz · notificação",
    body: "Quem não tem smartphone ou está sem dados no momento do alerta.",
  },
];

const CORE = [
  { name: "geo", desc: "projeção, distância, quadrante" },
  { name: "fire", desc: "propagação, FMA+, ETA" },
  { name: "policy", desc: "RBAC + ABAC, escalonamento" },
  { name: "ratelimit", desc: "fichas, carência, reputação" },
  { name: "audit", desc: "cadeia SHA-256" },
];

const EDGE = [
  { title: "Worker de aplicação", body: "Valida, reexecuta a decisão e persiste" },
  { title: "Durable Object", body: "Uma sessão por ocorrência, ordem garantida" },
  { title: "D1 + R2", body: "Relacional e mídias, replicados na borda" },
];

/**
 * Quebra o texto em linhas que cabem na caixa.
 *
 * SVG não reflui texto, e cortar por contagem de caracteres parte palavra ao
 * meio. Aqui a quebra é por palavra, com largura estimada a partir da altura
 * da fonte — suficiente para caixas de largura conhecida.
 */
function wrap(text: string, maxChars: number, maxLines = 2): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function ArchitectureDiagram() {
  return (
    <figure className="diagram">
      <svg
        viewBox="0 0 920 430"
        role="img"
        aria-label="Diagrama em quatro camadas: superfícies, núcleo de domínio compartilhado, borda e fontes externas."
      >
        <defs>
          <marker
            id="diag-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="6"
            refY="4.5"
            orient="auto"
          >
            <path d="M0 1.5 L6 4.5 L0 7.5 z" fill="var(--line-strong)" />
          </marker>
        </defs>

        {/* Camada 1 — superfícies */}
        <text x="20" y="14" className="diagram__layer">
          SUPERFÍCIES
        </text>
        {SURFACES.map((item, index) => {
          const x = 20 + index * 305;
          return (
            <g key={item.title}>
              <rect
                x={x}
                y="24"
                width="280"
                height="80"
                rx="12"
                fill="var(--surface)"
                stroke="var(--line-strong)"
              />
              <text x={x + 16} y="50" className="diagram__title">
                {item.title}
              </text>
              {wrap(item.body, 42).map((line, lineIndex) => (
                <text
                  key={line}
                  x={x + 16}
                  y={70 + lineIndex * 16}
                  className="diagram__body"
                >
                  {line}
                </text>
              ))}
              <line
                x1={x + 140}
                y1="104"
                x2={x + 140}
                y2="142"
                stroke="var(--line-strong)"
                strokeWidth="1.4"
                markerEnd="url(#diag-arrow)"
              />
            </g>
          );
        })}

        {/* Camada 2 — núcleo */}
        <text x="20" y="138" className="diagram__layer">
          NÚCLEO DE DOMÍNIO
        </text>
        <rect
          x="20"
          y="150"
          width="880"
          height="96"
          rx="14"
          fill="var(--brand-soft)"
          stroke="var(--brand-line)"
        />
        {CORE.map((item, index) => {
          const x = 36 + index * 173;
          return (
            <g key={item.name}>
              <rect
                x={x}
                y="166"
                width="157"
                height="64"
                rx="10"
                fill="var(--surface)"
                stroke="var(--brand-line)"
              />
              <text x={x + 14} y="192" className="diagram__mono">
                {item.name}.ts
              </text>
              <text x={x + 14} y="212" className="diagram__body">
                {item.desc}
              </text>
            </g>
          );
        })}

        <line
          x1="460"
          y1="246"
          x2="460"
          y2="284"
          stroke="var(--line-strong)"
          strokeWidth="1.4"
          markerEnd="url(#diag-arrow)"
        />

        {/* Camada 3 — borda */}
        <text x="20" y="280" className="diagram__layer">
          BORDA
        </text>
        {EDGE.map((item, index) => {
          const x = 20 + index * 305;
          return (
            <g key={item.title}>
              <rect
                x={x}
                y="292"
                width="280"
                height="66"
                rx="12"
                fill="var(--surface)"
                stroke="var(--line-strong)"
              />
              <text x={x + 16} y="317" className="diagram__title">
                {item.title}
              </text>
              {wrap(item.body, 42).map((line, lineIndex) => (
                <text
                  key={line}
                  x={x + 16}
                  y={337 + lineIndex * 15}
                  className="diagram__body"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Camada 4 — fontes */}
        <rect
          x="20"
          y="378"
          width="880"
          height="40"
          rx="10"
          fill="none"
          stroke="var(--line-strong)"
          strokeDasharray="5 5"
        />
        <text x="36" y="403" className="diagram__body">
          Fontes externas, todas opcionais · INPE Queimadas · NASA FIRMS ·
          CEMADEN · protocolo CBMPI · operadora de SMS e voz
        </text>
      </svg>
      <figcaption>
        As setas descem: a superfície propõe, o núcleo decide, a borda confirma e
        grava. A mesma decisão roda no aparelho para responder sem rede — e é
        reexecutada na borda, porque o servidor não confia no cliente.
      </figcaption>
    </figure>
  );
}
