import { useState, useEffect, useCallback } from 'react';
import PostCard, { type PendingPost } from '../components/PostCard';

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

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: '#c00' }}>Error: {error}</p>;

  return (
    <div>
      <h1>Post Approval Queue</h1>
      <p>{posts.length} post(s) awaiting review.</p>
      {posts.length === 0 ? (
        <p>No posts pending approval.</p>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onApprove={handleApprove}
            onReject={handleReject}
            onSchedule={handleSchedule}
          />
        ))
      )}
    </div>
  );
}
