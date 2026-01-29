import { useState, useEffect } from 'react';

interface MetricsData {
  pending: number;
  publishedToday: number;
}

export default function Metrics() {
  const [data, setData] = useState<MetricsData | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <div className="metrics-bar">
      <div className="metric-card pending">
        <div className="metric-label">Pending Review</div>
        <div className="metric-value">{data.pending}</div>
      </div>
      <div className="metric-card published">
        <div className="metric-label">Published Today</div>
        <div className="metric-value">{data.publishedToday}</div>
      </div>
    </div>
  );
}
