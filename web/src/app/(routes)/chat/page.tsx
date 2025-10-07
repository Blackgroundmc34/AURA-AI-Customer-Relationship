'use client';
import { useState, useRef } from 'react';
import { Card, Button, Textarea } from '@/components/ui';
import { MessageBubble } from '@/components/message-bubble';

type ChatReply = {
  reply: string;
  sentiment: { score: number; label: 'pos' | 'neg' | 'neu' };
  urgent: boolean;
  conversation_id: string;
  message_id: string;
};

export default function ChatPage() {
  // Fallback keeps dev smooth even if .env isn't picked up
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
  console.log('API base =', API);
  

  const [customerId] = useState('cust_123');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<{ who: 'you' | 'bot'; text: string; meta?: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!message.trim()) return;
    const userMsg = message.trim();

    setHistory(h => [...h, { who: 'you', text: userMsg }]);
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, message: userMsg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ChatReply = await res.json();
      setHistory(h => [
        ...h,
        { who: 'bot', text: data.reply, meta: { sentiment: data.sentiment.label, urgent: data.urgent } },
      ]);
      formRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr]">
      <h1 className="text-2xl font-semibold">AURA Chat</h1>

      <Card className="p-4">
        <div className="h-[420px] overflow-y-auto space-y-3 pr-1">
          {history.length === 0 && (
            <div className="text-sm text-gray-500">Start the conversation — ask about refunds, pricing, delivery…</div>
          )}
          {history.map((m, i) => (
            <MessageBubble key={i} who={m.who} text={m.text} meta={m.meta} />
          ))}
          {loading && <div className="text-sm text-gray-500">AURA is typing…</div>}
        </div>

        <form ref={formRef} onSubmit={sendMessage} className="mt-4 flex gap-2">
          <Textarea
            rows={3}
            placeholder="Type your message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button disabled={loading} className="self-end h-10">{loading ? 'Sending…' : 'Send'}</Button>
        </form>

        {error && <div className="mt-2 text-sm text-red-600">Error: {error}</div>}
      </Card>
    </div>
  );
}
