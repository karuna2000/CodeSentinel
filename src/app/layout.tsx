import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Lora } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], variable: '--font-hd' });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: '--font-code' });
const lora = Lora({ subsets: ["latin"], weight: ["400", "500"], style: ['normal', 'italic'], variable: '--font-body' });

export const metadata: Metadata = {
  title: "AgentReview — Chat Mode",
  description: "Secure Code Review Agent platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${playfair.variable} ${jetbrains.variable} ${lora.variable} antialiased`}>
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
