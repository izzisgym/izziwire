import { useState, useEffect } from 'react';

export default function Metrics() {
  const [data, setData] = useState<{ pending: number; publishedToday: number } | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
      <span>Pending: {data.pending}</span>
      <span>Published today: {data.publishedToday}</span>
    </div>
  );
}
