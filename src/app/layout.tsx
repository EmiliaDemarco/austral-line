import type { Metadata } from "next";
import { Hedvig_Letters_Sans, Hedvig_Letters_Serif } from "next/font/google";
import "./globals.css";

// Tipografías de Midday
const hedvigSans = Hedvig_Letters_Sans({ weight: "400", subsets: ["latin"], variable: "--font-hedvig-sans" });
const hedvigSerif = Hedvig_Letters_Serif({ weight: "400", subsets: ["latin"], variable: "--font-hedvig-serif" });

export const metadata: Metadata = {
  title: "Emprendimientos Austral",
  description: "Panel de administración",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${hedvigSans.variable} ${hedvigSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
