'use client';
import { useEffect, useState, useCallback } from 'react';

// Define a type for the FAQ data structure for type safety.
type FAQ = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
};

// Define a type for the form fields to manage them in a single state object.
type NewFaqState = {
  question: string;
  answer: string;
  tags: string;
};

// Use environment variable for the API endpoint with a fallback for local dev.
const API = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export default function FAQAdmin() {
  const [key, setKey] = useState('manager-demo-key');
  const [items, setItems] = useState<FAQ[]>([]);
  const [newFaq, setNewFaq] = useState<NewFaqState>({ question: '', answer: '', tags: '' });
  
  // State for managing loading and error feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null); // To track which item is being deleted

  // Memoize the list function with useCallback.
  // This prevents it from being recreated on every render,
  // making it safe to use as a dependency in useEffect.
  const listFAQs = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/faq`, { headers: { 'x-api-key': key } });
      if (!res.ok) throw new Error(`Failed to fetch FAQs: HTTP ${res.status}`);
      const data = await res.json();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [key]); // The function depends on the API 'key', so it's a dependency.

  // This effect now correctly depends on the memoized `listFAQs` function.
  // It will run once on mount, and again only if `listFAQs` changes (i.e., if the 'key' changes).
  useEffect(() => {
    listFAQs();
  }, [listFAQs]);

  // Handles changes to any of the form inputs.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewFaq(prevState => ({ ...prevState, [name]: value }));
  };

  // Handles the creation of a new FAQ item.
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newFaq.question || !newFaq.answer) {
      setError('Question and Answer fields cannot be empty.');
      return;
    }
    
    setActionInProgress('create');
    setError(null);
    
    try {
      const payload: Omit<FAQ, 'id'> & { id?: string } = {
        question: newFaq.question.trim(),
        answer: newFaq.answer.trim(),
        tags: newFaq.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      const res = await fetch(`${API}/api/faq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Failed to create FAQ: HTTP ${res.status}`);
      
      setNewFaq({ question: '', answer: '', tags: '' }); // Reset form
      await listFAQs(); // Refresh the list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setActionInProgress(null);
    }
  }

  // Handles the deletion of an FAQ item.
  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;

    setActionInProgress(id); // Set the ID of the item being deleted
    setError(null);
    
    try {
      const res = await fetch(`${API}/api/faq/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': key },
      });
      if (!res.ok) throw new Error(`Failed to delete FAQ: HTTP ${res.status}`);
      
      await listFAQs(); // Refresh the list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">FAQ Admin</h1>

      {/* API Key and Refresh Controls */}
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input 
            value={key} 
            onChange={e => setKey(e.target.value)} 
            className="border rounded-xl px-3 py-2 flex-grow sm:flex-grow-0 w-full sm:w-[320px]" 
            placeholder="x-api-key" 
          />
          <button 
            onClick={listFAQs} 
            disabled={isLoading} 
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Refreshing…' : 'Refresh List'}
          </button>
        </div>
        {error && <div className="text-sm text-red-600">Error: {error}</div>}
      </div>
      
      {/* Create New FAQ Form */}
      <div className="rounded-2xl border bg-white p-4">
        <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-3">
            <h2 className="md:col-span-2 text-lg font-medium">Add New FAQ</h2>
            <input 
                name="question"
                className="border rounded-xl px-3 py-2" 
                placeholder="Question" 
                value={newFaq.question} 
                onChange={handleInputChange} 
            />
            <input 
                name="tags"
                className="border rounded-xl px-3 py-2" 
                placeholder="Tags (comma separated)" 
                value={newFaq.tags} 
                onChange={handleInputChange} 
            />
            <textarea 
                name="answer"
                className="md:col-span-2 border rounded-xl p-3" 
                rows={3} 
                placeholder="Answer" 
                value={newFaq.answer} 
                onChange={handleInputChange} 
            />
            <div className="md:col-span-2 flex justify-end">
                <button 
                    type="submit" 
                    disabled={actionInProgress === 'create'} 
                    className="px-4 py-2 rounded-xl bg-green-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {actionInProgress === 'create' ? 'Saving…' : 'Add FAQ'}
                </button>
            </div>
        </form>
      </div>

      {/* Display List of FAQs */}
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl border p-4 bg-white shadow-sm">
            <div className="font-medium text-gray-800">{item.question}</div>
            <div className="text-sm mt-1 text-gray-600 whitespace-pre-wrap">{item.answer}</div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {item.tags.map((t, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">{t}</span>
                ))}
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={actionInProgress === item.id}
                className="text-xs px-3 py-1 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionInProgress === item.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
        {!isLoading && items.length === 0 && (
          <div className="text-center text-gray-500 py-8">No FAQs yet. Add one above.</div>
        )}
         {isLoading && items.length === 0 && (
          <div className="text-center text-gray-500 py-8">Loading FAQs...</div>
        )}
      </div>
    </div>
  );
}