'use client';
import { useEffect, useState } from 'react';

type FAQ = { id: string; question: string; answer: string; tags: string[] };

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export default function FAQAdmin() {
  const [key, setKey] = useState('manager-demo-key');
  const [items, setItems] = useState<FAQ[]>([]);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function list() {
    setErr(null);
    try {
      const res = await fetch(`${API}/api/faq`, { headers: { 'x-api-key': key } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const id = crypto.randomUUID();
      const payload: FAQ = {
        id,
        question: q.trim(),
        answer: a.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      const res = await fetch(`${API}/api/faq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setQ(''); setA(''); setTags('');
      await list();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { list(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">FAQ Admin</h1>

      <div className="rounded-2xl border p-4 bg-white space-y-3">
        <div className="flex gap-2 items-center">
          <input value={key} onChange={e => setKey(e.target.value)} className="border rounded-xl px-3 py-2 w-[320px]" placeholder="x-api-key" />
          <button onClick={list} className="px-4 py-2 rounded-xl bg-blue-600 text-white">Refresh</button>
          {err && <div className="text-sm text-red-600">Error: {err}</div>}
        </div>

        <form onSubmit={create} className="grid md:grid-cols-2 gap-3">
          <input className="border rounded-xl px-3 py-2" placeholder="Question" value={q} onChange={e => setQ(e.target.value)} />
          <input className="border rounded-xl px-3 py-2" placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} />
          <textarea className="md:col-span-2 border rounded-xl p-3" rows={3} placeholder="Answer" value={a} onChange={e => setA(e.target.value)} />
          <div className="md:col-span-2 flex justify-end">
            <button disabled={loading} className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50">
              {loading ? 'Saving…' : 'Add FAQ'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl border p-4 bg-white">
            <div className="font-medium">{item.question}</div>
            <div className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{item.answer}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border">{t}</span>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-gray-500">No FAQs yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
