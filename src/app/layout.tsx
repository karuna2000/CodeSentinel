import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], variable: '--font-hd' });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: '--font-code' });
const lora = Lora({ subsets: ["latin"], weight: ["400", "500"], style: ['normal', 'italic'], variable: '--font-body' });

export const metadata: Metadata = {
  title: "AgentReview — Chat Mode",
  description: "Secure Code Review Agent platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${jetbrains.variable} ${lora.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
