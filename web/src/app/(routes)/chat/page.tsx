'use client';
import { useState, useRef, useEffect } from 'react';
import { Card, Button, Textarea } from '@/components/ui';
import { MessageBubble } from '@/components/message-bubble';

// --- Type Definitions for Better Safety ---

// The metadata associated with a bot's message.
type MessageMeta = {
  sentiment: 'pos' | 'neg' | 'neu';
  urgent: boolean;
};

// A unified type for any message in the chat history.
type ChatMessage = {
  who: 'you' | 'bot';
  text: string;
  meta?: MessageMeta; // Metadata is optional and only for bot messages.
};

// The expected structure of the API's JSON response.
type ChatReply = {
  reply: string;
  sentiment: { score: number; label: 'pos' | 'neg' | 'neu' };
  urgent: boolean;
  conversation_id: string;
  message_id: string;
};


export default function ChatPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]); // Using the stricter ChatMessage type.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // --- Refs for DOM manipulation ---
  const formRef = useRef<HTMLFormElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // --- Auto-scrolling Effect ---
  // This effect runs every time the 'history' array changes.
  // It ensures the chat view scrolls to the bottom to show the latest message.
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [history]);

  // --- Core Chat Logic ---
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const userMsg = message.trim();
    if (!userMsg) return;

    // Add user's message to history immediately for a responsive feel.
    setHistory(currentHistory => [...currentHistory, { who: 'you', text: userMsg }]);
    setMessage('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 'cust_123', message: userMsg }),
      });

      if (!res.ok) throw new Error(`API request failed with status ${res.status}`);

      const data: ChatReply = await res.json();
      
      // Add the bot's reply to the history.
      setHistory(currentHistory => [
        ...currentHistory,
        {
          who: 'bot',
          text: data.reply,
          meta: { sentiment: data.sentiment.label, urgent: data.urgent },
        },
      ]);
      // Refocus the textarea for the user to easily type their next message.
      formRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    } catch (err) {
      // Improved error handling for better feedback.
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      // Optional: Add the error as a message in the chat history.
      setHistory(h => [...h, { who: 'bot', text: `Sorry, something went wrong: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  // --- Keyboard Handler for "Enter-to-Send" ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If the user presses Enter without holding Shift, submit the form.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevents adding a new line.
      formRef.current?.requestSubmit(); // Programmatically submits the form.
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr]">
      <h1 className="text-2xl font-semibold">AURA Chat</h1>

      <Card className="p-4 flex flex-col">
        {/* The ref is attached here for the auto-scrolling container */}
        <div ref={chatContainerRef} className="flex-1 h-[420px] overflow-y-auto space-y-4 pr-2">
          {history.length === 0 && (
            <div className="text-sm text-gray-500 h-full flex items-center justify-center">
              Start the conversation — ask about refunds, pricing, delivery…
            </div>
          )}
          {history.map((m, i) => (
            <MessageBubble key={i} who={m.who} text={m.text} meta={m.meta} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="text-sm text-gray-500 p-2">AURA is typing…</div>
            </div>
          )}
        </div>

        <form ref={formRef} onSubmit={sendMessage} className="mt-4 flex gap-2 border-t pt-4">
          <Textarea
            rows={2}
            placeholder="Type your message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown} // Attach the keyboard handler here.
            disabled={isLoading}
            className="resize-none"
          />
          <Button disabled={isLoading} className="self-end h-10 px-6">
            {isLoading ? '...' : 'Send'}
          </Button>
        </form>

        {error && <div className="mt-2 text-sm text-red-600">Error: {error}</div>}
      </Card>
    </div>
  );
}