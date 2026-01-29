import { useState, useEffect } from 'react';

interface Source {
  id: string;
  name: string;
  game: string;
  sourceType: string;
  url: string;
  rssFeedUrl?: string | null;
  scrapeSelector?: Record<string, string> | null;
  isActive: boolean;
  lastScrapedAt: string | null;
  priority: number;
}

interface SourceForm {
  name: string;
  game: string;
  sourceType: string;
  url: string;
  rssFeedUrl: string;
  priority: number;
  isActive: boolean;
  scrapeSelectorJson: string;
}

export default function NewsSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [form, setForm] = useState<SourceForm>({
    name: '',
    game: 'pokemon',
    sourceType: 'rss',
    url: '',
    rssFeedUrl: '',
    priority: 5,
    isActive: true,
    scrapeSelectorJson: '',
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sources')
      .then((r) => r.json())
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/sources/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: !isActive } : s))
      );
    } catch {
      // ignore
    }
  };

  const addSource = async () => {
    setStatus(null);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      game: form.game,
      sourceType: form.sourceType,
      url: form.url.trim(),
      rssFeedUrl: form.rssFeedUrl.trim() || undefined,
      priority: form.priority,
      isActive: form.isActive,
    };
    if (form.scrapeSelectorJson.trim()) {
      try {
        payload.scrapeSelector = JSON.parse(form.scrapeSelectorJson);
      } catch {
        setStatus('Invalid scrape selector JSON');
        return;
      }
    }
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text();
      setStatus(`Add failed: ${msg || res.status}`);
      return;
    }
    const created = (await res.json()) as Source;
    setSources((prev) => [created, ...prev]);
    setForm({
      name: '',
      game: 'pokemon',
      sourceType: 'rss',
      url: '',
      rssFeedUrl: '',
      priority: 5,
      isActive: true,
      scrapeSelectorJson: '',
    });
    setStatus('Source added');
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">News Sources</h1>
        <p className="page-subtitle">Manage your TCG news sources for content generation</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Add Source</h2>
        <div style={{ maxWidth: 560, display: 'grid', gap: 12 }}>
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
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Game
            <select
              value={form.game}
              onChange={(e) => setForm({ ...form, game: e.target.value })}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            >
              <option value="pokemon">Pokemon</option>
              <option value="onepiece">One Piece</option>
              <option value="mtg">Magic: The Gathering</option>
            </select>
          </label>
          <label>
            Source type
            <select
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            >
              <option value="rss">RSS</option>
              <option value="web">Web</option>
              <option value="api">API</option>
            </select>
          </label>
          <label>
            URL
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            RSS feed URL (optional)
            <input
              type="text"
              value={form.rssFeedUrl}
              onChange={(e) => setForm({ ...form, rssFeedUrl: e.target.value })}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Priority
            <input
              type="number"
              min={1}
              max={10}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <label>
            Scrape selector JSON (optional)
            <textarea
              rows={4}
              placeholder='{"list": "article", "title": "h2"}'
              value={form.scrapeSelectorJson}
              onChange={(e) => setForm({ ...form, scrapeSelectorJson: e.target.value })}
              style={{ width: '100%', padding: 8, marginTop: 4, fontFamily: 'monospace' }}
            />
          </label>
          <button onClick={addSource} style={{ padding: '10px 14px' }}>
            Add source
          </button>
          {status && <div>{status}</div>}
        </div>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          Loading sources...
        </div>
      )}

      {!loading && sources.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <h3>No sources configured</h3>
          <p>Add news sources to start generating content.</p>
        </div>
      )}

      {!loading && sources.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Game</th>
                <th>Type</th>
                <th>URL</th>
                <th>Last Scraped</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>
                    <span className={`game-badge ${s.game.toLowerCase()}`}>
                      {s.game}
                    </span>
                  </td>
                  <td style={{ textTransform: 'uppercase', fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.sourceType}
                  </td>
                  <td>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                      {s.url.length > 35 ? `${s.url.slice(0, 35)}...` : s.url}
                    </a>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {s.lastScrapedAt
                      ? new Date(s.lastScrapedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`status-badge ${s.isActive ? 'active' : 'inactive'}`}
                      onClick={() => toggleActive(s.id, s.isActive)}
                      style={{ cursor: 'pointer', border: 'none', background: 'inherit' }}
                    >
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: s.isActive ? 'var(--accent-success)' : 'var(--accent-danger)',
                        display: 'inline-block',
                      }} />
                      {s.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
