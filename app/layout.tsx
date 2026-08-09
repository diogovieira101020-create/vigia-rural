import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Vigia Rural — a primeira resposta ao fogo, coordenada";
const description =
  "Plataforma de alerta geolocalizado para incêndios rurais: o produtor aciona, a rede certa recebe, a brigada despacha e tudo fica registrado. App de campo + Central de Operações.";

export const metadata: Metadata = {
  metadataBase: new URL("https://vigia-rural-alerta.borus-xd.chatgpt.site"),
  title,
  description,
  applicationName: "Vigia Rural",
  authors: [{ name: "Vigia Rural" }],
  keywords: [
    "incêndio rural",
    "queimada",
    "alerta geolocalizado",
    "brigada",
    "Defesa Civil",
    "agronomia",
    "MATOPIBA",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Vigia Rural — alerta geolocalizado para incêndios rurais",
      },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#070c0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
