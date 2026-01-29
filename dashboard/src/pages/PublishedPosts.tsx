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

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Published Posts</h1>
        <p className="page-subtitle">Track performance of your published content</p>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          Loading posts...
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3>No published posts yet</h3>
          <p>Posts will appear here once they are published.</p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="table-container">
          {posts.map((p) => (
            <div key={p.id} className="published-item">
              <div className="published-content">
                <div className="published-header">
                  <span className={`platform-badge ${p.platform.toLowerCase()}`}>
                    {p.platform}
                  </span>
                  <span className="published-date">
                    {new Date(p.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {p.pendingPost && (
                  <p className="published-text">
                    {p.pendingPost.content.length > 150
                      ? `${p.pendingPost.content.slice(0, 150)}...`
                      : p.pendingPost.content}
                  </p>
                )}
                <div className="stats-row">
                  <span className="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    {p.likes} likes
                  </span>
                  <span className="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    {p.comments} comments
                  </span>
                  <span className="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    {p.shares} shares
                  </span>
                  {p.postUrl && (
                    <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="stat-item" style={{ marginLeft: 'auto' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      View Post
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
