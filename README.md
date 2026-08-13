# Vigia Rural

Plataforma conceitual de comunicação em tempo real para incêndios rurais. Ao
detectar fogo, o produtor dispara um alerta geolocalizado que chega a vizinhos,
brigadas e autoridades **na ordem certa** — primeiro quem está no caminho do
vento, depois quem apaga, depois quem coordena — e a ocorrência inteira fica
registrada em uma trilha que ninguém consegue reescrever depois.

**Aplicação publicada:** [vigia-rural.vercel.app](https://vigia-rural.vercel.app)

Duas superfícies, um sistema:

| Rota | Para quem | Contexto |
| --- | --- | --- |
| `/apresentacao` | Plateia | Apresentação do conceito, do protocolo e do escopo |
| `/campo` | Produtor, colaborador, brigadista | Celular sob sol forte, tema claro, uma ação por tela |
| `/central` | Brigada e Defesa Civil | Monitor em turno longo, tema escuro, três painéis |
| `/arquitetura` | Banca técnica | Arquitetura, modelo de dados, ameaças, LGPD e modelos |

`/` redireciona direto para `/campo`: é o atalho que o app instalado (PWA) usa
para abrir em tela cheia sem passar pela apresentação — `start_url` no
`manifest.webmanifest` aponta para lá. Para mostrar o conceito a quem ainda
não conhece o produto, comece por `/apresentacao`.

As duas telas de operação compartilham o mesmo estado **em tempo real**, sem
servidor e sem internet: abra `/campo` e `/central` em janelas diferentes e
acione o alerta em uma para ver a outra reagir.

---

## Roteiro de demonstração (3 minutos)

Ensaiado para palco. Não precisa de rede.

**Antes de começar** — `npm run dev`, duas janelas lado a lado:
`/campo` à esquerda, `/central` à direita.

1. **O dia comum (20 s).** Aponte o card de risco no `/campo`: índice FMA+ 52,
   *muito alto*, 13 dias sem chuva, vento de 24 km/h.
   > "O produtor não abre este app por causa do fogo. Abre por causa disso —
   > e é por isso que ele já sabe usar quando o fogo vem."

2. **O acionamento (40 s).** Toque em **Detectei fogo**. Antes de enviar, a
   folha mostra o que vai acontecer: nível calculado, ~150 pessoas alcançadas,
   quem está a favor do vento. Segure o botão para enviar.
   > "Ele não escolhe o nível do alerta. A regra escolhe, e a regra é a mesma
   > para todo mundo."

3. **A rede responde (60 s).** Olhe a Central: a ocorrência entra na fila, o
   vizinho corrobora, o INPE confirma o foco por satélite, o protocolo eleva
   para **Emergência**, a brigada assume e despacha. No mapa, a frente de fogo
   cresce com o vento e os recursos se movem.
   > "Nada aqui é animação. É o modelo CSIRO de propagação em pastagem rodando
   > com o vento do momento."

4. **A decisão (40 s).** Aba **Ameaças**: o galpão de combustível em X minutos,
   a escola do assentamento fora da linha do vento. Aba **Resposta**: os
   recursos ordenados por tempo real de chegada, cada um com a água mais
   próxima já atribuída.
   > "Coordenação não é avisar todo mundo. É mandar quem chega primeiro, com
   > água, para o lugar certo."

5. **A prova (20 s).** Aba **Registro** → **Simular adulteração**. O sistema
   aponta o elo rompido.
   > "É isso que transforma a ocorrência em laudo de seguradora e em prova
   > para o órgão ambiental."

Atalhos úteis no palco: o seletor **1× / 6× / 20×** acelera o tempo simulado;
**Novo exercício** reinicia; o avatar no topo do `/campo` troca de papel para
mostrar que um colaborador só registra suspeita.

---

## Rodando

Requer Node.js `>= 22.13`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run verify   # typecheck + lint + testes + build
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (vinext / Cloudflare Workers) |
| `npm test` | Testes do núcleo, sem navegador (`node --test`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Migrações Drizzle, quando o D1 for ligado |

---

## Como o código está organizado

O princípio é um só: **toda regra que decide algo vive em função pura**, sem
framework, sem servidor e sem navegador. É o que permite rodar a mesma decisão
no aparelho (para responder sem rede) e na borda (porque o servidor não confia
no cliente), testá-la isoladamente e reexecutá-la numa auditoria.

```
lib/
  geo.ts         projeção local, distância, azimute, área, quadrante de privacidade
  fire.ts        propagação CSIRO, geometria elíptica, tempo até o ativo, FMA+
  policy.ts      RBAC + ABAC, protocolo de escalonamento, ondas de notificação
  ratelimit.ts   balde de fichas, carência por alcance, reputação
  audit.ts       trilha append-only encadeada por SHA-256
  domain.ts      tipos do domínio e relógio da ocorrência
  store.ts       redutor de comandos — o estado é derivado de eventos
  selectors.ts   projeções: frente de fogo, ameaças, recursos, alcance
  scenario.ts    cenário de Uruçuí (PI): talhões, água, aceiros, rede, clima
  director.ts    roteiro do que a rede externa faria (vizinho, satélite, brigada)
  bus.ts         tempo real entre telas (BroadcastChannel + localStorage)

components/      marca, ícones, mapa vetorial, primitivas de interface
app/campo/       app do produtor
app/central/     Central de Operações
app/arquitetura/ documento técnico
tests/           testes do núcleo — 88 casos, sem navegador
```

O mapa é **vetorial e próprio**, gerado do cadastro da propriedade. Nenhum tile
é baixado, nenhuma coordenada vai para provedor de mapas de terceiros, e o mapa
funciona sem sinal — três requisitos que um mapa de rua embutido não atende.

---

## O que está implementado e o que é projeto

**Funciona neste protótipo:** modelo de propagação com tempo estimado de
chegada por ativo; índice de risco FMA+ acumulado; motor de autorização com
motivo legível; protocolo de escalonamento com quórum entre organizações;
limites anti-abuso e reputação; trilha encadeada verificável na tela;
cartografia offline; sincronização em tempo real entre telas.

**Próximo passo de engenharia:** persistência na borda (D1) e canal servidor
por Durable Object; integração real com INPE Queimadas, NASA FIRMS e CEMADEN;
verificação de CAR e CPF/CNPJ em base oficial; envio real por SMS e voz; app
nativo com notificação crítica; carimbo de tempo assinado sobre o hash da
janela; calibração do modelo com dados regionais de combustível.

Os dados do cenário — propriedade, vizinhos, brigada, histórico meteorológico —
são fictícios e coerentes entre si. **Nenhum alerta real é emitido.**

---

## Modelos e referências

- **Propagação em pastagem** — CSIRO Grassland Fire Spread Meter (Cheney, Gould
  & Catchpole, 1998), com geometria elíptica de Alexander (1985).
- **Risco diário** — Fórmula de Monte Alegre estendida, FMA+ (Soares, 1972;
  Nunes, Soares & Batista, 2006).
- **Umidade do material fino** — relação empírica temperatura/UR para pastagem
  exposta ao sol.

São modelos simplificados, calibrados para vegetação herbácea, e a interface
sempre mostra a projeção como faixa de incerteza. Servem para priorizar
resposta, não para substituir avaliação de campo.

---

## Segurança em uma página

Uma rede de emergência é um alvo: quem sabe onde há fogo sabe onde não há
ninguém. E a ameaça mais provável não é um invasor sofisticado — é o alarme
falso repetido, que faz todo mundo desligar a notificação.

- **Identidade com vínculo** — documento, CAR ou credencial funcional, prova de
  vida e chave presa ao aparelho.
- **Autorização por papel e território** — RBAC combinado com ABAC; toda
  negativa devolve motivo e alternativa.
- **Localização reduzida por padrão** — a rede vê um quadrante de 1 km; a
  coordenada exata é liberada por tempo determinado e cada liberação é gravada.
- **Contenção de abuso** — balde de fichas por ação, carência proporcional ao
  número de pessoas mobilizadas, reputação que cai 22 pontos por alarme falso.
- **Trilha encadeada por hash** — SHA-256 encadeado, verificável no próprio
  dispositivo.
- **Degradação prevista** — fila local, SMS e voz como alternativas,
  cartografia sem rede.

O detalhamento, com modelo de ameaças e enquadramento na LGPD, está em
[`/arquitetura`](app/arquitetura/page.tsx).
