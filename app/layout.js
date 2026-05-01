import { Bebas_Neue, Caveat, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const bebas  = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--display-font" });
const caveat = Caveat({ weight: ["400", "700"], subsets: ["latin"], variable: "--hand-font" });
const dmSans = DM_Sans({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--body-font" });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-visual",
};

export const metadata = {
  metadataBase: new URL("https://yousureaboutthat.app"),
  title: "You Sure About That?",
  description: "Daily trivia game — wager your points, answer the question, and build your streak. One question a day. Don't miss it.",
  openGraph: {
    title: "You Sure About That?",
    description: "Daily trivia game — wager your points, answer the question, and build your streak. One question a day. Don't miss it.",
    url: "https://yousureaboutthat.app",
    siteName: "You Sure About That?",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "You Sure About That?",
    description: "Daily trivia game — wager your points, answer the question, and build your streak. One question a day. Don't miss it.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${bebas.variable} ${caveat.variable} ${dmSans.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
