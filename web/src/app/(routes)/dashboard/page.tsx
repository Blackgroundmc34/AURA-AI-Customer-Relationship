'use client';
import { useEffect, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

type Summary = {
  volume: number;
  sentiment_trend: { pos: number; neg: number; neu: number };
  top_issues: [string, number][];
  churn: { by_customer: { customer_id: string; risk: number }[] };
};

const COLORS = ['#22c55e', '#a3a3a3', '#ef4444']; // pos, neu, neg

// Helper component replacements for Input, Button, and Card
const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`rounded-xl shadow-lg bg-white p-5 transition-all duration-300 ${className}`}>
        {children}
    </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ${props.className}`}
    />
);

const Button = ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-4 py-2 text-white font-semibold rounded-lg shadow-md transition duration-150
            ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
        `}
    >
        {children}
    </button>
);
// End Helper component replacements

export default function DashboardPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
console.log('API base =', API);


  const [key, setKey] = useState('manager-demo-key');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/analytics/summary`, { headers: { 'x-api-key': key } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as Summary;
      setData(j);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message);
      } else if (typeof e === 'string') {
        setErr(e);
      } else {
        setErr('An unknown error occurred during data fetch.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [API, key]);

  useEffect(() => { load(); }, [load]);



  const pieData = data
    ? [
        { name: 'Positive', value: data.sentiment_trend.pos },
        { name: 'Neutral', value: data.sentiment_trend.neu },
        { name: 'Negative', value: data.sentiment_trend.neg },
      ]
    : [];

  const barData = data ? data.top_issues.map(([w, n]) => ({ issue: w, count: n })) : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800">AURA Dashboard</h1>

        <Card className="p-4 border border-indigo-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Input 
                value={key} 
                onChange={(e) => setKey(e.target.value)} 
                placeholder="Enter x-api-key" 
                className="w-full sm:w-[320px] shadow-sm" 
            />
            <Button 
                onClick={load} 
                disabled={loading} 
                className="w-full sm:w-auto"
            >
                {loading ? 'Loading…' : 'Refresh Data'}
            </Button>
            {err && <div className="text-red-600 text-sm font-medium mt-2 sm:mt-0">Connection Error: {err}</div>}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="text-lg font-medium text-indigo-600 mb-1">Total Volume</div>
            <div className="text-5xl font-extrabold text-gray-900 mt-1">{data?.volume ?? '—'}</div>
            <p className="text-sm text-gray-500 mt-2">Total analyzed interactions.</p>
          </Card>

          <Card className="p-6">
            <div className="text-lg font-medium text-indigo-600 mb-4">Sentiment Mix</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                      data={pieData} 
                      dataKey="value" 
                      nameKey="name" 
                      innerRadius={55} 
                      outerRadius={85}
                      paddingAngle={5}
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-lg font-medium text-indigo-600 mb-4">Top Issues</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <XAxis dataKey="count" type="number" stroke="#e5e7eb" />
                  <YAxis dataKey="issue" type="category" width={90} fill="#6b7280" />
                  <Tooltip formatter={(value) => [`${value} Mentions`, 'Count']} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {(!data || barData.length === 0) && <div className="text-sm text-gray-500 mt-2">No issues yet</div>}
          </Card>

          <Card className="p-6 md:col-span-3">
            <div className="text-lg font-medium text-indigo-600 mb-4">Churn Risk: At-Risk Customers</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b border-gray-200 bg-gray-50 text-gray-600">
                    <th className="py-3 px-4 rounded-tl-lg">Customer ID</th>
                    <th className="py-3 px-4 rounded-tr-lg">Risk Score (0–1)</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.churn.by_customer?.length
                    ? data.churn.by_customer.map((c, i) => (
                        <tr 
                            key={i} 
                            className={`border-b border-gray-100 transition duration-100 hover:bg-indigo-50 
                                ${c.risk > 0.7 ? 'bg-red-50' : c.risk > 0.4 ? 'bg-yellow-50' : ''}`}
                        >
                          <td className="py-3 px-4 font-mono text-gray-700">{c.customer_id}</td>
                          <td className="py-3 px-4 font-semibold">{c.risk.toFixed(2)}</td>
                        </tr>
                      ))
                    : (
                      <tr>
                        <td colSpan={2} className="py-4 px-4 text-center text-gray-500 bg-gray-50">
                            No high at-risk customers identified.
                        </td>
                      </tr>
                      )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
