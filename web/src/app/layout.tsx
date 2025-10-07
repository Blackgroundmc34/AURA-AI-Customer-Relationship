import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
          <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
            <span className="font-semibold">AURA</span>
            <div className="h-6 w-px bg-gray-200" />
            <Link className="hover:text-blue-600" href="/chat">Chat</Link>
            <Link className="hover:text-blue-600" href="/dashboard">Dashboard</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
