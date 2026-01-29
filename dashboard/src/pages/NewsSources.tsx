import { useState, useEffect } from 'react';

interface Source {
  id: string;
  name: string;
  game: string;
  sourceType: string;
  url: string;
  isActive: boolean;
  lastScrapedAt: string | null;
  priority: number;
}

export default function NewsSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: !isActive } : s))
      );
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">News Sources</h1>
        <p className="page-subtitle">Manage your TCG news sources for content generation</p>
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
