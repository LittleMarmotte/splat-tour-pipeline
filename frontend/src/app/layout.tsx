import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Splat Tours — Visite 3D immobilière',
  description: 'Créez votre visite virtuelle 3D en quelques minutes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb', color: '#111' }}>
        {children}
      </body>
    </html>
  );
}
