import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

export const metadata = {
  title: "AI Video Assistant | Meeting Intelligence",
  description:
    "Transcribe, summarise, and chat with your meetings using AI. Powered by Whisper, Mistral, and Sarvam AI.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
