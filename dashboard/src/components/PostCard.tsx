import { useState } from 'react';

export interface PendingPost {
  id: string;
  content: string;
  platform: string;
  postType: string;
  hashtags: string[];
  generatedImageUrl?: string | null;
  article?: { title: string; url: string; game: string } | null;
}

interface PostCardProps {
  post: PendingPost;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onSchedule: (id: string, scheduledFor: string) => void;
}

export default function PostCard({ post, onApprove, onReject, onSchedule }: PostCardProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const platformClass = post.platform.toLowerCase();
  const gameClass = post.article?.game?.toLowerCase() || '';

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-meta">
          <span className={`platform-badge ${platformClass}`}>
            {post.platform}
          </span>
          {post.article?.game && (
            <span className={`game-badge ${gameClass}`}>
              {post.article.game}
            </span>
          )}
          <span className="post-type-badge">{post.postType}</span>
        </div>
      </div>

      {post.generatedImageUrl && (
        <img
          src={post.generatedImageUrl}
          alt=""
          className="card-image"
        />
      )}

      <div className="card-content">{post.content}</div>

      {post.hashtags?.length > 0 && (
        <div className="card-hashtags">
          {post.hashtags.map((tag) => (
            <span key={tag} className="hashtag">#{tag}</span>
          ))}
        </div>
      )}

      {post.article && (
        <div className="card-source">
          Source: <a href={post.article.url} target="_blank" rel="noopener noreferrer">{post.article.title}</a>
        </div>
      )}

      <div className="card-actions">
        <button type="button" className="btn btn-success" onClick={() => onApprove(post.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Approve Now
        </button>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => onSchedule(post.id, scheduleDate)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Schedule
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ minWidth: '160px' }}
          />
          <button type="button" className="btn btn-danger" onClick={() => onReject(post.id, rejectReason || 'No reason')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
