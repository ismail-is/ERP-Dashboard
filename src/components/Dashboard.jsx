import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';
import {
  TrendingUp, TrendingDown, Wallet, DollarSign,
  Users, Briefcase, Receipt, CheckCircle, Clock,
  AlertCircle, ArrowRight, IndianRupee, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#111827','#374151','#6b7280','#9ca3af','#d1d5db'];
const fmt = (v) => `₹${Math.floor(Number(v)||0).toLocaleString('en-IN')}`;

const parseDate = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; };

export const Dashboard = ({ data, financials }) => {
  const employees = data.employees || [];
  const clients   = data.clients   || [];
  const expenses  = data.expenses  || [];

  /* ── Derived numbers ─────────────────────────── */
  const totalRevenue   = useMemo(() => clients.reduce((s,c) => s + Math.floor(Number(c.amount||0)), 0), [clients]);
  const totalExpenses  = useMemo(() => expenses.reduce((s,e) => s + Math.floor(Number(e.amount||0)), 0), [expenses]);
  const netBalance     = totalRevenue - totalExpenses;
  const uniqueEmployees = useMemo(() => new Set(employees.map(e => (e['Employee Name']||'').trim().toLowerCase()).filter(Boolean)).size, [employees]);
  const activeClients  = useMemo(() => clients.filter(c => c.status === 'Active').length, [clients]);
  const pendingClients = useMemo(() => clients.filter(c => c.status === 'Pending' || c.status === 'Overdue').length, [clients]);
  const totalCashGiven = useMemo(() => employees.reduce((s,e) => s + Number(e['Cash Given (₹)']||0), 0), [employees]);
  const totalEmpExp    = useMemo(() => employees.reduce((s,e) => s + Number(e['Expense (₹)']||0), 0), [employees]);

  /* ── Monthly expense trend from GSheet ──────── */
  const monthlyExpense = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const d = parseDate(e.date);
      if (!d) return;
      const key = MONTHS[d.getMonth()];
      map[key] = (map[key] || 0) + Math.floor(Number(e.amount||0));
    });
    return MONTHS.filter(m => map[m]).map(m => ({ month: m, amount: map[m] }));
  }, [expenses]);

  /* ── Monthly revenue trend from clients ─────── */
  const revenueByClient = useMemo(() =>
    clients.slice(0, 8).map(c => ({ name: (c.name||'').split(' ')[0], Revenue: Math.floor(Number(c.amount||0)) })),
  [clients]);

  /* ── Expense by category ─────────────────────── */
  const expByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(e => { const c = e.category||'Other'; map[c] = (map[c]||0) + Math.floor(Number(e.amount||0)); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0,6);
  }, [expenses]);

  /* ── Client status breakdown ─────────────────── */
  const clientStatus = useMemo(() => {
    const map = {};
    clients.forEach(c => { const s = c.status||'Unknown'; map[s] = (map[s]||0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [clients]);

  /* ── Employee summary (top 5) ────────────────── */
  const empSummary = useMemo(() => {
    const map = {};
    employees.forEach(r => {
      const name = (r['Employee Name']||'').trim() || 'Unassigned';
      const key  = name.toLowerCase();
      if (!map[key]) map[key] = { name, given: 0, expense: 0 };
      map[key].given   += Number(r['Cash Given (₹)']||0);
      map[key].expense += Number(r['Expense (₹)']||0);
    });
    return Object.values(map).sort((a,b) => b.expense - a.expense).slice(0,5);
  }, [employees]);

  /* ── Recent expenses (last 5) ────────────────── */
  const recentExpenses = useMemo(() =>
    [...expenses].sort((a,b) => (parseDate(b.date)||0) - (parseDate(a.date)||0)).slice(0,5),
  [expenses]);

  /* ── Recent clients (last 5) ─────────────────── */
  const recentClients = useMemo(() => clients.slice(-5).reverse(), [clients]);

  const STATUS_COLOR = { Active: 'text-emerald-600 bg-emerald-50', Pending: 'text-amber-600 bg-amber-50', Closed: 'text-gray-500 bg-gray-100', Overdue: 'text-red-600 bg-red-50', 'No activity': 'text-blue-600 bg-blue-50' };

  return (
    <div className="space-y-5">

      {/* ── Row 1: 4 KPI cards ────────────────────── */}
      <div className="kpi-grid stagger-children">
        <KpiCard icon={TrendingUp}   label="Total Revenue"   value={fmt(totalRevenue)}  sub={`${clients.length} clients`}    trend="+8%"  trendUp />
        <KpiCard icon={TrendingDown} label="Total Expenses"  value={fmt(totalExpenses)} sub={`${expenses.length} entries`}   trend="-5%"  trendUp={false} />
        <KpiCard icon={Wallet}       label="Net Balance"     value={fmt(netBalance)}    sub="Revenue – Expenses"             colored={netBalance >= 0} />
        <KpiCard icon={Users}        label="Employees"       value={uniqueEmployees}    sub={`${employees.length} ledger rows`} />
      </div>

      {/* ── Row 2: Monthly Expense Trend + Client Status Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="premium-card lg:col-span-2" style={{ height: 'clamp(220px,28vw,280px)' }}>
          <SectionHeader title="Monthly Expense Trend" icon={Activity} link="/expenses" />
          {monthlyExpense.length > 0 ? (
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={monthlyExpense} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/.1)', fontSize: 12 }} formatter={v => [fmt(v), 'Expenses']} />
                <Line type="monotone" dataKey="amount" stroke="#111827" strokeWidth={2.5} dot={{ fill: '#111827', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty text="No expense data yet" />}
        </div>

        <div className="premium-card" style={{ height: 'clamp(220px,28vw,280px)' }}>
          <SectionHeader title="Client Status" icon={Briefcase} link="/clients" />
          {clientStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="82%">
              <PieChart>
                <Pie data={clientStatus} cx="50%" cy="50%" innerRadius="38%" outerRadius="60%" paddingAngle={3} dataKey="value">
                  {clientStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} clients`, n]} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty text="No client data yet" />}
        </div>
      </div>

      {/* ── Row 3: Revenue by Client (bar) + Expense by Category ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="premium-card" style={{ height: 'clamp(220px,26vw,270px)' }}>
          <SectionHeader title="Revenue by Client" icon={IndianRupee} link="/clients" />
          {revenueByClient.length > 0 ? (
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={revenueByClient} margin={{ top: 4, right: 5, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }} formatter={v => [fmt(v), 'Revenue']} />
                <Bar dataKey="Revenue" fill="#111827" radius={[4,4,0,0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No client data yet" />}
        </div>

        <div className="premium-card" style={{ height: 'clamp(220px,26vw,270px)' }}>
          <SectionHeader title="Expenses by Category" icon={Receipt} link="/expenses" />
          {expByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={expByCategory} layout="vertical" margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#374151' }} width={70} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: 12 }} formatter={v => [fmt(v), 'Amount']} />
                <Bar dataKey="value" fill="#374151" radius={[0,4,4,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No expense data yet" />}
        </div>
      </div>

      {/* ── Row 4: Employee summary table + Client status summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Employee summary */}
        <div className="premium-card p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-gray-400" strokeWidth={2} />
              <h3 className="text-sm font-bold text-gray-900">Employee Overview</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">{uniqueEmployees} staff</span>
              <Link to="/employees" className="flex items-center gap-1 text-xs font-bold text-gray-900 hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </div>
          </div>
          {/* Summary bar */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Cash Given', value: fmt(totalCashGiven) },
              { label: 'Expenses',   value: fmt(totalEmpExp) },
              { label: 'Balance',    value: fmt(totalCashGiven - totalEmpExp) },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-black text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          {empSummary.length === 0 ? <Empty text="No employee data" /> : (
            <div className="divide-y divide-gray-50">
              {empSummary.map((emp, i) => {
                const bal = emp.given - emp.expense;
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center text-white text-[11px] font-black flex-shrink-0">
                        {(emp.name[0]||'?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 truncate">{emp.name}</p>
                        <p className="text-[11px] text-gray-400">Exp: {fmt(emp.expense)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('text-[13px] font-black', bal >= 0 ? 'text-emerald-600' : 'text-red-600')}>{fmt(Math.abs(bal))}</p>
                      <p className="text-[10px] text-gray-400">{bal >= 0 ? 'surplus' : 'deficit'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent clients */}
        <div className="premium-card p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={15} className="text-gray-400" strokeWidth={2} />
              <h3 className="text-sm font-bold text-gray-900">Recent Clients</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-600">{activeClients} active</span>
              <Link to="/clients" className="flex items-center gap-1 text-xs font-bold text-gray-900 hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </div>
          </div>
          {/* KPI strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Total',   value: clients.length },
              { label: 'Active',  value: activeClients },
              { label: 'Pending', value: pendingClients },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-black text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          {recentClients.length === 0 ? <Empty text="No client data" /> : (
            <div className="divide-y divide-gray-50">
              {recentClients.map((client, i) => {
                const sc = STATUS_COLOR[client.status] || 'text-gray-500 bg-gray-100';
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{client.name || '—'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{client.services || 'No service'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={cn('badge text-[10px]', sc)}>{client.status || '—'}</span>
                      <span className="text-[13px] font-black text-emerald-700">{fmt(client.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 5: Recent Expenses ─────────────────── */}
      <div className="premium-card p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-gray-400" strokeWidth={2} />
            <h3 className="text-sm font-bold text-gray-900">Recent Expenses</h3>
          </div>
          <Link to="/expenses" className="flex items-center gap-1 text-xs font-bold text-gray-900 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {recentExpenses.length === 0 ? <Empty text="No expense data" /> : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-50">
              {recentExpenses.map((exp, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-bold text-gray-900">{exp.category || '—'}</p>
                    <p className="text-[11px] text-gray-400">{exp.date || '—'}</p>
                  </div>
                  <p className="text-[14px] font-black text-red-600">{fmt(exp.amount)}</p>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Category</th><th>Amount</th></tr></thead>
                <tbody>
                  {recentExpenses.map((exp, i) => (
                    <tr key={i}>
                      <td className="text-gray-500">{exp.date || '—'}</td>
                      <td>
                        <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                          <span className="w-2 h-2 rounded-full bg-gray-800 flex-shrink-0" />
                          {exp.category || '—'}
                        </span>
                      </td>
                      <td className="font-black text-red-600">{fmt(exp.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

/* ── Sub-components ────────────────────────────────────────── */
const KpiCard = ({ icon: Icon, label, value, sub, trend, trendUp, colored }) => (
  <div className="premium-card animate-fade-slide-up">
    <div className="flex items-start justify-between mb-3">
      <div className="p-2 bg-gray-50 rounded-xl">
        <Icon size={18} className={cn(colored === false ? 'text-red-500' : colored ? 'text-emerald-600' : 'text-gray-700')} strokeWidth={2} />
      </div>
      {trend && (
        <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full', trendUp ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate mb-1">{label}</p>
    <p className={cn('text-xl font-black tracking-tight truncate', colored === false ? 'text-red-600' : colored ? 'text-emerald-600' : 'text-gray-900')}>{value}</p>
    {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
  </div>
);

const SectionHeader = ({ title, icon: Icon, link }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400" strokeWidth={2} />
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
    </div>
    <Link to={link} className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-900 transition-colors">
      Details <ArrowRight size={11} />
    </Link>
  </div>
);

const Empty = ({ text }) => (
  <div className="py-10 text-center">
    <p className="text-sm text-gray-400 font-medium">{text}</p>
  </div>
);
