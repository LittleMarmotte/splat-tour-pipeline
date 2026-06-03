'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type JobStatus = {
  status: string;
  tour_url: string | null;
  error_message: string | null;
  updated_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_upload: 'En attente d\'upload…',
  uploaded: 'Vidéo reçue, lancement du GPU…',
  processing: 'Traitement GPU en cours (10-20 min)…',
  building: 'Génération de la visite 3D…',
  done: 'Visite 3D prête !',
  failed: 'Échec du traitement',
};

const TERMINAL = ['done', 'failed'];

export default function StatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${slug}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobStatus = await res.json();
        setJob(data);
        if (!TERMINAL.some(t => data.status.startsWith(t))) {
          timer = setTimeout(poll, 3000);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    poll();
    return () => clearTimeout(timer);
  }, [slug]);

  const isDone = job?.status === 'done';
  const isFailed = job?.status?.startsWith('failed');
  const isProcessing = !isDone && !isFailed;

  return (
    <main style={{ maxWidth: 520, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Statut de la visite</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 40, fontFamily: 'monospace' }}>{slug}</p>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>Erreur : {error}</p>
      )}

      {!job && !error && (
        <Spinner />
      )}

      {job && (
        <>
          <StatusBadge status={job.status} />
          <p style={{ marginTop: 16, fontSize: 15, color: '#374151' }}>
            {STATUS_LABELS[job.status] ?? job.status}
          </p>

          {isProcessing && !isFailed && (
            <div style={{ marginTop: 24 }}>
              <Spinner />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
                Cette page se met à jour automatiquement toutes les 3 secondes.
              </p>
            </div>
          )}

          {isDone && job.tour_url && (
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <a href={job.tour_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', padding: '14px 32px', background: '#000', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
                Voir la visite 3D
              </a>
              <details style={{ marginTop: 16, textAlign: 'left', width: '100%' }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b7280', userSelect: 'none' }}>
                  Code iframe à intégrer
                </summary>
                <pre style={{ marginTop: 8, background: '#f3f4f6', padding: 12, borderRadius: 6, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{`<iframe src="${job.tour_url}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}
                </pre>
              </details>
            </div>
          )}

          {isFailed && (
            <div style={{ marginTop: 24, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', textAlign: 'left' }}>
              <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>
                {job.error_message || 'Une erreur est survenue lors du traitement.'}
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'done' ? '#16a34a' : status.startsWith('failed') ? '#b91c1c' : '#d97706';
  const bg = status === 'done' ? '#f0fdf4' : status.startsWith('failed') ? '#fef2f2' : '#fffbeb';
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, color, background: bg, border: `1px solid ${color}` }}>
      {status}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, border: '3px solid #e5e7eb',
      borderTopColor: '#000', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', margin: '0 auto',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
