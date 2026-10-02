import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import "./globals.css";

export const metadata = {
  title: "AI Video Assistant | Meeting Intelligence",
  description:
    "Transcribe, summarise, and chat with your meetings using AI. Powered by Whisper, Mistral, and Sarvam AI.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#f2b824',
          colorTextOnPrimaryBackground: '#0d071b',
        },
        elements: {
          card: {
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            border: '1px solid rgba(242, 184, 36, 0.2)',
          },
          headerTitle: {
            color: '#f2b824',
            fontFamily: 'Outfit, sans-serif',
          },
          formButtonPrimary: {
            fontWeight: '600',
            transition: 'all 0.2s ease',
          },
          footer: {
            display: 'none',
          }
        }
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
