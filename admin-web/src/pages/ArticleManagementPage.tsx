import { useEffect, useState } from 'react';
import { getArticles, createArticle, updateArticle, deleteArticle, type Article } from '../services/patientService';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'general', label: '综合' },
  { value: 'depression', label: '抑郁症' },
  { value: 'anxiety', label: '焦虑症' },
  { value: 'sleep', label: '睡眠' },
  { value: 'stress', label: '压力管理' },
  { value: 'relationship', label: '人际关系' },
  { value: 'self_care', label: '自我关怀' },
];

function categoryLabel(v: string): string {
  return CATEGORIES.find(c => c.value === v)?.label || v;
}

function formatTime(t: string): string {
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ArticleManagementPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', summary: '', content: '', url: '', category: 'general', is_published: true });
  const [saving, setSaving] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const data = await getArticles({ category: filterCategory || undefined, search: search || undefined });
      setArticles(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArticles(); }, [filterCategory, search]);

  const openNew = () => {
    setEditId(null);
    setForm({ title: '', summary: '', content: '', url: '', category: 'general', is_published: true });
    setEditing(true);
  };

  const openEdit = (a: Article) => {
    setEditId(a.id);
    setForm({ title: a.title, summary: a.summary, content: a.content, url: a.url || '', category: a.category, is_published: a.is_published });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateArticle(editId, form);
      } else {
        await createArticle(form);
      }
      setEditing(false);
      fetchArticles();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除此文章？')) return;
    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch {
      // ignore
    }
  };

  const handleTogglePublish = async (a: Article) => {
    try {
      const updated = await updateArticle(a.id, { is_published: !a.is_published });
      setArticles(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch {
      // ignore
    }
  };

  if (editing) {
    return (
      <div className="page-content">
        <div className="detail-header">
          <button className="btn btn-back" onClick={() => setEditing(false)}>← 返回列表</button>
          <h2 className="page-title" style={{ margin: 0 }}>{editId ? '编辑文章' : '新建文章'}</h2>
        </div>

        <div className="art-editor">
          <div className="form-group">
            <label>标题</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="文章标题" />
          </div>
          <div className="form-group">
            <label>互联网链接（可选）</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/article" />
            {form.url && <span style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'block' }}>填写链接后，用户将被引导到外部文章页面阅读</span>}
          </div>
          <div className="art-editor-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>分类</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>状态</label>
              <select value={form.is_published ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_published: e.target.value === 'true' }))}>
                <option value="true">已发布</option>
                <option value="false">草稿</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>摘要</label>
            <textarea
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              placeholder="文章摘要（可选）"
              rows={2}
              className="art-textarea"
            />
          </div>
          <div className="form-group">
            <label>正文</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="文章正文..."
              rows={12}
              className="art-textarea"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-back" onClick={() => setEditing(false)} disabled={saving}>取消</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} style={{ width: 'auto', padding: '10px 28px' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-title-row">
        <h2 className="page-title" style={{ margin: 0 }}>内容管理</h2>
        <button className="btn btn-primary" onClick={openNew} style={{ width: 'auto', padding: '8px 20px' }}>
          + 新建文章
        </button>
      </div>

      <div className="iv-filters">
        <div className="iv-search">
          <input
            type="text"
            className="search-input"
            placeholder="搜索文章..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        <div className="iv-filter-row">
          <select className="iv-cat-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">全部分类</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="loading">加载中...</div>}

      {!loading && articles.length === 0 && (
        <div className="pd-empty">暂无文章</div>
      )}

      {!loading && articles.length > 0 && (
        <div className="art-list">
          {articles.map(a => (
            <div key={a.id} className="art-card">
              <div className="art-card-header">
                <div className="art-card-meta">
                  <span className="art-card-cat">{categoryLabel(a.category)}</span>
                  {a.url && <span className="art-card-cat" style={{ backgroundColor: '#dbeafe', color: '#2563eb' }}>外部链接</span>}
                  {!a.is_published && <span className="art-card-draft">草稿</span>}
                </div>
                <h3 className="art-card-title" onClick={() => openEdit(a)}>{a.title}</h3>
                {a.summary && <p className="art-card-summary">{a.summary}</p>}
                <div className="art-card-footer">
                  <span>{a.author_name || '未知作者'} · {formatTime(a.created_at)}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-back" onClick={() => handleTogglePublish(a)} style={{ fontSize: 12, padding: '2px 10px' }}>
                      {a.is_published ? '转为草稿' : '发布'}
                    </button>
                    <button className="btn btn-back" onClick={() => openEdit(a)} style={{ fontSize: 12, padding: '2px 10px' }}>
                      编辑
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(a.id)} style={{ fontSize: 12, padding: '2px 10px' }}>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ArticleManagementPage;
