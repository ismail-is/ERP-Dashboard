import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import {
  Search, Calendar, Download, Plus, Edit2, Trash2,
  TrendingUp, FileText, CheckCircle, Clock, AlertCircle,
  X, ChevronDown, BarChart2, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

/* ─── Helpers ─────────────────────────────────────────────── */
const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const STATUS_CONFIG = {
  Active:    { bg: 'bg-green-50',  text: 'text-green-700',  icon: CheckCircle  },
  Pending:   { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Clock        },
  Closed:    { bg: 'bg-gray-100',  text: 'text-gray-600',   icon: CheckCircle  },
  Overdue:   { bg: 'bg-red-50',    text: 'text-red-600',    icon: AlertCircle  },
  'No activity': { bg: 'bg-blue-50', text: 'text-blue-600', icon: AlertCircle  },
};

const getStatusCfg = (status) =>
  STATUS_CONFIG[status] || { bg: 'bg-gray-100', text: 'text-gray-500', icon: AlertCircle };

const COLORS = ['#000000','#4b5563','#9ca3af','#d1d5db','#374151'];

const parseAmount = (v) => Number(v || 0);
const fmt = (v) => `₹${parseAmount(v).toLocaleString('en-IN')}`;

/* ─── Empty form template ──────────────────────────────────── */
const emptyForm = () => ({
  name: '',
  services: '',
  amount: '',
  'Open Invoices (₹)': '',
  status: 'Pending',
  notes: '',
  month: MONTHS[new Date().getMonth()],
  year: String(CURRENT_YEAR),
});

/* ════════════════════════════════════════════════════════════ */
export const ClientManager = ({ clientsData = [], onDataChanged }) => {
  /* ── Filters ── */
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear,  setSelectedYear]  = useState('All');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All');

  /* ── Modal ── */
  const [isEditing,    setIsEditing]    = useState(false);
  const [formMode,     setFormMode]     = useState('add');
  const [formData,     setFormData]     = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ─── Derived / filtered data ──────────────────────────── */
  const filtered = useMemo(() => {
    let rows = clientsData;

    if (selectedMonth !== 'All') {
      rows = rows.filter(r => (r.month || '') === selectedMonth);
    }
    if (selectedYear !== 'All') {
      rows = rows.filter(r => String(r.year || '') === selectedYear);
    }
    if (statusFilter !== 'All') {
      rows = rows.filter(r => (r.status || '') === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.services || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [clientsData, selectedMonth, selectedYear, statusFilter, searchQuery]);

  /* ─── Summary KPIs ─────────────────────────────────────── */
  const kpi = useMemo(() => {
    const totalRevenue  = filtered.reduce((s, r) => s + parseAmount(r.amount), 0);
    const totalInvoices = filtered.reduce((s, r) => s + parseAmount(r['Open Invoices (₹)']), 0);
    const activeCount   = filtered.filter(r => r.status === 'Active').length;
    const pendingCount  = filtered.filter(r => r.status === 'Pending' || r.status === 'Overdue').length;
    return { totalRevenue, totalInvoices, activeCount, pendingCount, total: filtered.length };
  }, [filtered]);

  /* ─── Chart data ────────────────────────────────────────── */
  const barData = useMemo(() =>
    filtered.map(r => ({
      name: (r.name || '').split(' ')[0],
      Revenue: parseAmount(r.amount),
      Invoices: parseAmount(r['Open Invoices (₹)']),
    })),
  [filtered]);

  const pieData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const s = r.status || 'Unknown';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  /* ─── Export PDF ────────────────────────────────────────── */
  const handleExportPDF = () => {
    if (!filtered.length) return toast.error('No data to export');
    const doc = new jsPDF();
    doc.text('Client Report', 14, 15);
    autoTable(doc, {
      head: [['Client','Services','Revenue','Open Invoices','Status','Notes']],
      body: filtered.map(r => [
        r.name, r.services, fmt(r.amount), fmt(r['Open Invoices (₹)']), r.status, r.notes || '-'
      ]),
      startY: 20, theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0,0,0] },
    });
    doc.save('Client_Report.pdf');
    toast.success('PDF Downloaded!');
  };

  /* ─── CRUD handlers ─────────────────────────────────────── */
  const openModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      setFormData({ ...emptyForm(), ...row });
    } else {
      setFormMode('add');
      setFormData(emptyForm());
    }
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const lt = toast.loading('Saving…');
    try {
      const result = await updateSheetData(formMode, 'Clients', formData);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(formMode === 'add' ? 'Client added!' : 'Client updated!', { id: lt });
      setIsEditing(false);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt, duration: 6000 });
    } finally { setIsSubmitting(false); }
  };

  const handleDelete = (row) => {
    toast((t) => (
      <div className="flex flex-col gap-3 items-center p-1">
        <p className="font-bold text-sm text-center">Delete <span className="text-black">{row.name}</span>?</p>
        <div className="flex gap-2 w-full">
          <button className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-bold" onClick={() => toast.dismiss(t.id)}>Cancel</button>
          <button className="flex-1 py-2 bg-black text-white rounded-xl text-xs font-bold" onClick={async () => {
            toast.dismiss(t.id);
            const lt = toast.loading('Deleting…');
            try {
              const r = await updateSheetData('delete', 'Clients', row);
              if (r.status === 'error') throw new Error(r.message);
              toast.success('Deleted!', { id: lt });
              onDataChanged?.();
            } catch (err) { toast.error('Error', { id: lt }); }
          }}>Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  /* ─── unique statuses for filter chip ─────────────────── */
  const allStatuses = useMemo(() => {
    const s = new Set(clientsData.map(r => r.status).filter(Boolean));
    return ['All', ...s];
  }, [clientsData]);

  /* ════════ RENDER ════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Top Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <h2 className="text-base font-bold">Client Management</h2>
        <div className="flex flex-wrap gap-2">
          {/* Month */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none min-h-[44px]"
            >
              <option value="All">All Months</option>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {/* Year */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none min-h-[44px]"
          >
            <option value="All">All Years</option>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text" placeholder="Search client…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black min-h-[44px]"
            />
          </div>
          {/* Export */}
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors min-h-[44px]">
            <Download size={15} /> <span className="hidden sm:inline">Export</span>
          </button>
          {/* Add */}
          <button onClick={() => openModal()} className="premium-button text-sm">
            <Plus size={15} /> Add Client
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Total Revenue" value={fmt(kpi.totalRevenue)} color="text-green-600" />
        <KpiCard icon={FileText}   label="Open Invoices" value={fmt(kpi.totalInvoices)} color="text-amber-600" />
        <KpiCard icon={Users}      label="Active Clients" value={kpi.activeCount} color="text-blue-600" />
        <KpiCard icon={Clock}      label="Pending / Overdue" value={kpi.pendingCount} color="text-red-500" />
      </div>

      {/* ── Charts row ── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar chart */}
          <div className="premium-card lg:col-span-2 h-[220px] sm:h-[260px]">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><BarChart2 size={15}/> Revenue vs Open Invoices</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={barData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0 / 0.1)', fontSize: 12 }}
                  formatter={(val) => fmt(val)}
                />
                <Bar dataKey="Revenue"  fill="#000" radius={[4,4,0,0]} />
                <Bar dataKey="Invoices" fill="#d1d5db" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Pie chart */}
          <div className="premium-card h-[220px] sm:h-[260px]">
            <h3 className="text-sm font-bold mb-3">Status Breakdown</h3>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val, name) => [`${val} clients`, name]} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Status filter chips ── */}
      <div className="flex gap-2 flex-wrap">
        {allStatuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border min-h-[36px]',
              statusFilter === s
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            )}
          >{s}</button>
        ))}
      </div>

      {/* ── Client Cards — Mobile / Table — Desktop ── */}
      {filtered.length === 0 ? (
        <div className="premium-card py-16 text-center">
          <p className="text-gray-400 text-sm font-medium">No clients match the current filters.</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {filtered.map((row, i) => {
              const sc = getStatusCfg(row.status);
              const Icon = sc.icon;
              return (
                <div key={i} className="premium-card space-y-3 animate-fade-slide-up">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{row.name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{row.services || '—'}</p>
                    </div>
                    <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold flex-shrink-0', sc.bg, sc.text)}>
                      <Icon size={11} /> {row.status || '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Revenue</p>
                      <p className="font-bold text-sm mt-0.5">{fmt(row.amount)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Open Invoices</p>
                      <p className="font-bold text-sm mt-0.5">{parseAmount(row['Open Invoices (₹)']) > 0 ? fmt(row['Open Invoices (₹)']) : '—'}</p>
                    </div>
                  </div>
                  {row.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">{row.notes}</p>
                  )}
                  {/* Month / Year tags */}
                  {(row.month || row.year) && (
                    <div className="flex gap-2">
                      {row.month && <span className="text-[10px] bg-black text-white font-bold px-2 py-0.5 rounded-md">{row.month}</span>}
                      {row.year  && <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md">{row.year}</span>}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                    <button onClick={() => openModal(row)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors min-h-[36px]">
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(row)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors min-h-[36px]">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block premium-card overflow-hidden">
            <div className="table-scroll-container">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Client','Services','Revenue (₹)','Open Invoices (₹)','Month','Year','Status','Notes','Actions'].map(h => (
                      <th key={h} className="pb-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((row, i) => {
                    const sc = getStatusCfg(row.status);
                    const Icon = sc.icon;
                    return (
                      <tr key={i} className="group hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-3 text-sm font-semibold whitespace-nowrap">{row.name || '—'}</td>
                        <td className="py-3.5 px-3 text-sm text-gray-500 whitespace-nowrap">{row.services || '—'}</td>
                        <td className="py-3.5 px-3 text-sm font-semibold text-green-700 whitespace-nowrap">{fmt(row.amount)}</td>
                        <td className="py-3.5 px-3 text-sm font-semibold text-amber-700 whitespace-nowrap">
                          {parseAmount(row['Open Invoices (₹)']) > 0 ? fmt(row['Open Invoices (₹)']) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.month ? <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-md">{row.month}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3.5 px-3 text-sm text-gray-500 whitespace-nowrap">{row.year || '—'}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold', sc.bg, sc.text)}>
                            <Icon size={11} /> {row.status || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-sm text-gray-500 max-w-[180px] truncate">{row.notes || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openModal(row)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Edit"><Edit2 size={14}/></button>
                            <button onClick={() => handleDelete(row)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Footer count */}
            <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400 font-medium">
              Showing {filtered.length} of {clientsData.length} clients
            </div>
          </div>
        </>
      )}

      {/* ─── Modal ──────────────────────────────────────── */}
      {isEditing && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold">{formMode === 'edit' ? 'Edit Client' : 'Add Client'}</h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-black hover:bg-gray-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Client Name *</label>
                  <input required type="text" className="premium-input" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Services</label>
                  <input type="text" className="premium-input" value={formData.services || ''} onChange={e => setFormData({...formData, services: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Status</label>
                  <select className="premium-input" value={formData.status || 'Pending'} onChange={e => setFormData({...formData, status: e.target.value})}>
                    {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Revenue (₹)</label>
                  <input type="number" step="1" min="0" className="premium-input" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Open Invoices (₹)</label>
                  <input type="number" step="1" min="0" className="premium-input" value={formData['Open Invoices (₹)'] || ''} onChange={e => setFormData({...formData, 'Open Invoices (₹)': e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Month</label>
                  <select className="premium-input" value={formData.month || MONTHS[new Date().getMonth()]} onChange={e => setFormData({...formData, month: e.target.value})}>
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Year</label>
                  <select className="premium-input" value={formData.year || String(CURRENT_YEAR)} onChange={e => setFormData({...formData, year: e.target.value})}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Notes</label>
                  <textarea rows={2} className="premium-input resize-none" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-3 border-t border-gray-100 pb-1">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 premium-button">{isSubmitting ? 'Saving…' : 'Save Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── KPI Card sub-component ──────────────────────────────── */
const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className="premium-card flex items-center gap-3 py-4">
    <div className="p-2.5 bg-gray-50 rounded-xl flex-shrink-0">
      <Icon size={18} className={color} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className="text-lg font-bold truncate">{value}</p>
    </div>
  </div>
);
