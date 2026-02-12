import { useState } from 'react';

export interface PendingPost {
  id: string;
  content: string;
  platform: string;
  postType: string;
  hashtags: string[];
  generatedImageUrl?: string | null;
  generationMetadata?: {
    wpTitle?: string;
    wpTags?: string[];
    wpExcerpt?: string;
    postTypeSlug?: string;
    game?: string;
  } | null;
  article?: { title: string; url: string; game: string } | null;
}

const PLATFORM_OPTIONS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'both', label: 'Facebook & Instagram' },
] as const;

interface PostCardProps {
  post: PendingPost;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onSchedule: (id: string, scheduledFor: string) => void;
  onPublish: (id: string) => void;
  onPlatformChange: (id: string, platform: string) => void;
}

export default function PostCard({ post, onApprove, onReject, onSchedule, onPublish, onPlatformChange }: PostCardProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [expanded, setExpanded] = useState(false);

  const platformClass = post.platform.toLowerCase();
  const gameClass = post.generationMetadata?.game ?? post.article?.game?.toLowerCase() ?? '';
  const wpTitle = post.generationMetadata?.wpTitle;
  const wpExcerpt = post.generationMetadata?.wpExcerpt;
  const isHtml = post.content.includes('<') && post.content.includes('>');

  // Truncate content for preview
  const previewLength = 500;
  const needsTruncation = post.content.length > previewLength;
  const displayContent = expanded ? post.content : post.content.slice(0, previewLength);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-meta">
          <select
            value={post.platform}
            onChange={(e) => onPlatformChange(post.id, e.target.value)}
            className={`platform-badge platform-select ${platformClass}`}
            style={{
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid currentColor',
              fontSize: 'inherit',
              fontWeight: 600,
            }}
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {gameClass && (
            <span className={`game-badge ${gameClass}`}>
              {gameClass}
            </span>
          )}
          <span className="post-type-badge">{post.postType}</span>
        </div>
      </div>

      {/* WordPress title */}
      {wpTitle && (
        <h3 style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 8,
          lineHeight: 1.3,
        }}>
          {wpTitle}
        </h3>
      )}

      {/* Excerpt */}
      {wpExcerpt && (
        <p style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          marginBottom: 12,
          lineHeight: 1.5,
        }}>
          {wpExcerpt}
        </p>
      )}

      {post.generatedImageUrl && (
        <img
          src={post.generatedImageUrl}
          alt=""
          className="card-image"
        />
      )}

      {/* Content - render HTML for WordPress posts, plain text otherwise */}
      {isHtml ? (
        <div
          className="card-content"
          style={{
            whiteSpace: 'normal',
            maxHeight: expanded ? 'none' : 300,
            overflow: expanded ? 'visible' : 'hidden',
            position: 'relative',
          }}
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />
      ) : (
        <div
          className="card-content"
          style={{
            maxHeight: expanded ? 'none' : 300,
            overflow: expanded ? 'visible' : 'hidden',
          }}
        >
          {displayContent}
          {!expanded && needsTruncation && '...'}
        </div>
      )}

      {(needsTruncation || (isHtml && post.content.length > previewLength)) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            padding: '4px 0',
            marginBottom: 12,
          }}
        >
          {expanded ? 'Show less' : 'Show full content'}
        </button>
      )}

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
        <button type="button" className="btn btn-success" onClick={() => onPublish(post.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Approve &amp; Publish
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onApprove(post.id)} style={{ marginLeft: 4 }}>
          Approve only
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
