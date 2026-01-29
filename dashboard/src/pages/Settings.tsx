import { useState, useEffect } from 'react';

interface MetricsData {
  pending: number;
  publishedToday: number;
}

export default function Settings() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your IzziWire dashboard</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10, verticalAlign: 'middle' }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          System Status
        </h2>
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Loading...
          </div>
        ) : metrics ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-warning)', marginBottom: 8 }}>
                {metrics.pending}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Pending Posts
              </div>
            </div>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-success)', marginBottom: 8 }}>
                {metrics.publishedToday}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Published Today
              </div>
            </div>
          </div>
        ) : (
          <div className="error-message">Failed to load metrics</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10, verticalAlign: 'middle' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          About IzziWire
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          IzziWire is an AI-powered social media agent for Trading Card Game communities.
          It automatically scrapes news from Pokemon, One Piece, and Magic: The Gathering sources,
          generates engaging social media content, and publishes to Facebook and Instagram.
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <span style={{
            background: 'var(--game-pokemon)',
            color: '#1a1a1a',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
          }}>Pokemon</span>
          <span style={{
            background: 'var(--game-onepiece)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
          }}>One Piece</span>
          <span style={{
            background: 'var(--game-mtg)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
          }}>Magic: The Gathering</span>
        </div>
      </div>
    </>
  );
}
