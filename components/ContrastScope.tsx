"use client";

import { useEffect } from "react";

/**
 * Aplica o modo de alto contraste no elemento raiz.
 *
 * É o único item do painel de preferências que muda algo de verdade na
 * tela — os outros (som, SMS) ligam comportamento que só aparece durante uma
 * ocorrência. Este dá feedback visual imediato, o que importa para alguém
 * decidir se vale a pena deixar ligado.
 */
export function ContrastScope({ high }: { high: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    if (high) root.dataset.contrast = "alto";
    else delete root.dataset.contrast;
    return () => {
      delete root.dataset.contrast;
    };
  }, [high]);

  return null;
}
