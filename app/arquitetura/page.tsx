import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Brand.tsx";
import { ArrowUpRight, Check, Alert } from "@/components/Icons.tsx";
import { ArchitectureDiagram } from "./Diagram.tsx";
import "../home.css";
import "./arquitetura.css";

export const metadata: Metadata = {
  title: "Arquitetura e segurança — Vigia Rural",
  description:
    "Arquitetura técnica, modelo de dados, modelo de ameaças, controles de segurança e enquadramento na LGPD da plataforma Vigia Rural.",
};

const CONTROLS: { threat: string; control: string; how: string; state: "feito" | "projeto" }[] = [
  {
    threat: "Trote e alarme em cadeia",
    control: "Balde de fichas por ação + carência proporcional ao alcance",
    how: "lib/ratelimit.ts — capacidade e recarga distintas por ação; a carência cresce com o número de pessoas mobilizadas e encurta com reputação alta.",
    state: "feito",
  },
  {
    threat: "Eco de uma única fonte parecendo confirmação",
    control: "Quórum entre organizações independentes",
    how: "lib/policy.ts — corroborações são contadas por organização distinta, dentro de 10 min e 1,5 km. Cinco pessoas da mesma fazenda contam como uma.",
    state: "feito",
  },
  {
    threat: "Uso da localização para identificar propriedade vazia",
    control: "Coordenada reduzida por padrão, exata sob concessão temporária",
    how: "lib/geo.ts (coarsen) + concessões com prazo em lib/store.ts. Cada liberação e cada revogação entram na trilha.",
    state: "feito",
  },
  {
    threat: "Ator sem vínculo acionando fora do território",
    control: "RBAC combinado com ABAC territorial",
    how: "lib/policy.ts — matriz papel×ação e escopo por propriedade, raio ou região. A negativa devolve motivo e sugestão, nunca um botão cinza.",
    state: "feito",
  },
  {
    threat: "Reescrita do histórico após a ocorrência",
    control: "Trilha append-only encadeada por SHA-256",
    how: "lib/audit.ts — serialização canônica, hash do evento sobre o hash anterior, verificação executável no dispositivo.",
    state: "feito",
  },
  {
    threat: "Perda de conectividade no momento do alerta",
    control: "Fila local, canais alternativos e cartografia offline",
    how: "Mapa vetorial gerado do próprio cadastro; barramento local persistente. SMS e voz entram como canais de nível Confirmado em diante.",
    state: "feito",
  },
  {
    threat: "Repúdio de autoria do alerta",
    control: "Assinatura no dispositivo e carimbo de tempo do servidor",
    how: "Chave não exportável (WebAuthn/Secure Enclave) assinando o payload; o servidor carimba e assina o último hash de cada janela.",
    state: "projeto",
  },
  {
    threat: "Comprometimento de conta legítima",
    control: "Detecção de anomalia e limitação progressiva",
    how: "Padrões atípicos de horário, deslocamento impossível e volume disparam degradação silenciosa com revisão humana.",
    state: "projeto",
  },
];

const TABLES: { name: string; purpose: string; fields: string }[] = [
  {
    name: "organizations",
    purpose: "Propriedades, brigadas e órgãos com registro verificável",
    fields: "id · nome · tipo · registro (CAR/CNPJ) · sede (lat, lon) · status",
  },
  {
    name: "people",
    purpose: "Pessoas com vínculo comprovado a uma organização",
    fields: "id · nome · organização · papel · reputação · verificado_por · chave_dispositivo",
  },
  {
    name: "parcels",
    purpose: "Talhões com cultura e curamento, base do risco por área",
    fields: "id · organização · nome · cultura · polígono · curamento",
  },
  {
    name: "assets",
    purpose: "Água, estruturas, aceiros e acessos — o que a resposta precisa saber",
    fields: "id · tipo · geometria · volume/ocupação · acesso_veiculo · crítico",
  },
  {
    name: "incidents",
    purpose: "Ocorrência com origem, nível, meteorologia e desfecho",
    fields: "id · código · nível · status · origem · precisão · talhão · clima · comando · desfecho",
  },
  {
    name: "incident_events",
    purpose: "Trilha append-only encadeada — a fonte da verdade",
    fields: "seq · ocorrência · ts · ator · ação · resumo · payload · hash_anterior · hash",
  },
  {
    name: "dispatches",
    purpose: "Recursos acionados, com ETA e ponto de reabastecimento",
    fields: "ocorrência · recurso · status · despachado_em · eta_min · fonte_agua",
  },
  {
    name: "location_grants",
    purpose: "Quem pode ver a coordenada exata e até quando",
    fields: "ocorrência · ator · organização · concedido_em · expira_em · concedido_por",
  },
];

