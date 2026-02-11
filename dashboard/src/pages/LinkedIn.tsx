import { useState, useEffect } from 'react';

interface Topic {
  id: string;
  name: string;
  keywords: string | null;
  enabled: boolean;
}

interface Draft {
  id: string;
  content: string;
  topicId: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

const API = '/api/linkedin';

export default function LinkedIn() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [postText, setPostText] = useState('');
  const [topicName, setTopicName] = useState('');
  const [topicKeywords, setTopicKeywords] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [suggestedComment, setSuggestedComment] = useState('');
  const [sourcePostText, setSourcePostText] = useState('');
  const [agreeDisagree, setAgreeDisagree] = useState<'agree' | 'disagree'>('agree');
  const [generatedPost, setGeneratedPost] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then((d) => setConnected(d.linkedInConnected))
      .catch(() => setConnected(false));
  };

  const loadTopics = () => {
    fetch(API + '/topics')
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => setTopics([]));
  };

  const loadDrafts = () => {
    fetch(API + '/drafts')
      .then((r) => r.json())
      .then(setDrafts)
      .catch(() => setDrafts([]));
  };

  useEffect(() => {
    loadStatus();
    loadTopics();
    loadDrafts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      loadStatus();
      window.history.replaceState({}, '', '/linkedin');
    }
    const err = params.get('error');
    const msg = params.get('message');
    if (err) {
      setError(msg ? decodeURIComponent(msg) : err === 'invalid_state' ? 'Session expired or invalid. Try connecting again.' : 'OAuth failed.');
      window.history.replaceState({}, '', '/linkedin');
    }
  }, []);

  const publishPost = async () => {
    if (!postText.trim()) return;
    setLoading('publish');
    setError(null);
    try {
      const res = await fetch(`${API}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentary: postText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPostText('');
      } else {
        setError(data.error || 'Publish failed');
      }
    } finally {
      setLoading(null);
    }
  };

  const addTopic = async () => {
    if (!topicName.trim()) return;
    setLoading('topic');
    setError(null);
    try {
      await fetch(API + '/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: topicName.trim(), keywords: topicKeywords.trim() || undefined }),
      });
      setTopicName('');
      setTopicKeywords('');
      loadTopics();
    } finally {
      setLoading(null);
    }
  };

  const deleteTopic = async (id: string) => {
    await fetch(`${API}/topics/${id}`, { method: 'DELETE' });
    loadTopics();
  };

  const approveDraft = async (id: string) => {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`${API}/drafts/${id}/approve`, { method: 'POST' });
      if (res.ok) loadDrafts();
      else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed');
      }
    } finally {
      setLoading(null);
    }
  };

  const suggestComment = async () => {
    if (!commentInput.trim()) return;
    setLoading('comment');
    setSuggestedComment('');
    setError(null);
    try {
      const body = commentInput.trim().startsWith('http')
        ? { postUrl: commentInput.trim() }
        : { postText: commentInput.trim() };
      const res = await fetch(`${API}/comment/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) setSuggestedComment(data.suggestedComment ?? '');
      else setError(data.error || 'Suggestion failed');
    } finally {
      setLoading(null);
    }
  };

  const generateResponsePost = async () => {
    if (!sourcePostText.trim()) return;
    setLoading('generate-response');
    setError(null);
    setGeneratedPost('');
    try {
      const res = await fetch(`${API}/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postText: sourcePostText.trim(), stance: agreeDisagree }),
      });
      const data = await res.json();
      if (res.ok) setGeneratedPost(data.content ?? '');
      else setError(data.error || 'Generation failed');
    } finally {
      setLoading(null);
    }
  };

  const publishGeneratedPost = async () => {
    if (!generatedPost.trim()) return;
    setLoading('publish-generated');
    setError(null);
    try {
      const res = await fetch(`${API}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentary: generatedPost.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGeneratedPost('');
        setSourcePostText('');
      } else setError(data.error || 'Publish failed');
    } finally {
      setLoading(null);
    }
  };

  const saveGeneratedAsDraft = async () => {
    if (!generatedPost.trim()) return;
    setLoading('draft-generated');
    setError(null);
    try {
      await fetch(`${API}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: generatedPost.trim() }),
      });
      setGeneratedPost('');
      setSourcePostText('');
      loadDrafts();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">LinkedIn Agent</h1>
        <p className="page-subtitle">
          Publish posts, manage topics, approve drafts, and get suggested comments. Uses the official LinkedIn Posts API.
        </p>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent-danger)' }}>
          {error}
        </div>
      )}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Connect LinkedIn</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          {connected === true ? 'LinkedIn is connected.' : 'Connect to publish and manage posts.'}
        </p>
        <a
          href="/auth/linkedin"
          className="btn btn-primary"
          style={{ display: 'inline-block' }}
        >
          {connected ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}
        </a>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Post now</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Publish a text-only post directly.</p>
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write your post..."
          rows={4}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            marginBottom: 12,
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={publishPost}
          disabled={!postText.trim() || loading !== null}
        >
          {loading === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Create a post from someone else&apos;s</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          Paste a post, choose agree or disagree, and generate your take. Edit if you like, then post or save as draft.
        </p>
        <textarea
          value={sourcePostText}
          onChange={(e) => setSourcePostText(e.target.value)}
          placeholder="Paste the post you want to respond to..."
          rows={4}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            marginBottom: 12,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Your stance:</span>
          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setAgreeDisagree('agree')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: agreeDisagree === 'agree' ? 'var(--accent-success)' : 'var(--bg-secondary)',
                color: agreeDisagree === 'agree' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: agreeDisagree === 'agree' ? 600 : 400,
              }}
            >
              Agree
            </button>
            <button
              type="button"
              onClick={() => setAgreeDisagree('disagree')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: agreeDisagree === 'disagree' ? 'var(--accent-danger)' : 'var(--bg-secondary)',
                color: agreeDisagree === 'disagree' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: agreeDisagree === 'disagree' ? 600 : 400,
              }}
            >
              Disagree
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={generateResponsePost}
            disabled={!sourcePostText.trim() || loading !== null}
          >
            {loading === 'generate-response' ? 'Generating…' : 'Generate my take'}
          </button>
        </div>
        {generatedPost && (
          <>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
              Your post (edit if you like)
            </label>
            <textarea
              value={generatedPost}
              onChange={(e) => setGeneratedPost(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                marginBottom: 12,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={publishGeneratedPost}
                disabled={loading !== null}
              >
                {loading === 'publish-generated' ? 'Publishing…' : 'Post now'}
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                onClick={saveGeneratedAsDraft}
                disabled={loading !== null}
              >
                {loading === 'draft-generated' ? 'Saving…' : 'Save as draft'}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Topics</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          Add topics; the cron can generate drafts from them.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            placeholder="Topic name"
            style={{
              flex: '1 1 200px',
              padding: 10,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          />
          <input
            type="text"
            value={topicKeywords}
            onChange={(e) => setTopicKeywords(e.target.value)}
            placeholder="Keywords (optional)"
            style={{
              flex: '1 1 200px',
              padding: 10,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={addTopic}
            disabled={!topicName.trim() || loading !== null}
          >
            {loading === 'topic' ? 'Adding…' : 'Add topic'}
          </button>
        </div>
        <ul style={{ listStyle: 'none' }}>
          {topics.map((t) => (
            <li
              key={t.id}
              style={{
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{t.name} {t.keywords && `(${t.keywords})`}</span>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                onClick={() => deleteTopic(t.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Drafts (approval queue)</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Approve a draft to publish it to LinkedIn.</p>
        <ul style={{ listStyle: 'none' }}>
          {drafts.map((d) => (
            <li
              key={d.id}
              style={{
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ flex: '1 1 280px' }}>
                {d.content.slice(0, 160)}
                {d.content.length > 160 ? '…' : ''}
              </div>
              {d.status === 'draft' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => approveDraft(d.id)}
                  disabled={loading !== null}
                >
                  {loading === d.id ? 'Publishing…' : 'Approve & Publish'}
                </button>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{d.status}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Draft a comment</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          Paste a post or URL; get a suggested comment to copy and post manually on LinkedIn.
        </p>
        <textarea
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          placeholder="Paste post text or URL..."
          rows={3}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            marginBottom: 12,
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={suggestComment}
          disabled={!commentInput.trim() || loading !== null}
        >
          {loading === 'comment' ? 'Suggesting…' : 'Suggest comment'}
        </button>
        {suggestedComment && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {suggestedComment}
          </div>
        )}
      </section>
    </div>
  );
}
