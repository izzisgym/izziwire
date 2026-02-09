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

const EMPTY_TYPE: PostType = {
  name: '',
  slug: '',
  description: '',
  instructions: '',
  minWords: 600,
  maxWords: 1200,
  generateImage: true,
  isActive: true,
};

export default function PostTypes() {
  const [types, setTypes] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PostType>(EMPTY_TYPE);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const apiKey = localStorage.getItem('izziwire_api_key') || '';

  useEffect(() => {
    loadTypes();
  }, []);

  async function loadTypes() {
    try {
      const res = await fetch('/api/post-types');
      const data = (await res.json()) as PostType[];
      setTypes(data);
    } catch {
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveAll(updated: PostType[]) {
    setSaveStatus(null);
    try {
      const res = await fetch('/api/post-types', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        const msg = await res.text();
        setSaveStatus(`Save failed: ${msg || res.status}`);
        return false;
      }
      const data = (await res.json()) as PostType[];
      setTypes(data);
      setSaveStatus('Saved');
      return true;
    } catch (e) {
      setSaveStatus(`Save failed: ${e instanceof Error ? e.message : 'error'}`);
      return false;
    }
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditForm({ ...types[idx] });
    setIsNew(false);
    setSaveStatus(null);
  }

  function startNew() {
    setEditingIdx(types.length);
    setEditForm({ ...EMPTY_TYPE });
    setIsNew(true);
    setSaveStatus(null);
  }

  async function saveEdit() {
    if (!editForm.name.trim() || !editForm.slug.trim() || !editForm.instructions.trim()) {
      setSaveStatus('Name, slug, and instructions are required');
      return;
    }
    const slug = editForm.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const updated = [...types];
    const item = { ...editForm, slug };
    if (isNew) {
      updated.push(item);
    } else if (editingIdx !== null) {
      updated[editingIdx] = item;
    }
    const ok = await saveAll(updated);
    if (ok) {
      setEditingIdx(null);
      setIsNew(false);
    }
  }

  async function deleteType(idx: number) {
    const name = types[idx].name;
    if (!confirm(`Delete "${name}"?`)) return;
    const updated = types.filter((_, i) => i !== idx);
    await saveAll(updated);
  }

  async function toggleActive(idx: number) {
    const updated = [...types];
    updated[idx] = { ...updated[idx], isActive: !updated[idx].isActive };
    await saveAll(updated);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setIsNew(false);
    setSaveStatus(null);
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading post types...
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Post Types</h1>
        <p className="page-subtitle">
          Configure content templates for different types of blog posts
        </p>
      </div>

      {/* Edit / Create Form */}
      {editingIdx !== null && (
        <div className="card" style={{ borderColor: 'var(--accent-primary)', borderWidth: 2, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, marginBottom: 20, fontWeight: 600 }}>
            {isNew ? 'Create Post Type' : `Edit: ${types[editingIdx]?.name ?? ''}`}
          </h2>
          <div style={{ display: 'grid', gap: 14, maxWidth: 700 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Name
                <input
                  type="text"
                  placeholder="e.g. Deck Guide"
                  value={editForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEditForm({
                      ...editForm,
                      name,
                      slug: isNew
                        ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                        : editForm.slug,
                    });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', marginTop: 4,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  }}
                />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Slug
                <input
                  type="text"
                  placeholder="e.g. deck-guide"
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', marginTop: 4,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'monospace',
                  }}
                />
              </label>
            </div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Description (shown in the content creator)
              <input
                type="text"
                placeholder="Brief description of this post type"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px', marginTop: 4,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Writing Instructions (this is the AI prompt — be specific about tone, structure, format)
              <textarea
                rows={10}
                placeholder="Write a detailed deck guide covering the core strategy, key cards, budget vs premium options, matchup tips..."
                value={editForm.instructions}
                onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                style={{
                  width: '100%', padding: '12px 14px', marginTop: 4,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  fontFamily: 'inherit', fontSize: 14, resize: 'vertical', lineHeight: 1.6,
                }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Min Words
                <input
                  type="number"
                  min={100}
                  max={10000}
                  value={editForm.minWords}
                  onChange={(e) => setEditForm({ ...editForm, minWords: Number(e.target.value) || 300 })}
                  style={{
                    width: '100%', padding: '10px 14px', marginTop: 4,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  }}
                />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Max Words
                <input
                  type="number"
                  min={100}
                  max={10000}
                  value={editForm.maxWords}
                  onChange={(e) => setEditForm({ ...editForm, maxWords: Number(e.target.value) || 1200 })}
                  style={{
                    width: '100%', padding: '10px 14px', marginTop: 4,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  }}
                />
              </label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editForm.generateImage}
                onChange={(e) => setEditForm({ ...editForm, generateImage: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Generate a featured image with Ideogram
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Active (visible in Content Creator)
              </span>
            </label>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={saveEdit}>
                {isNew ? 'Create Post Type' : 'Save Changes'}
              </button>
              <button className="btn btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
            {saveStatus && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                background: saveStatus.startsWith('Save') && !saveStatus.startsWith('Saved')
                  ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                color: saveStatus.startsWith('Save') && !saveStatus.startsWith('Saved')
                  ? 'var(--accent-danger)' : 'var(--accent-success)',
              }}>
                {saveStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Types List */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          onClick={startNew}
          disabled={editingIdx !== null}
          style={{ opacity: editingIdx !== null ? 0.5 : 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Post Type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <h3>No post types yet</h3>
            <p>Click "New Post Type" to create your first content template.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {types.map((type, idx) => (
            <div
              key={type.slug}
              className="card"
              style={{
                opacity: type.isActive ? 1 : 0.55,
                marginBottom: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {type.name}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-secondary)',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}>
                      {type.slug}
                    </span>
                    <span className={`status-badge ${type.isActive ? 'active' : 'inactive'}`}>
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {type.description && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {type.description}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                    <span>{type.minWords}-{type.maxWords} words</span>
                    <span>{type.generateImage ? 'Image: Yes' : 'Image: No'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => toggleActive(idx)}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {type.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => startEdit(idx)}
                    disabled={editingIdx !== null}
                    style={{ padding: '6px 12px', fontSize: 12, opacity: editingIdx !== null ? 0.5 : 1 }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => deleteType(idx)}
                    disabled={editingIdx !== null}
                    style={{ padding: '6px 12px', fontSize: 12, opacity: editingIdx !== null ? 0.5 : 1 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {saveStatus && editingIdx === null && (
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          background: saveStatus.startsWith('Save') && !saveStatus.startsWith('Saved')
            ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          color: saveStatus.startsWith('Save') && !saveStatus.startsWith('Saved')
            ? 'var(--accent-danger)' : 'var(--accent-success)',
        }}>
          {saveStatus}
        </div>
      )}
    </>
  );
}
