import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vigia-rural-alerta.borus-xd.chatgpt.site"),
  title: "Vigia Rural — O campo responde junto",
  description: "Plataforma mobile de alerta geolocalizado que conecta produtores, empresas, brigadas e autoridades contra incêndios rurais.",
  openGraph: { title: "Vigia Rural — O campo responde junto", description: "Alerta preciso, pessoas certas e uma única visão da ocorrência.", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vigia Rural conectando o campo à rede de resposta" }] },
  twitter: { card: "summary_large_image", title: "Vigia Rural — O campo responde junto", description: "Alerta preciso, pessoas certas e uma única visão da ocorrência.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
