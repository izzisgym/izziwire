import { useState, useEffect, useCallback } from 'react';
import PostCard, { type PendingPost } from '../components/PostCard';
import Metrics from '../components/Metrics';

const API_BASE = '/api';

export default function ApprovalQueue() {
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const apiKey = localStorage.getItem('izziwire_api_key') || '';

  const headers = useCallback(
    (extra?: Record<string, string>) => ({
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...extra,
    }),
    [apiKey],
  );

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
    setActionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/approve`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setActionStatus('Post approved');
      await fetchPending();
    } catch (e) {
      setActionStatus(`Approve failed: ${e instanceof Error ? e.message : 'error'}`);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    setActionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/reject`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setActionStatus('Post rejected');
      await fetchPending();
    } catch (e) {
      setActionStatus(`Reject failed: ${e instanceof Error ? e.message : 'error'}`);
    }
  };

  const handleSchedule = async (id: string, scheduledFor: string) => {
    setActionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/schedule`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ scheduledFor: new Date(scheduledFor).toISOString() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setActionStatus('Post scheduled');
      await fetchPending();
    } catch (e) {
      setActionStatus(`Schedule failed: ${e instanceof Error ? e.message : 'error'}`);
    }
  };

  const handlePublish = async (id: string) => {
    setActionStatus(null);
    try {
      setActionStatus('Publishing...');
      const res = await fetch(`${API_BASE}/posts/${id}/publish`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const parts: string[] = [];
      if (data.wordpress) parts.push(`WordPress #${data.wordpress.id}${data.wordpress.link ? ` — ${data.wordpress.link}` : ''}`);
      if (data.facebook) parts.push('Facebook');
      if (data.instagram) parts.push('Instagram');
      const msg = parts.length
        ? `Published to ${parts.join(', ')}`
        : data.alreadyPublished
          ? 'Already published to all selected platforms'
          : 'Published (no new platforms)';
      if (data.errors?.length) setActionStatus(`${msg}. Warnings: ${data.errors.join('; ')}`);
      else setActionStatus(msg);
      await fetchPending();
    } catch (e) {
      setActionStatus(`Publish failed: ${e instanceof Error ? e.message : 'error'}`);
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

      {actionStatus && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            background: actionStatus.toLowerCase().includes('fail')
              ? 'rgba(239, 68, 68, 0.1)'
              : 'rgba(34, 197, 94, 0.1)',
            color: actionStatus.toLowerCase().includes('fail')
              ? 'var(--accent-danger)'
              : 'var(--accent-success)',
            border: `1px solid ${actionStatus.toLowerCase().includes('fail') ? 'var(--accent-danger)' : 'var(--accent-success)'}`,
          }}
        >
          {actionStatus}
        </div>
      )}

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
          onPublish={handlePublish}
        />
      ))}
    </>
  );
}
