'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'form' | 'uploading' | 'notifying' | 'done' | 'error';

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  // Stored after step (a) so retry can skip re-upload
  const [savedSlug, setSavedSlug] = useState('');
  const [savedUploadUrl, setSavedUploadUrl] = useState('');
  const [savedR2Path, setSavedR2Path] = useState('');
  const [savedRecordId, setSavedRecordId] = useState('');
  const [uploadDone, setUploadDone] = useState(false);

  const n8nBase = process.env.NEXT_PUBLIC_N8N_URL!;

  async function createTour(): Promise<{ slug: string; upload_url: string; r2_video_path: string; airtable_record_id: string }> {
    const res = await fetch(`${n8nBase}/webhook/new-tour`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_email: email, address }),
    });
    if (!res.ok) throw new Error(`Webhook new-tour: ${res.status}`);
    return res.json();
  }

  async function uploadVideo(uploadUrl: string, videoFile: File) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'video/mp4');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(videoFile);
    });
  }

  async function notifyUploadDone(slug: string, r2VideoPath: string, airtableRecordId: string) {
    const res = await fetch(`${n8nBase}/webhook/upload-done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, r2_video_path: r2VideoPath, airtable_record_id: airtableRecordId }),
    });
    if (!res.ok) throw new Error(`Webhook upload-done: ${res.status}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');

    try {
      let slug = savedSlug;
      let uploadUrl = savedUploadUrl;
      let r2Path = savedR2Path;
      let recordId = savedRecordId;

      // Step (a): create tour job if not already done
      if (!slug) {
        const data = await createTour();
        slug = data.slug;
        uploadUrl = data.upload_url;
        r2Path = data.r2_video_path;
        recordId = data.airtable_record_id;
        setSavedSlug(slug);
        setSavedUploadUrl(uploadUrl);
        setSavedR2Path(r2Path);
        setSavedRecordId(recordId);
      }

      // Step (b): upload video if not already done
      if (!uploadDone) {
        setStep('uploading');
        await uploadVideo(uploadUrl, file);
        setUploadDone(true);
      }

      // Step (c): notify n8n
      setStep('notifying');
      await notifyUploadDone(slug, r2Path, recordId);

      // Step (d): redirect to status page
      setStep('done');
      router.push(`/status/${slug}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('form');
    }
  }

  const canRetry = !!savedSlug && uploadDone && step === 'form';

  return (
    <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Nouvelle visite 3D</h1>
      <p style={{ color: '#555', marginBottom: 32, fontSize: 14 }}>
        Filmez le bien en marchant lentement dans toutes les pièces (format MP4, max 2 Go).
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Email agent</label>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="agent@agence.fr"
            style={inputStyle}
            disabled={step !== 'form'}
          />
        </div>

        <div>
          <label style={labelStyle}>Adresse du bien</label>
          <input
            type="text" required value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="15 rue Mozart, 75016 Paris"
            style={inputStyle}
            disabled={step !== 'form'}
          />
        </div>

        <div>
          <label style={labelStyle}>Vidéo (MP4)</label>
          <input
            ref={fileRef} type="file" required accept="video/mp4,video/*"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={inputStyle}
            disabled={step !== 'form'}
          />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#b91c1c' }}>
            {error}
            {canRetry && (
              <span style={{ marginLeft: 8, fontWeight: 600 }}>
                — La vidéo est déjà uploadée, cliquez sur «&nbsp;Réessayer&nbsp;» pour relancer uniquement l'étape suivante.
              </span>
            )}
          </div>
        )}

        {step === 'uploading' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>Upload en cours…</span><span>{progress}%</span>
            </div>
            <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6 }}>
              <div style={{ background: '#000', height: 6, borderRadius: 4, width: `${progress}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {step === 'notifying' && (
          <p style={{ fontSize: 13, color: '#555' }}>Lancement du traitement GPU…</p>
        )}

        <button
          type="submit"
          disabled={step !== 'form' || !file}
          style={{
            padding: '14px', background: step !== 'form' ? '#9ca3af' : '#000',
            color: '#fff', borderRadius: 8, border: 'none',
            fontWeight: 600, fontSize: 16, cursor: step !== 'form' ? 'not-allowed' : 'pointer',
          }}
        >
          {canRetry ? 'Réessayer' : 'Créer la visite 3D'}
        </button>
      </form>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 14, boxSizing: 'border-box', background: '#fff',
};
