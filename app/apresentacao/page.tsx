import Link from "next/link";
import { Wordmark } from "@/components/Brand.tsx";
import {
  Activity,
  Alert,
  ArrowUpRight,
  Check,
  Drop,
  FileText,
  Flame,
  Link as LinkIcon,
  Lock,
  Radio,
  Satellite,
  Shield,
  Signal,
  Users,
  Wind,
} from "@/components/Icons.tsx";
import { HeroShowcase } from "../HeroShowcase.tsx";
import "../home.css";

export default function Home() {
  return (
    <div className="home">
      <header className="home__nav">
        <Wordmark size={28} />
        <nav>
          <a href="#protocolo">Protocolo</a>
          <a href="#decisoes">Decisões</a>
          <a href="#seguranca">Segurança</a>
          <Link href="/arquitetura">Arquitetura</Link>
        </nav>
        <div className="home__navcta">
          <Link href="/campo" className="btn btn--ghost">
            App de campo
          </Link>
          <Link href="/central" className="btn btn--primary">
            Central de Operações
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="hero">
        <div className="hero__copy">
          <span className="chip chip--ember">
            <Flame size={13} /> Resposta cooperativa a incêndios rurais
          </span>
          <h1>
            O primeiro minuto
            <br />
            decide o resto
            <br />
            do incêndio.
          </h1>
          <p className="lede">
            Detectar fogo é a parte fácil — quem está lá já viu. O que falta é
            coordenação: avisar quem está no caminho antes de avisar o resto,
            mandar quem chega primeiro com água suficiente, e sair da ocorrência
            com um registro que sustente laudo e apuração.
          </p>
          <div className="hero__cta">
            <Link href="/campo" className="btn btn--danger">
              <Flame size={17} /> Abrir o app de campo
            </Link>
            <Link href="/central" className="btn btn--ghost">
              <Activity size={17} /> Abrir a Central
            </Link>
          </div>
          <p className="hero__tip">
            Abra as duas em janelas separadas: elas compartilham a mesma
            ocorrência em tempo real, mesmo sem internet.
          </p>
        </div>
        <HeroShowcase />
      </section>

      {/* --------------------------------------------------------- problema */}
      <section className="band" id="problema">
        <header className="band__head">
          <span className="eyebrow">O problema real</span>
          <h2>Não falta gente disposta. Falta informação chegando na ordem certa.</h2>
        </header>
        <div className="cards cards--3">
          <article className="card pad">
            <span className="card__icon card__icon--ember">
              <Radio size={19} />
            </span>
            <h3>O aviso vira ruído</h3>
            <p>
              Um grupo de mensagens dispara para todo mundo ao mesmo tempo, sem
              dizer onde é, para onde o fogo caminha nem o que já foi feito.
              Quem está longe se assusta; quem está no caminho não se move.
            </p>
          </article>
          <article className="card pad">
            <span className="card__icon card__icon--amber">
              <Drop size={19} />
            </span>
            <h3>Quem responde chega às cegas</h3>
            <p>
              A brigada sai sem saber qual porteira abre, onde há açude com
              acesso para pipa, o que está plantado no talhão e quantas pessoas
              moram no rumo do vento. Perde-se o tempo que mais valia.
            </p>
          </article>
          <article className="card pad">
            <span className="card__icon card__icon--azure">
              <FileText size={19} />
            </span>
            <h3>Depois, ninguém prova nada</h3>
            <p>
              Sem registro confiável de horário, autor e resposta, a ocorrência
              não sustenta laudo de seguradora, comprovação ambiental nem
              apuração de causa. O aprendizado se perde junto com a área.
            </p>
          </article>
        </div>
      </section>

      {/* -------------------------------------------------------- protocolo */}
      <section className="band band--tint" id="protocolo">
        <header className="band__head">
          <span className="eyebrow">O protocolo das duas chaves</span>
          <h2>Rápido não é o mesmo que impulsivo.</h2>
          <p className="lede">
            Se a rede toca por qualquer motivo, as pessoas desligam a
            notificação — e aí o alerta verdadeiro também não chega. O nível do
            alerta não é escolhido por quem aciona: ele é <em>calculado</em> a
            partir de quem é a pessoa, de quantas fontes independentes existem e
            do risco do dia.
          </p>
        </header>

        <ol className="ladder">
          <li className="ladder__step is-1">
            <div className="ladder__mark">
              <span>01</span>
              <b>Suspeita</b>
            </div>
            <div className="ladder__body">
              <p>
                Qualquer pessoa verificada relata. Vai só para a rede imediata,
                num raio de 3 km, pelo app. Não toca sirene, não acorda a
                cidade.
              </p>
              <span className="ladder__who">
                <Users size={14} /> colaborador, vizinho, produtor
              </span>
            </div>
          </li>
          <li className="ladder__step is-2">
            <div className="ladder__mark">
              <span>02</span>
              <b>Confirmado</b>
            </div>
            <div className="ladder__body">
              <p>
                Responsável habilitado ou brigadista declara fogo ativo —{" "}
                <em>ou</em> duas organizações distintas relatam o mesmo foco em
                10 minutos. Alcança 8 km em volta e 15 km a favor do vento, por
                app e SMS.
              </p>
              <span className="ladder__who">
                <Shield size={14} /> produtor responsável, brigada credenciada
              </span>
            </div>
          </li>
          <li className="ladder__step is-3">
            <div className="ladder__mark">
              <span>03</span>
              <b>Emergência</b>
            </div>
            <div className="ladder__body">
              <p>
                Coordenação de brigada, autoridade pública, ou quórum humano
                validado por foco de calor de satélite em dia de risco muito
                alto. Aciona 15 km em volta, 30 km a favor do vento, com voz e
                órgãos.
              </p>
              <span className="ladder__who">
                <Satellite size={14} /> coordenador, Defesa Civil, Bombeiros,
                INPE
              </span>
            </div>
          </li>
        </ol>

        <p className="band__note">
          Cinco pessoas da mesma fazenda contam como uma fonte só. Corroboração
          que vale é a de organizações independentes — é o que distingue
          confirmação de eco.
        </p>
      </section>

      {/* --------------------------------------------------------- decisões */}
      <section className="band" id="decisoes">
        <header className="band__head">
          <span className="eyebrow">O que o sistema decide</span>
          <h2>Três decisões que hoje são tomadas no grito.</h2>
        </header>

        <div className="decisions">
          <article>
            <span className="decisions__num">1</span>
            <div>
              <h3>
                <Wind size={18} /> Quem avisar primeiro
              </h3>
              <p>
                O alerta não é um ponto, é uma direção. O modelo de propagação
                em pastagem (CSIRO, Cheney&nbsp;et&nbsp;al., 1998) projeta a
                elipse do fogo com o vento do momento e ordena a notificação em
                três ondas: primeiro quem está no setor a favor do vento, depois
                quem combate, depois quem coordena.
              </p>
              <ul className="decisions__facts">
                <li>
                  <b>Onda 1</b> vizinhos a jusante do vento, com tempo estimado
                  de chegada da frente
                </li>
                <li>
                  <b>Onda 2</b> recursos de combate com água e acesso
                </li>
                <li>
                  <b>Onda 3</b> coordenação pública e acompanhamento
                </li>
              </ul>
            </div>
          </article>

          <article>
            <span className="decisions__num">2</span>
            <div>
              <h3>
                <Drop size={18} /> Com o que responder
              </h3>
              <p>
                Recursos são ordenados por tempo real de chegada — velocidade em
                estrada de terra, sinuosidade da malha rural e preparo do
                veículo —, não por distância em linha reta. Cada opção já vem
                com autonomia de água e o ponto de reabastecimento mais próximo
                do foco com acesso para caminhão.
              </p>
              <ul className="decisions__facts">
                <li>
                  <b>Autonomia</b> litros embarcados ÷ vazão de combate
                </li>
                <li>
                  <b>Água</b> açude, poço e reservatório com acesso verificado
                </li>
                <li>
                  <b>Ativos</b> tempo até galpão de combustível, moradias e
                  escola
                </li>
              </ul>
            </div>
          </article>

          <article>
            <span className="decisions__num">3</span>
            <div>
              <h3>
                <LinkIcon size={18} /> O que fica provado
              </h3>
              <p>
                Cada evento da ocorrência carrega o hash SHA-256 do anterior.
                Alterar um registro antigo quebra todos os elos seguintes, e a
                verificação roda no próprio dispositivo — dá para conferir a
                cadeia inteira ao vivo, e ver o sistema acusar uma adulteração
                simulada.
              </p>
              <ul className="decisions__facts">
                <li>
                  <b>Laudo</b> área, linha do tempo, recursos e participantes
                </li>
                <li>
                  <b>Apuração</b> alarme falso reduz o limite de acionamento do
                  autor
                </li>
                <li>
                  <b>Retenção</b> 24 meses para a trilha, pseudonimização depois
                </li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------------------- 2 telas */}
      <section className="band band--dark" id="telas">
        <header className="band__head">
          <span className="eyebrow">Um sistema, dois contextos</span>
          <h2>A mesma ocorrência, duas cabeças diferentes.</h2>
        </header>

        <div className="screens">
          <Link href="/campo" className="screens__card">
            <span className="screens__tag">Celular · tema claro</span>
            <h3>App de campo</h3>
            <p>
              Sol a pino, poeira na tela e pressa. Uma ação primária por tela,
              nada de texto miúdo, confirmação por pressão contínua e o alcance
              do alerta mostrado antes do envio. Abre todo dia pelo índice de
              risco, não só na emergência.
            </p>
            <ul>
              <li>
                <Check size={14} /> Índice FMA+ do dia com recomendação
                operacional
              </li>
              <li>
                <Check size={14} /> Mapa próprio de talhões, aceiros e água
              </li>
              <li>
                <Check size={14} /> Centro de confiança com limites e reputação
                reais
              </li>
            </ul>
            <span className="screens__go">
              Abrir <ArrowUpRight size={16} />
            </span>
          </Link>

          <Link href="/central" className="screens__card screens__card--ops">
            <span className="screens__tag">Monitor · tema escuro</span>
            <h3>Central de Operações</h3>
            <p>
              Turno longo acompanhando várias ocorrências. Três painéis fixos —
              fila por gravidade, mapa vivo e painel de decisão — com despacho,
              ondas de notificação, ameaças por tempo de chegada e o registro
              auditável na mesma tela.
            </p>
            <ul>
              <li>
                <Check size={14} /> Despacho por tempo de chegada e autonomia
              </li>
              <li>
                <Check size={14} /> Aceleração do tempo simulado (1×, 6×, 20×)
              </li>
              <li>
                <Check size={14} /> Verificação da cadeia de auditoria ao vivo
              </li>
            </ul>
            <span className="screens__go">
              Abrir <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------- segurança */}
      <section className="band" id="seguranca">
        <header className="band__head">
          <span className="eyebrow">Segurança e privacidade</span>
          <h2>Uma rede de emergência é um alvo. O projeto assume isso.</h2>
          <p className="lede">
            Quem sabe onde há fogo sabe onde não há ninguém. Localização, aqui,
            é dado sensível — e o sistema é desenhado para o caso em que alguém
            tenta usá-lo contra a rede.
          </p>
        </header>

        <div className="controls">
          {[
            {
              icon: <Shield size={18} />,
              title: "Identidade com vínculo",
              body: "Documento, CAR da propriedade ou credencial funcional, prova de vida e chave presa ao aparelho. Sem vínculo comprovado, ninguém aciona.",
            },
            {
              icon: <Lock size={18} />,
              title: "Localização reduzida por padrão",
              body: "A rede recebe um quadrante de 1 km. A coordenada exata é liberada só a quem aceita a ocorrência, por tempo determinado, e cada liberação é registrada.",
            },
            {
              icon: <Users size={18} />,
              title: "Autorização por papel e território",
              body: "RBAC combinado com ABAC: o brigadista age no raio dele, o produtor na propriedade dele, a autoridade na região. Negativa sempre vem com motivo.",
            },
            {
              icon: <Alert size={18} />,
              title: "Contenção de abuso",
              body: "Balde de fichas por ação, carência proporcional ao número de pessoas mobilizadas e reputação que cai 22 pontos a cada alarme falso confirmado.",
            },
            {
              icon: <LinkIcon size={18} />,
              title: "Trilha encadeada por hash",
              body: "Log append-only com SHA-256 encadeado e verificação no dispositivo. Adulterar um registro antigo rompe a cadeia de forma visível.",
            },
            {
              icon: <Signal size={18} />,
              title: "Degradação prevista",
              body: "Fila local com reenvio, SMS e voz como canais alternativos, mapa que funciona sem tile externo e nenhuma coordenada enviada a provedor de terceiros.",
            },
          ].map((item) => (
            <article key={item.title} className="controls__item">
              <span>{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>

        <Link href="/arquitetura" className="band__link">
          Ver a arquitetura técnica completa, o modelo de ameaças e o
          enquadramento na LGPD <ArrowUpRight size={16} />
        </Link>
      </section>

      {/* --------------------------------------------------------- honestidade */}
      <section className="band band--tint" id="escopo">
        <header className="band__head">
          <span className="eyebrow">Escopo honesto</span>
          <h2>O que já roda aqui e o que ainda é projeto.</h2>
        </header>

        <div className="scope">
          <div className="scope__col">
            <h3>
              <Check size={17} /> Funcionando neste protótipo
            </h3>
            <ul>
              <li>Modelo de propagação CSIRO com geometria elíptica e ETA por ativo</li>
              <li>Índice de risco FMA+ acumulado em série de 14 dias</li>
              <li>Motor de autorização RBAC + ABAC com motivo legível</li>
              <li>Protocolo de escalonamento com quórum entre organizações</li>
              <li>Limites anti-abuso por balde de fichas e reputação</li>
              <li>Trilha de auditoria encadeada por SHA-256, verificável na tela</li>
              <li>Cartografia vetorial própria, sem dependência de rede</li>
              <li>Sincronização entre telas em tempo real</li>
            </ul>
          </div>
          <div className="scope__col scope__col--next">
            <h3>
              <Activity size={17} /> Próximo passo de engenharia
            </h3>
            <ul>
              <li>Persistência na borda (D1) e canal servidor por Durable Object</li>
              <li>Integração real com INPE Queimadas, NASA FIRMS e CEMADEN</li>
              <li>Onboarding verificando CAR e CPF/CNPJ em base oficial</li>
              <li>Envio real por SMS e voz com operadora e fallback offline</li>
              <li>App nativo com notificação crítica e sirene local</li>
              <li>Carimbo de tempo assinado pelo servidor sobre o hash da janela</li>
              <li>Calibração do modelo com dados regionais de combustível</li>
            </ul>
          </div>
        </div>

        <p className="band__note">
          Os dados do cenário — propriedade, vizinhos, brigada e histórico
          meteorológico — são fictícios e coerentes entre si. Nenhum alerta real
          é emitido por esta demonstração.
        </p>
      </section>

      <footer className="home__foot">
        <Wordmark size={26} />
        <p>
          Concebido para o Cerrado do MATOPIBA, onde a estiagem é longa, as
          propriedades são grandes e a resposta pública fica a dezenas de
          quilômetros. Referências: Cheney, Gould &amp; Catchpole (1998) para
          propagação em pastagem; Soares (1972) e Nunes, Soares &amp; Batista
          (2006) para a Fórmula de Monte Alegre.
        </p>
        <div className="home__footlinks">
          <Link href="/campo">App de campo</Link>
          <Link href="/central">Central de Operações</Link>
          <Link href="/arquitetura">Arquitetura</Link>
        </div>
      </footer>
    </div>
  );
}
