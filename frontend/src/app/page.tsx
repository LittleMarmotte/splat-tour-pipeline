import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Splat Tours</h1>
      <p style={{ color: '#555', marginBottom: 32 }}>
        Filmez un bien immobilier et recevez un lien de visite 3D par email.
      </p>
      <Link href="/upload" style={{
        display: 'inline-block', padding: '14px 32px',
        background: '#000', color: '#fff', borderRadius: 8,
        textDecoration: 'none', fontWeight: 600, fontSize: 16,
      }}>
        Créer une visite 3D
      </Link>
    </main>
  );
}
