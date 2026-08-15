import type { Metadata } from "next";
import { Archivo_Black, Inter, Geist_Mono } from "next/font/google";
import SmoothScroll from "@/lib/smoothScroll";
import Cursor from "@/components/Cursor";
import "./globals.css";

const archivo = Archivo_Black({ weight: "400", variable: "--font-archivo", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Silent Co-Driver",
  description: "F1 regulates the thermometer. We monitor the human.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg">
        <SmoothScroll>
          <Cursor />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
