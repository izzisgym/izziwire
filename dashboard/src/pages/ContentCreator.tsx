import { useState, useEffect } from 'react';

interface PostType {
  name: string;
  slug: string;
  description?: string;
  instructions: string;
  minWords: number;
  maxWords: number;
  generateImage: boolean;
  isActive: boolean;
}

interface GenerateResult {
  ok: boolean;
  pendingPostId?: string;
  title?: string;
  excerpt?: string;
  tags?: string[];
  hasImage?: boolean;
  status?: string;
  error?: string;
}

interface CardPreview {
  game: string;
  name: string;
  setName: string;
  setCode?: string;
  rarity: string;
  artist: string | null;
  text: string | null;
  priceUsd?: string | null;
  imageUrl: string | null;
}

interface CardSpotlightResult {
  ok: boolean;
  pendingPostId?: string;
  title?: string;
  excerpt?: string;
  tags?: string[];
  hasImage?: boolean;
  game?: string;
  card?: {
    name: string;
    set: string;
    rarity: string;
    artist: string | null;
    priceUsd?: string | null;
    imageUrl: string | null;
  };
  status?: string;
  error?: string;
}

export default function ContentCreator() {
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [game, setGame] = useState<'pokemon' | 'onepiece' | 'mtg'>('pokemon');
  const [topic, setTopic] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Card Spotlight state
  const [cardSpotlightGame, setCardSpotlightGame] = useState<'mtg' | 'pokemon' | 'onepiece' | 'lorcana'>('mtg');
  const [cardPreview, setCardPreview] = useState<CardPreview | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardGenerating, setCardGenerating] = useState(false);
  const [cardResult, setCardResult] = useState<CardSpotlightResult | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  const apiKey = localStorage.getItem('izziwire_api_key') || '';

  useEffect(() => {
    fetch('/api/post-types')
      .then((r) => r.json())
      .then((data: PostType[]) => {
        const active = data.filter((t) => t.isActive);
        setPostTypes(active);
        if (active.length > 0 && !selectedType) {
          setSelectedType(active[0].slug);
        }
      })
      .catch(() => setPostTypes([]))
      .finally(() => setLoading(false));
  }, []);

  const currentType = postTypes.find((t) => t.slug === selectedType);

  async function generate() {
    if (!selectedType || !topic.trim()) return;
    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          postTypeSlug: selectedType,
          topic: topic.trim(),
          game,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });

      const data = (await res.json()) as GenerateResult;
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  }

  async function fetchRandomCard() {
    setCardLoading(true);
    setCardError(null);
    setCardResult(null);
    try {
      const res = await fetch(`/api/card-spotlight/preview?game=${cardSpotlightGame}`, {
        headers: { ...(apiKey ? { 'x-api-key': apiKey } : {}) },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setCardError(data.error || `Failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as CardPreview;
      setCardPreview(data);
    } catch (e) {
      setCardError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setCardLoading(false);
    }
  }

  async function generateCardSpotlight() {
    setCardGenerating(true);
    setCardResult(null);
    setCardError(null);
    try {
      const res = await fetch('/api/card-spotlight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ game: cardSpotlightGame }),
      });
      const data = (await res.json()) as CardSpotlightResult;
      if (!res.ok) {
        setCardError(data.error || `Failed (${res.status})`);
      } else {
        setCardResult(data);
        setCardPreview(null);
      }
    } catch (e) {
      setCardError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setCardGenerating(false);
    }
  }

  const gameOptions = [
    { value: 'pokemon', label: 'Pokemon', color: 'var(--game-pokemon)', textColor: '#1a1a1a' },
    { value: 'onepiece', label: 'One Piece', color: 'var(--game-onepiece)', textColor: 'white' },
    { value: 'mtg', label: 'Magic: The Gathering', color: 'var(--game-mtg)', textColor: 'white' },
  ] as const;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Content Creator</h1>
        <p className="page-subtitle">Generate blog posts for your TCG community</p>
      </div>

      {/* Random Card Spotlight (MTG, Pokemon, One Piece, Lorcana) */}
      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
          Random Card Spotlight
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
          Pick a game, fetch a random card, and generate a short spotlight post (under 150 words).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {[
            { value: 'mtg' as const, label: 'MTG', color: 'var(--game-mtg)' },
            { value: 'pokemon' as const, label: 'Pokemon', color: 'var(--game-pokemon)' },
            { value: 'onepiece' as const, label: 'One Piece', color: 'var(--game-onepiece)' },
            { value: 'lorcana' as const, label: 'Lorcana', color: 'var(--game-lorcana)' },
          ].map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => { setCardSpotlightGame(g.value); setCardPreview(null); setCardResult(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: cardSpotlightGame === g.value ? `2px solid ${g.color}` : '1px solid var(--border)',
                background: cardSpotlightGame === g.value ? g.color : 'var(--bg-secondary)',
                color: cardSpotlightGame === g.value ? 'white' : 'var(--text-primary)',
                fontWeight: cardSpotlightGame === g.value ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Card Preview */}
        {cardPreview && (
          <div style={{
            display: 'flex',
            gap: 24,
            marginBottom: 20,
            padding: 20,
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            flexWrap: 'wrap',
          }}>
            {cardPreview.imageUrl && (
              <img
                src={cardPreview.imageUrl}
                alt={cardPreview.name}
                style={{
                  width: 240,
                  borderRadius: 12,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                {cardPreview.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                {cardPreview.setName}{cardPreview.setCode ? ` (${cardPreview.setCode})` : ''}
              </div>
              {cardPreview.text && (
                <div style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontStyle: 'italic',
                  whiteSpace: 'pre-wrap',
                }}>
                  {cardPreview.text}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                <span style={{ textTransform: 'capitalize' }}>{cardPreview.rarity}</span>
                {cardPreview.artist && <span>Art by {cardPreview.artist}</span>}
                {cardPreview.priceUsd && <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>${cardPreview.priceUsd}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Card Spotlight Result */}
        {cardResult && cardResult.ok && (
          <div style={{
            marginBottom: 20,
            padding: 20,
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid var(--accent-success)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span style={{ fontWeight: 600, color: 'var(--accent-success)' }}>Card Spotlight Generated</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{cardResult.title}</div>
            {cardResult.excerpt && (
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                {cardResult.excerpt}
              </div>
            )}
            {cardResult.card && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {cardResult.card.name} &middot; {cardResult.card.set} &middot; {cardResult.card.rarity}
                {cardResult.card.priceUsd && ` · $${cardResult.card.priceUsd}`}
              </div>
            )}
            {cardResult.tags && cardResult.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {cardResult.tags.map((tag, i) => (
                  <span key={i} className="hashtag">{tag}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--accent-warning)',
                padding: '4px 10px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 12,
              }}>
                Pending Review
              </span>
              <a href="/queue" style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                Go to Approval Queue
              </a>
            </div>
          </div>
        )}

        {cardError && (
          <div className="error-message" style={{ marginBottom: 16 }}>
            {cardError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={fetchRandomCard}
            disabled={cardLoading}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: cardLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: cardLoading ? 0.6 : 1,
            }}
          >
            {cardLoading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Rolling...</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg> {cardPreview ? 'Reroll Card' : 'Random Card'}</>
            )}
          </button>
          {cardPreview && (
            <button
              onClick={generateCardSpotlight}
              disabled={cardGenerating}
              style={{
                padding: '10px 24px',
                background: cardGenerating ? 'var(--bg-hover)' : `linear-gradient(135deg, var(--game-${cardSpotlightGame}), #1a1a2e)`,
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: cardGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: cardGenerating ? 0.7 : 1,
              }}
            >
              {cardGenerating ? (
                <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating post...</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> Generate Card Spotlight</>
              )}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Loading post types...
        </div>
      ) : postTypes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h3>No post types configured</h3>
            <p>Go to Post Types to create your first content template.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Post Type Selection */}
          <div className="card">
            <h2 style={{ fontSize: 18, marginBottom: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Choose Post Type
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {postTypes.map((type) => (
                <button
                  key={type.slug}
                  onClick={() => setSelectedType(type.slug)}
                  style={{
                    background: selectedType === type.slug ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: selectedType === type.slug ? 'white' : 'var(--text-primary)',
                    border: selectedType === type.slug ? '2px solid var(--accent-primary)' : '2px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{type.name}</div>
                  <div style={{
                    fontSize: 12,
                    opacity: 0.75,
                    lineHeight: 1.4,
                  }}>
                    {type.description || `${type.minWords}-${type.maxWords} words`}
                  </div>
                </button>
              ))}
            </div>

            {currentType && (
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                <strong>Instructions preview:</strong> {currentType.instructions.slice(0, 200)}
                {currentType.instructions.length > 200 ? '...' : ''}
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{currentType.minWords}-{currentType.maxWords} words</span>
                  <span>{currentType.generateImage ? 'Featured image: Yes' : 'Featured image: No'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Game Selection */}
          <div className="card" style={{ marginTop: 0 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M12 12h.01" />
                <path d="M17 12h.01" />
                <path d="M7 12h.01" />
              </svg>
              Game
            </h2>
            <div style={{ display: 'flex', gap: 10 }}>
              {gameOptions.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGame(g.value)}
                  style={{
                    background: game === g.value ? g.color : 'var(--bg-secondary)',
                    color: game === g.value ? g.textColor : 'var(--text-secondary)',
                    border: game === g.value ? `2px solid ${g.color}` : '2px solid var(--border)',
                    borderRadius: 20,
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic & Context */}
          <div className="card" style={{ marginTop: 0 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="14" y2="21" />
              </svg>
              Topic
            </h2>
            <div style={{ display: 'grid', gap: 14, maxWidth: 700 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                What should this post be about?
                <input
                  type="text"
                  placeholder="e.g. New Charizard card in the latest set, Top tier decks in standard..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    marginTop: 6,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                  }}
                />
              </label>
              <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Additional context (optional)
                <textarea
                  placeholder="Any specific details, angles, or notes you want the AI to consider..."
                  rows={4}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    marginTop: 6,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </label>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                A featured image will be automatically found from the web. Content will be sent to the Approval Queue for review before publishing.
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={generate}
              disabled={generating || !topic.trim() || !selectedType}
              style={{
                background: generating ? 'var(--bg-hover)' : 'linear-gradient(135deg, var(--accent-primary), var(--game-mtg))',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '14px 32px',
                fontSize: 16,
                fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer',
                opacity: (!topic.trim() || !selectedType) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 150ms ease',
              }}
            >
              {generating ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Generating... (this may take a minute)
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate Content
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="error-message" style={{ marginBottom: 20 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Result */}
          {result && result.ok && (
            <div className="card" style={{ borderColor: 'var(--accent-success)', borderWidth: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-success)' }}>
                  Content Generated Successfully
                </h2>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    Title
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {result.title}
                  </div>
                </div>

                {result.excerpt && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      Excerpt
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {result.excerpt}
                    </div>
                  </div>
                )}

                {result.tags && result.tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                      Tags
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {result.tags.map((tag, i) => (
                        <span key={i} className="hashtag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  gap: 20,
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  alignItems: 'center',
                }}>
                  <span>{result.hasImage ? 'Featured image generated' : 'No featured image'}</span>
                  <span style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--accent-warning)',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontWeight: 600,
                    fontSize: 12,
                  }}>
                    Pending Review
                  </span>
                  <a
                    href="/queue"
                    style={{ color: 'var(--accent-primary)', fontWeight: 500 }}
                  >
                    Go to Approval Queue
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