export default function Arquitetura() {
  return (
    <div className="home doc">
      <header className="home__nav">
        <Link href="/">
          <Wordmark size={28} />
        </Link>
        <nav>
          <a href="#visao">Visão geral</a>
          <a href="#dados">Dados</a>
          <a href="#ameacas">Ameaças</a>
          <a href="#lgpd">LGPD</a>
          <a href="#modelos">Modelos</a>
        </nav>
        <div className="home__navcta">
          <Link href="/central" className="btn btn--primary">
            Central de Operações
          </Link>
        </div>
      </header>

      <section className="band doc__hero">
        <span className="eyebrow">Documento técnico</span>
        <h1>Arquitetura, segurança e limites do Vigia Rural.</h1>
        <p className="lede">
          Este documento existe porque a parte difícil do produto não é a tela —
          é o que acontece quando a rede é usada por quem não deveria, quando a
          internet cai no pior momento e quando alguém precisa provar, meses
          depois, o que foi feito.
        </p>
      </section>

      {/* -------------------------------------------------------- visão --- */}
      <section className="band" id="visao">
        <header className="band__head">
          <span className="eyebrow">Visão geral</span>
          <h2>Núcleo puro, borda fina, integração opcional.</h2>
          <p className="lede">
            Toda regra que decide algo — nível do alerta, quem pode agir, quem é
            avisado, como o fogo se espalha — vive em módulos sem dependência de
            framework, servidor ou navegador. É o que permite executar a mesma
            decisão no dispositivo e no servidor, testá-la isoladamente e
            reexecutá-la numa auditoria.
          </p>
        </header>

        <ArchitectureDiagram />

        <div className="doc__grid">
          <article>
            <h3>Dispositivo</h3>
            <p>
              App de campo e Central compartilham componentes e o mesmo núcleo.
              O estado da ocorrência é derivado de comandos; a tela nunca guarda
              verdade própria. Cartografia vetorial local elimina a dependência
              de tiles e evita vazar coordenadas para provedor externo.
            </p>
          </article>
          <article>
            <h3>Borda</h3>
            <p>
              Cloudflare Workers como camada de aplicação, D1 para persistência
              relacional e um Durable Object por ocorrência ativa, mantendo a
              sessão de tempo real e a ordem dos eventos. Fila local no
              dispositivo com reenvio idempotente cobre a queda de sinal.
            </p>
          </article>
          <article>
            <h3>Integrações</h3>
            <p>
              Focos de calor do INPE Queimadas e do NASA FIRMS como corroboração
              automática, CEMADEN para meteorologia, e protocolo estadual para
              encaminhamento ao Corpo de Bombeiros. Nenhuma delas é caminho
              crítico: o sistema opera sem todas.
            </p>
          </article>
          <article>
            <h3>Canais</h3>
            <p>
              App como canal padrão; SMS a partir do nível Confirmado; chamada
              de voz automatizada no nível Emergência, para quem não tem
              smartphone. A escolha do canal é consequência do nível, não do
              humor de quem aciona.
            </p>
          </article>
        </div>
      </section>

      {/* --------------------------------------------------------- dados -- */}
      <section className="band band--tint" id="dados">
        <header className="band__head">
          <span className="eyebrow">Modelo de dados</span>
          <h2>Oito tabelas, uma delas imutável.</h2>
          <p className="lede">
            O estado atual da ocorrência é uma projeção de{" "}
            <code>incident_events</code>. Nada é atualizado no lugar: corrigir
            algo significa registrar um novo evento, e é por isso que a trilha
            sustenta um laudo.
          </p>
        </header>

        <div className="doc__table">
          <table>
            <thead>
              <tr>
                <th>Tabela</th>
                <th>Papel</th>
                <th>Campos principais</th>
              </tr>
            </thead>
            <tbody>
              {TABLES.map((table) => (
                <tr key={table.name}>
                  <td>
                    <code>{table.name}</code>
                  </td>
                  <td>{table.purpose}</td>
                  <td className="doc__fields">{table.fields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------- ameaças -- */}
      <section className="band" id="ameacas">
        <header className="band__head">
          <span className="eyebrow">Modelo de ameaças</span>
          <h2>O que pode dar errado, e o que impede.</h2>
          <p className="lede">
            A ameaça mais provável não é um invasor sofisticado: é o uso
            legítimo que degrada a confiança da rede. Alarme falso repetido faz
            mais estrago que qualquer exploração técnica, porque desliga a
            notificação de todo mundo.
          </p>
        </header>

        <div className="doc__table doc__table--controls">
          <table>
            <thead>
              <tr>
                <th>Ameaça</th>
                <th>Controle</th>
                <th>Como</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {CONTROLS.map((row) => (
                <tr key={row.threat}>
                  <td>
                    <strong>{row.threat}</strong>
                  </td>
                  <td>{row.control}</td>
                  <td className="doc__fields">{row.how}</td>
                  <td>
                    <span className={`doc__state is-${row.state}`}>
                      {row.state === "feito" ? (
                        <>
                          <Check size={12} /> implementado
                        </>
                      ) : (
                        <>
                          <Alert size={12} /> projeto
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------- lgpd -- */}
      <section className="band band--tint" id="lgpd">
        <header className="band__head">
          <span className="eyebrow">Proteção de dados</span>
          <h2>LGPD sem o parágrafo decorativo.</h2>
        </header>

        <div className="doc__grid doc__grid--2">
          <article>
            <h3>Base legal</h3>
            <p>
              Proteção da vida e da incolumidade física do titular ou de
              terceiro (art. 7º, VII) durante a ocorrência; legítimo interesse
              (art. 7º, IX) para a operação da rede de prevenção, com teste de
              proporcionalidade documentado. Consentimento fica reservado ao que
              é opcional — como compartilhar histórico com uma cooperativa.
            </p>
          </article>
          <article>
            <h3>Minimização</h3>
            <p>
              O alerta carrega o mínimo para responder: quadrante, nível,
              evidência e papel do autor. Coordenada exata, telefone e dados da
              propriedade só circulam sob concessão com prazo, sempre
              registrada. Nenhum dado de localização vai a provedor de mapas de
              terceiros.
            </p>
          </article>
          <article>
            <h3>Retenção</h3>
            <p>
              Trilha de incidentes por 24 meses, prazo compatível com uso em
              laudo e apuração. Depois disso, os eventos permanecem
              pseudonimizados para estatística regional, sem identificação de
              pessoa natural. Telemetria operacional é agregada em 30 dias.
            </p>
          </article>
          <article>
            <h3>Direitos do titular</h3>
            <p>
              Acesso, correção e portabilidade pelo próprio app. A eliminação
              desliga o vínculo e apaga os dados cadastrais, preservando o
              registro histórico já pseudonimizado — sem isso, qualquer pessoa
              poderia apagar a prova do próprio alarme falso.
            </p>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------- modelos -- */}
      <section className="band" id="modelos">
        <header className="band__head">
          <span className="eyebrow">Modelos e referências</span>
          <h2>De onde vêm os números da tela.</h2>
          <p className="lede">
            São modelos publicados, simplificados para vegetação herbácea e
            declarados como aproximação. Servem para priorizar resposta, não
            para substituir avaliação de campo — e a interface sempre mostra a
            projeção como faixa, não como certeza.
          </p>
        </header>

        <div className="doc__models">
          <article>
            <h3>Propagação em pastagem</h3>
            <p className="doc__formula mono">
              R = (1,4 + 0,838·(U−5)^0,844) · Φm · Φc
            </p>
            <p>
              CSIRO Grassland Fire Spread Meter (Cheney, Gould &amp; Catchpole,
              1998), com U em km/h a 10 m, Φm derivado da umidade do material
              fino e Φc do grau de curamento. A geometria elíptica e a relação
              entre cabeça e retaguarda seguem Alexander (1985), com razão
              comprimento/largura ≈ 1,1·U^0,464.
            </p>
          </article>
          <article>
            <h3>Risco diário</h3>
            <p className="doc__formula mono">
              FMA+ = Σ (100 / H<sub>13h</sub>) · e^(0,04·v)
            </p>
            <p>
              Fórmula de Monte Alegre estendida (Soares, 1972; Nunes, Soares
              &amp; Batista, 2006), acumulada desde a última chuva significativa
              com os abatimentos oficiais por precipitação. É o índice de
              referência para risco de incêndio florestal no Brasil.
            </p>
          </article>
          <article>
            <h3>Umidade do material fino</h3>
            <p className="doc__formula mono">M = 9,58 − 0,205·T + 0,138·UR</p>
            <p>
              Estimativa empírica para pastagem exposta ao sol durante o dia,
              usada como entrada de Φm. Acima de 20 % de umidade o modelo deixa
              de sustentar propagação — e a interface passa a dizer isso em vez
              de projetar uma elipse falsa.
            </p>
          </article>
          <article>
            <h3>Tempo até o ativo</h3>
            <p className="doc__formula mono">
              t²(C²/A² − 1) − t(2uC/A²) + (u²/A² + v²/B²) = 0
            </p>
            <p>
              Como a elipse cresce linearmente no tempo, o instante em que a
              frente alcança um ponto sai de uma equação do segundo grau nas
              coordenadas rotacionadas para o eixo do vento. É o que produz o
              “chega no galpão em 14 min”.
            </p>
          </article>
        </div>
      </section>

      <footer className="home__foot">
        <Wordmark size={26} />
        <p>
          O código do núcleo é testado isoladamente: geodésia, propagação,
          índice de risco, autorização, escalonamento, limites e cadeia de
          auditoria têm testes automatizados que rodam sem navegador.
        </p>
        <div className="home__footlinks">
          <Link href="/">Início</Link>
          <Link href="/campo">App de campo</Link>
          <Link href="/central">
            Central de Operações <ArrowUpRight size={14} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
