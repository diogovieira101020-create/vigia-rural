"use client";

import { useEffect } from "react";

/**
 * Aplica o tema da rota no elemento raiz.
 *
 * O tema não é preferência de gosto: o app de campo é claro porque é usado sob
 * sol forte, e a Central é escura porque é usada em turno longo diante de um
 * monitor. Cada rota declara o seu, e a cor da barra do navegador acompanha.
 */
export function ThemeScope({
  theme,
  color,
}: {
  theme: "campo" | "ops";
  color: string;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    if (theme === "ops") root.dataset.theme = "ops";
    else delete root.dataset.theme;

    const meta =
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])') ??
      (() => {
        const el = document.createElement("meta");
        el.name = "theme-color";
        document.head.appendChild(el);
        return el;
      })();
    const previousColor = meta.content;
    meta.content = color;

    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
      meta.content = previousColor;
    };
  }, [theme, color]);

  return null;
}
