import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { bodySans, displaySerif, mono } from "./fonts";
import "./globals.css";

/** Production origin for absolute Open Graph / Twitter image URLs. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://teamthink.reagent-systems.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "TeamThink — Shared WebGPU Inference Grid",
  description:
    "Spin up a session, invite devices, and run model inference across a peer-to-peer WebGPU grid.",
  openGraph: {
    title: "TeamThink — Shared WebGPU Inference Grid",
    description:
      "Spin up a session, invite devices, and run model inference across a peer-to-peer WebGPU grid.",
    url: siteUrl,
    siteName: "TeamThink",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "TeamThink — Serverless WebGPU Inference Grid",
        type: "image/png",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TeamThink — Shared WebGPU Inference Grid",
    description:
      "Spin up a session, invite devices, and run model inference across a peer-to-peer WebGPU grid.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${displaySerif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
