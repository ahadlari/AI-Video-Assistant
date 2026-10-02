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
          colorBackground: '#0d071b',
          colorText: '#faf8f5',
          colorTextOnPrimaryBackground: '#0d071b',
          colorInputBackground: 'rgba(25, 17, 44, 0.75)',
          colorInputText: '#faf8f5',
        },
        elements: {
          card: {
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            border: '1px solid rgba(242, 184, 36, 0.2)',
            background: 'rgba(25, 17, 44, 0.95)',
            backdropFilter: 'blur(10px)',
          },
          navbar: {
            background: 'transparent',
          },
          headerTitle: {
            color: '#f2b824',
            fontFamily: 'Outfit, sans-serif',
          },
          headerSubtitle: {
            color: '#9b90af',
          },
          dividerLine: {
            background: 'rgba(242, 184, 36, 0.2)',
          },
          dividerText: {
            color: '#9b90af',
          },
          formButtonPrimary: {
            fontWeight: '600',
            transition: 'all 0.2s ease',
          },
          socialButtonsBlockButton: {
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.03)',
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
