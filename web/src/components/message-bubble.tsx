export function MessageBubble({
  who,
  text,
  meta,
}: {
  who: "you" | "bot";
  text: string;
  meta?: { sentiment?: string; urgent?: boolean };
}) {
  const mine = who === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[75%] px-4 py-2 rounded-2xl " +
          (mine ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm")
        }
      >
        <div className="whitespace-pre-wrap">{text}</div>
        {meta && (
          <div className="mt-1 text-xs opacity-80 flex items-center gap-2">
            {meta.sentiment && <span>sentiment: {meta.sentiment}</span>}
            {meta.urgent && <span className="px-2 py-0.5 rounded bg-red-600 text-white">URGENT</span>}
          </div>
        )}
      </div>
    </div>
  );
}
