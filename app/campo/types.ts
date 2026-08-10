/** Abas do app de campo — em arquivo próprio para as telas não importarem a página. */
export type Tab = "inicio" | "mapa" | "rede" | "perfil";

/** Preferências do dispositivo, persistidas em `localStorage`. */
export type Settings = {
  /** Aumenta contraste de texto e bordas — pensado para sol a pino. */
  highContrast: boolean;
  /** Toca um aviso sonoro quando um alerta é enviado ou recebido. */
  soundAlerts: boolean;
  /** Inclui SMS como canal a partir do nível Confirmado. */
  smsNotify: boolean;
};
