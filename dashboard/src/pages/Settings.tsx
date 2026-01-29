import { useState, useEffect } from 'react';

interface MetricsData {
  pending: number;
  publishedToday: number;
}

interface SettingsPayload {
  SCRAPE_INTERVAL_HOURS: number;
  USER_AGENT: string;
  DEFAULT_AI_MODEL: string;
  IMAGE_MODEL: string;
  SCRAPE_ENABLED: boolean;
  PUBLISH_ENABLED: boolean;
  NEWS_SEARCH_ENABLED: boolean;
  NEWS_TOPICS_POKEMON: string[];
  NEWS_TOPICS_ONEPIECE: string[];
  NEWS_TOPICS_MTG: string[];
}

export default function Settings() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [form, setForm] = useState<SettingsPayload | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const topicsToText = (topics: string[]) => topics.join('\n');
  const textToTopics = (value: string) =>
    value
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setForm(data);
      })
      .catch(() => {
        setSettings(null);
        setForm(null);
      });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('izziwire_api_key');
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem('izziwire_api_key', apiKey);
  }, [apiKey]);

  async function save() {
    if (!form) return;
    setSaveStatus(null);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const msg = await res.text();
      setSaveStatus(`Save failed: ${msg || res.status}`);
      return;
    }
    const data = (await res.json()) as SettingsPayload;
    setSettings(data);
    setForm(data);
    setSaveStatus('Saved');
  }

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
            <path d="M12 1v6" />
            <path d="M12 17v6" />
            <path d="M4.22 4.22l4.24 4.24" />
            <path d="M15.54 15.54l4.24 4.24" />
            <path d="M1 12h6" />
            <path d="M17 12h6" />
            <path d="M4.22 19.78l4.24-4.24" />
            <path d="M15.54 8.46l4.24-4.24" />
          </svg>
          App Settings
        </h2>
        <div style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
          <label>
            API key (required to save)
            <input
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
          {form ? (
            <>
              <label>
                Scrape interval (hours)
                <input
                  type="number"
                  min={1}
                  value={form.SCRAPE_INTERVAL_HOURS}
                  onChange={(e) =>
                    setForm({ ...form, SCRAPE_INTERVAL_HOURS: Number(e.target.value) || 1 })
                  }
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                User agent
                <input
                  type="text"
                  value={form.USER_AGENT}
                  onChange={(e) => setForm({ ...form, USER_AGENT: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                Default AI model
                <input
                  type="text"
                  value={form.DEFAULT_AI_MODEL}
                  onChange={(e) => setForm({ ...form, DEFAULT_AI_MODEL: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                Image model
                <input
                  type="text"
                  value={form.IMAGE_MODEL}
                  onChange={(e) => setForm({ ...form, IMAGE_MODEL: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.SCRAPE_ENABLED}
                  onChange={(e) => setForm({ ...form, SCRAPE_ENABLED: e.target.checked })}
                />
                Scraping enabled
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.NEWS_SEARCH_ENABLED}
                  onChange={(e) => setForm({ ...form, NEWS_SEARCH_ENABLED: e.target.checked })}
                />
                Claude news search enabled (open web)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.PUBLISH_ENABLED}
                  onChange={(e) => setForm({ ...form, PUBLISH_ENABLED: e.target.checked })}
                />
                Publishing enabled
              </label>
              <label>
                Pokemon topics (one per line)
                <textarea
                  rows={4}
                  value={topicsToText(form.NEWS_TOPICS_POKEMON)}
                  onChange={(e) =>
                    setForm({ ...form, NEWS_TOPICS_POKEMON: textToTopics(e.target.value) })
                  }
                  style={{ width: '100%', padding: 8, marginTop: 4, fontFamily: 'monospace' }}
                />
              </label>
              <label>
                One Piece topics (one per line)
                <textarea
                  rows={4}
                  value={topicsToText(form.NEWS_TOPICS_ONEPIECE)}
                  onChange={(e) =>
                    setForm({ ...form, NEWS_TOPICS_ONEPIECE: textToTopics(e.target.value) })
                  }
                  style={{ width: '100%', padding: 8, marginTop: 4, fontFamily: 'monospace' }}
                />
              </label>
              <label>
                MTG topics (one per line)
                <textarea
                  rows={4}
                  value={topicsToText(form.NEWS_TOPICS_MTG)}
                  onChange={(e) =>
                    setForm({ ...form, NEWS_TOPICS_MTG: textToTopics(e.target.value) })
                  }
                  style={{ width: '100%', padding: 8, marginTop: 4, fontFamily: 'monospace' }}
                />
              </label>
              <button onClick={save} style={{ padding: '10px 14px' }}>
                Save settings
              </button>
              {saveStatus && <div>{saveStatus}</div>}
              {settings && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Settings are stored in the database. Search interval changes take effect the next time the scheduler starts.
                </div>
              )}
            </>
          ) : (
            <div className="error-message">Failed to load settings</div>
          )}
        </div>
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
