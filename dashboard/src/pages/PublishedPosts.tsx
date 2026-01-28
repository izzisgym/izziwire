import { useState, useEffect } from 'react';

interface PublishedPost {
  id: string;
  platform: string;
  platformPostId: string | null;
  postUrl: string | null;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  pendingPost?: { content: string; postType: string } | null;
}

export default function PublishedPosts() {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/posts/published')
      .then((r) => r.json())
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Published Posts</h1>
      {posts.length === 0 ? (
        <p>No published posts yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {posts.map((p) => (
            <li
              key={p.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div>
                <strong>{p.platform}</strong> · {new Date(p.publishedAt).toLocaleString()}
              </div>
              {p.pendingPost && (
                <p style={{ margin: '8px 0', fontSize: 14 }}>{p.pendingPost.content.slice(0, 120)}…</p>
              )}
              <div style={{ fontSize: 12, color: '#666' }}>
                Likes: {p.likes} · Comments: {p.comments} · Shares: {p.shares}
                {p.postUrl && (
                  <>
                    {' · '}
                    <a href={p.postUrl} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
