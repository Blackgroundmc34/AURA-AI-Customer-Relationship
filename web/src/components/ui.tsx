export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={"rounded-2xl border bg-white shadow-sm " + (props.className ?? "")} />;
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-xl px-4 py-2 bg-blue-600 text-white " +
        "hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed " +
        (props.className ?? "")
      }
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"w-full rounded-xl border px-3 py-2 bg-white " + (props.className ?? "")} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={"w-full rounded-xl border p-3 bg-white " + (props.className ?? "")} />;
}
