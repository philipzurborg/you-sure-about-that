import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
