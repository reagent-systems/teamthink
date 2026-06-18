import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

/** Serif display face for headings (Tiempos/Styrene-adjacent feel). */
export const displaySerif = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

/** Clean grotesque sans for body and UI. */
export const bodySans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Monospace for ids, code, and token streams. */
export const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});
