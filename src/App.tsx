import { useEffect, useState } from 'react';
import DevAuthTest from './features/auth/DevAuthTest';

type ApiState = 'checking' | 'online' | 'offline';

// Final visual design remains a placeholder until references are approved.
function FoundationPage() {
  const [api, setApi] = useState<ApiState>('checking');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Health endpoint unavailable');
        return response.json() as Promise<{ status: string }>;
      })
      .then((data) => setApi(data.status === 'ok' ? 'online' : 'offline'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setApi('offline');
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <p className="eyebrow">CANNED RESPONSE ARCHIVE</p>
      <h1>Project foundation</h1>
      <p className="intro">
        React, TypeScript, and the Cloudflare API Worker are configured.
        The search interface and visual design will be built from approved references.
      </p>
      <section className="status-card" aria-label="Backend connection status">
        <div className="status-heading">
          <span className={`indicator ${api}`} aria-hidden="true" />
          <strong>Development API</strong>
        </div>
        <p role="status" aria-live="polite">
          {api === 'checking' ? 'Checking /api/health…' :
            api === 'online' ? 'Connected. The backend health check is responding.' :
              'Offline. Check the development server and API Worker.'}
        </p>
      </section>
      <p className="footnote">This is a development preview, not the finished archive.</p>
    </main>
  );
}

export default function App() {
  return window.location.pathname === '/dev/auth-test' ? <DevAuthTest /> : <FoundationPage />;
}
