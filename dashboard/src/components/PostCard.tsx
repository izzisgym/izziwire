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

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        maxWidth: 640,
      }}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
            {post.platform} – {post.postType}
          </h3>
          <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{post.content}</p>
          {post.hashtags?.length ? (
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              {post.hashtags.map((t) => `#${t}`).join(' ')}
            </p>
          ) : null}
          {post.article && (
            <p style={{ margin: '8px 0 0', fontSize: 12 }}>
              Source:{' '}
              <a href={post.article.url} target="_blank" rel="noopener noreferrer">
                {post.article.title}
              </a>
            </p>
          )}
        </div>
        {post.generatedImageUrl && (
          <div>
            <img
              src={post.generatedImageUrl}
              alt=""
              width={200}
              height={200}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onApprove(post.id)}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          Approve now
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            style={{ padding: 4 }}
          />
          <button
            type="button"
            onClick={() => onSchedule(post.id, scheduleDate)}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            Schedule
          </button>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="text"
            placeholder="Reject reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ padding: 4, minWidth: 120 }}
          />
          <button
            type="button"
            onClick={() => onReject(post.id, rejectReason || 'No reason')}
            style={{ padding: '6px 12px', cursor: 'pointer', color: '#c00' }}
          >
            Reject
          </button>
        </label>
      </div>
    </div>
  );
}
