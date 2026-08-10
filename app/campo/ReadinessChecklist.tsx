"use client";

/**
 * Checklist de prontidão.
 *
 * O app não deveria servir só para o dia do incêndio. Prevenção é rotina —
 * aceiro limpo, extintor no lugar, contato salvo — e uma lista que marca e
 * lembra do que falta é o tipo de coisa que faz alguém abrir o app de novo
 * na terça-feira comum, não só no dia ruim.
 *
 * Persistido por organização: cada propriedade tem sua própria lista.
 */

import { useMemo } from "react";
import { usePersistentState } from "@/lib/storage.ts";
import { Check } from "@/components/Icons.tsx";
import type { ToastState } from "@/components/ui.tsx";

const ITEMS = [
  {
    id: "aceiros",
    label: "Aceiros limpos e com faixa mínima de 6 m",
    detail: "Vistoriar antes do pico da estiagem, não durante.",
  },
  {
    id: "extintor",
    label: "Extintores no galpão e nas casas verificados",
    detail: "Carga válida e fácil acesso — não trancado em depósito.",
  },
  {
    id: "agua",
    label: "Reservatório e acesso de pipa desobstruídos",
    detail: "A brigada precisa entrar com o caminhão sem parar no portão.",
  },
  {
    id: "contatos",
    label: "Contatos da brigada e Defesa Civil salvos no celular",
    detail: "Inclusive de quem substitui o responsável em uma ausência.",
  },
  {
    id: "combustivel",
    label: "Combustível e material inflamável fora de rota de fogo",
    detail: "Galpão de máquinas é o primeiro item da lista de risco.",
  },
  {
    id: "familia",
    label: "Rota de saída conhecida por quem mora na propriedade",
    detail: "Inclusive colaboradores e visitantes de longa permanência.",
  },
] as const;

export function ReadinessChecklist({
  orgId,
  onToast,
}: {
  orgId: string;
  onToast: (toast: ToastState) => void;
}) {
  const [checked, setChecked] = usePersistentState<Record<string, boolean>>(
    `vigia-rural:checklist:${orgId}`,
    {},
  );

  const done = useMemo(
    () => ITEMS.filter((item) => checked[item.id]).length,
    [checked],
  );
  const ratio = done / ITEMS.length;

  const toggle = (id: string, label: string) => {
    const next = !checked[id];
    setChecked((prev) => ({ ...prev, [id]: next }));
    onToast({
      message: next ? "Item marcado como pronto" : "Item voltou a pendente",
      detail: label,
    });
  };

  return (
    <section className="checklist" aria-labelledby="checklist-title">
      <div className="checklist__head">
        <div>
          <span className="eyebrow">Prevenção · rotina</span>
          <h3 id="checklist-title">Checklist de prontidão</h3>
        </div>
        <div className="checklist__progress">
          <span className="checklist__bar">
            <span style={{ width: `${ratio * 100}%` }} />
          </span>
          <b className="num">
            {done}/{ITEMS.length}
          </b>
        </div>
      </div>
      <ul>
        {ITEMS.map((item) => {
          const isDone = Boolean(checked[item.id]);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={isDone ? "is-done" : undefined}
                onClick={() => toggle(item.id, item.label)}
                aria-pressed={isDone}
              >
                <span className="checklist__mark">
                  {isDone && <Check size={13} />}
                </span>
                <span className="checklist__body">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
