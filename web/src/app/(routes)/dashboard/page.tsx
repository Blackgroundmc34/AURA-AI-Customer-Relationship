'use client';
import { useEffect, useState } from 'react';
import { Card, Button, Input } from '@/components/ui';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

type Summary = {
  volume: number;
  sentiment_trend: { pos: number; neg: number; neu: number };
  top_issues: [string, number][];
  churn: { by_customer: { customer_id: string; risk: number }[] };
};

const COLORS = ['#22c55e', '#a3a3a3', '#ef4444']; // pos, neu, neg

export default function DashboardPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
console.log('API base =', API);


  const [key, setKey] = useState('manager-demo-key');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/analytics/summary`, { headers: { 'x-api-key': key } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as Summary;
      setData(j);
    } catch (e: any) {
      setErr(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);



  const pieData = data
    ? [
        { name: 'Positive', value: data.sentiment_trend.pos },
        { name: 'Neutral', value: data.sentiment_trend.neu },
        { name: 'Negative', value: data.sentiment_trend.neg },
      ]
    : [];

  const barData = data ? data.top_issues.map(([w, n]) => ({ issue: w, count: n })) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AURA Dashboard</h1>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="x-api-key" className="w-[320px]" />
          <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
          {err && <div className="text-red-600 text-sm">Error: {err}</div>}
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Volume</div>
          <div className="text-4xl font-semibold mt-1">{data?.volume ?? '—'}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-500 mb-2">Sentiment Mix</div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-gray-500">Positive / Neutral / Negative</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-500 mb-2">Top Issues</div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="issue" hide />
                <YAxis width={24} />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(!data || barData.length === 0) && <div className="text-sm text-gray-500">No issues yet</div>}
        </Card>

        <Card className="p-4 md:col-span-3">
          <div className="text-sm text-gray-500 mb-2">Churn Risk</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Customer</th>
                  <th className="py-2">Risk (0–1)</th>
                </tr>
              </thead>
              <tbody>
                {data?.churn.by_customer?.length
                  ? data.churn.by_customer.map((c, i) => (
                      <tr key={i} className="border-b last:border-none">
                        <td className="py-2">{c.customer_id}</td>
                        <td className="py-2">{c.risk.toFixed(2)}</td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={2} className="py-3 text-gray-500">No at-risk customers</td>
                    </tr>
                    )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
