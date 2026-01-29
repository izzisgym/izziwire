import { useState, useEffect, useCallback } from 'react';
import PostCard, { type PendingPost } from '../components/PostCard';
import Metrics from '../components/Metrics';

const API_BASE = '/api';

export default function ApprovalQueue() {
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/posts/pending`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await fetchPending();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await fetchPending();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Reject failed');
    }
  };

  const handleSchedule = async (id: string, scheduledFor: string) => {
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date(scheduledFor).toISOString() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await fetchPending();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Schedule failed');
    }
  };

  return (
    <>
      <Metrics />
      <div className="page-header">
        <h1 className="page-title">Approval Queue</h1>
        <p className="page-subtitle">
          {posts.length} post{posts.length !== 1 ? 's' : ''} awaiting your review
        </p>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          Loading posts...
        </div>
      )}

      {error && (
        <div className="error-message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>All caught up!</h3>
          <p>No posts pending approval right now.</p>
        </div>
      )}

      {!loading && !error && posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onApprove={handleApprove}
          onReject={handleReject}
          onSchedule={handleSchedule}
        />
      ))}
    </>
  );
}
