/**
 * Bindings da plataforma declarados para o TypeScript.
 *
 * `.openai/hosting.json` decide quais existem em tempo de execução; por isso
 * `DB` é opcional, e `getDb()` explica o erro quando o binding não foi
 * provisionado. A demonstração roda inteira sem banco — o D1 só entra quando a
 * persistência de ocorrências for ligada.
 */

declare global {
  namespace Cloudflare {
    interface Env {
      ASSETS: Fetcher;
      DB?: D1Database;
    }
  }
}

export {};
