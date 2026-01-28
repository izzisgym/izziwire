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

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>News Sources</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Game</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
            <th style={{ textAlign: 'left', padding: 8 }}>URL</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Last scraped</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Active</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{s.name}</td>
              <td style={{ padding: 8 }}>{s.game}</td>
              <td style={{ padding: 8 }}>{s.sourceType}</td>
              <td style={{ padding: 8 }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.url.slice(0, 40)}…
                </a>
              </td>
              <td style={{ padding: 8 }}>
                {s.lastScrapedAt ? new Date(s.lastScrapedAt).toLocaleString() : '—'}
              </td>
              <td style={{ padding: 8 }}>
                <button
                  type="button"
                  onClick={() => toggleActive(s.id, s.isActive)}
                  style={{ cursor: 'pointer' }}
                >
                  {s.isActive ? 'On' : 'Off'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
