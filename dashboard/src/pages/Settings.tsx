import { useState, useEffect } from 'react';

export default function Settings() {
  const [metrics, setMetrics] = useState<{ pending: number; publishedToday: number } | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, []);

  return (
    <div>
      <h1>Settings</h1>
      <p>Non-secret app settings and metrics.</p>
      {metrics && (
        <div style={{ marginTop: 16 }}>
          <p>Pending posts: {metrics.pending}</p>
          <p>Published today: {metrics.publishedToday}</p>
        </div>
      )}
    </div>
  );
}
