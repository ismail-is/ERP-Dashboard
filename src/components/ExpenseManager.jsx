import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import {
  Search, Download, Plus, Edit2, Trash2,
  X, BarChart2, IndianRupee, Tag, Calendar,
  TrendingDown, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line
} from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

/* ── GSheet columns: date | id | category | amount ── */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#000000','#374151','#6b7280','#9ca3af','#d1d5db','#1f2937'];

// Default category for new expense forms
const DEFAULT_CATEGORY = 'Internet';

const parseAmt  = (v) => Math.floor(Number(v) || 0);
const fmt       = (v) => `₹${parseAmt(v).toLocaleString('en-IN')}`;

/* Parse a date string → { month: 'Jan', year: '2026', iso: '2026-01-15' } */
const parseDate = (dateStr) => {
  if (!dateStr) return { month: '', year: '', iso: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '', year: '', iso: String(dateStr) };
  return {
    month: MONTHS[d.getMonth()],
    year:  String(d.getFullYear()),
    iso:   d.toISOString().split('T')[0],
  };
};

const todayISO = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  date:     todayISO(),
  category: DEFAULT_CATEGORY,
  amount:   '',
});

/* ════════════════════════════════════════════════════════════ */
export const ExpenseManager = ({ expensesData = [], onDataChanged }) => {
  /* ── Filters ── */
  const [selMonth,    setSelMonth]    = useState('All');
  const [selYear,     setSelYear]     = useState('All');
  const [selCategory, setSelCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Modal ── */
  const [isEditing,    setIsEditing]    = useState(false);
  const [formMode,     setFormMode]     = useState('add');
  const [formData,     setFormData]     = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Delete confirm ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  /* ── Years available in data (no 'All Years') ── */
  const availableYears = useMemo(() => {
    const s = new Set(
      expensesData
        .map(r => parseDate(r.date).year)
        .filter(Boolean)
    );
    return Array.from(s).sort().reverse();
  }, [expensesData]);

  /* ─── Enrich raw data with parsed date parts ── */
  const enriched = useMemo(() =>
    expensesData.map(r => ({
      ...r,
      _parsed: parseDate(r.date),
    })),
  [expensesData]);

  /* ─── Filtered ── */
  const filtered = useMemo(() => {
    let rows = enriched;
    if (selMonth    !== 'All') rows = rows.filter(r => r._parsed.month === selMonth);
    if (selYear     !== 'All') rows = rows.filter(r => r._parsed.year  === selYear);
    if (selCategory !== 'All') rows = rows.filter(r => (r.category || '') === selCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => (r.category || '').toLowerCase().includes(q));
    }
    return rows;
  }, [enriched, selMonth, selYear, selCategory, searchQuery]);

  /* ─── KPIs ── */
  const kpi = useMemo(() => {
    const total   = filtered.reduce((s, r) => s + parseAmt(r.amount), 0);
    const count   = filtered.length;
    const highest = filtered.reduce((max, r) => parseAmt(r.amount) > parseAmt(max.amount || 0) ? r : max, {});
    const catMap  = {};
    filtered.forEach(r => { catMap[r.category || 'Other'] = (catMap[r.category || 'Other'] || 0) + parseAmt(r.amount); });
    const topCat  = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    return { total, count, highest, topCat };
  }, [filtered]);

  /* ─── Chart: bar by category ── */
  const catBarData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const c = r.category || 'Other';
      map[c] = (map[c] || 0) + parseAmt(r.amount);
    });
    return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  /* ─── Chart: pie by category ── */
  const pieData = useMemo(() => catBarData.slice(0, 6), [catBarData]);

  /* ─── Chart: line by month ── */
  const lineData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const key = r._parsed.month || 'Unknown';
      map[key] = (map[key] || 0) + parseAmt(r.amount);
    });
    return MONTHS.filter(m => map[m]).map(m => ({ month: m, amount: map[m] }));
  }, [filtered]);

  /* ─── Unique categories for filter chips ── */
  const chipCategories = useMemo(() => {
    const s = new Set(expensesData.map(r => r.category).filter(Boolean));
    return ['All', ...Array.from(s).sort()];
  }, [expensesData]);

  /* ─── Export PDF ── */
  const handleExportPDF = () => {
    if (!filtered.length) return toast.error('No data to export');
    const doc = new jsPDF();
    doc.text('Expense Report', 14, 15);
    if (selMonth !== 'All' || selYear !== 'All') {
      doc.setFontSize(10);
      doc.text(`Period: ${selMonth !== 'All' ? selMonth : ''} ${selYear !== 'All' ? selYear : ''}`.trim(), 14, 22);
    }
    autoTable(doc, {
      head: [['Date', 'Category', 'Amount (₹)']],
      body: filtered.map(r => [r._parsed.iso || r.date || '', r.category || '', parseAmt(r.amount).toLocaleString('en-IN')]),
      startY: 25, theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 0, 0] },
      foot: [['', 'TOTAL', parseAmt(kpi.total).toLocaleString('en-IN')]],
      footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    });
    doc.save(`Expenses_${selMonth}_${selYear}.pdf`);
    toast.success('PDF Downloaded!');
  };

  /* ─── Amount: integers only ── */
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, amount: raw }));
  };

  /* ─── Open modal ── */
  const openModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      // Map id → Src Row as fallback (Expenses sheet may not have Src Row column)
      const srcRow = row['Src Row'] || row.id;
      setFormData({
        id:        row.id,
        'Src Row': srcRow,
        date:      row._parsed?.iso || row.date || todayISO(),
        category:  row.category || DEFAULT_CATEGORY,
        amount:    String(parseAmt(row.amount) || ''),
      });
    } else {
      setFormMode('add');
      setFormData(emptyForm());
    }
    setIsEditing(true);
  };

  /* ─── Save ── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.date)     return toast.error('Date is required');
    if (!formData.category) return toast.error('Category is required');
    const amtVal = parseAmt(formData.amount);

    setIsSubmitting(true);
    const lt = toast.loading('Saving…');

    const srcRow = formData['Src Row'] || formData.id;
    const payload = {
      id:        formData.id,
      'Src Row': srcRow,
      date:      formData.date,
      category:  formData.category,
      amount:    amtVal,
    };

    // Duplicate keys with variants for dirty header compatibility
    const keys = Object.keys(payload);
    keys.forEach(k => {
      payload[k + ' ']  = payload[k];
      payload[k + '\n'] = payload[k];
      payload[k + '\r'] = payload[k];
    });

    try {
      const result = await updateSheetData(formMode, 'Expenses', payload);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(formMode === 'add' ? 'Expense added!' : 'Expense updated!', { id: lt });
      setIsEditing(false);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt, duration: 6000 });
    } finally { setIsSubmitting(false); }
  };

  /* ─── Delete ── */
  const handleDelete  = (row) => setDeleteTarget(row);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const lt = toast.loading('Deleting…');
    const srcRow = deleteTarget['Src Row'] || deleteTarget.id;
    const payload = {
      ...deleteTarget,
      'Src Row':   srcRow,
      'Src Row ':  srcRow,
      'Src Row\n': srcRow,
    };
    try {
      const r = await updateSheetData('delete', 'Expenses', payload);
      if (r.status === 'error') throw new Error(r.message);
      toast.success('Expense deleted!', { id: lt });
      setDeleteTarget(null);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt });
    } finally { setIsDeleting(false); }
  };

  /* ══════════ RENDER ══════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <h2 className="text-base font-bold">Expense Tracker</h2>
        <div className="flex flex-wrap gap-2">
          {/* Month */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
              className="pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none min-h-[44px]">
              <option value="All">All Months</option>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {/* Year — only years present in the data */}
          {availableYears.length > 0 && (
            <select value={selYear} onChange={e => setSelYear(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none min-h-[44px]">
              <option value="All">All</option>
              {availableYears.map(y => <option key={y}>{y}</option>)}
            </select>
          )}
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input type="text" placeholder="Search category…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black min-h-[44px]" />
          </div>
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors min-h-[44px]">
            <Download size={14} /><span className="hidden sm:inline">Export PDF</span>
          </button>
          <button onClick={() => openModal()} className="premium-button text-sm">
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={IndianRupee}  label="Total Expenses" value={fmt(kpi.total)}       color="text-red-500"    />
        <KpiCard icon={TrendingDown} label="Transactions"   value={kpi.count}            color="text-blue-600"   />
        <KpiCard icon={Tag}          label="Top Category"   value={kpi.topCat?.[0] || '—'} color="text-amber-600" />
        <KpiCard icon={AlertCircle}  label="Highest Single" value={fmt(kpi.highest?.amount || 0)} color="text-purple-600" />
      </div>

      {/* ── Charts ── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar by category */}
          <div className="premium-card lg:col-span-2 h-[230px] sm:h-[270px]">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><BarChart2 size={14}/> Expenses by Category</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={catBarData} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }} formatter={v => fmt(v)} />
                <Bar dataKey="amount" fill="#000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie by category */}
          <div className="premium-card h-[230px] sm:h-[270px]">
            <h3 className="text-sm font-bold mb-3">Category Split</h3>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={4} dataKey="amount">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line by month */}
          {lineData.length > 1 && (
            <div className="premium-card lg:col-span-3 h-[180px] sm:h-[200px]">
              <h3 className="text-sm font-bold mb-3">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={lineData} margin={{ top: 0, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }} formatter={v => fmt(v)} />
                  <Line type="monotone" dataKey="amount" stroke="#000" strokeWidth={2.5} dot={{ fill: '#000', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Category filter chips ── */}
      <div className="flex gap-2 flex-wrap">
        {chipCategories.map(c => (
          <button key={c} onClick={() => setSelCategory(c)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border min-h-[36px]',
              selCategory === c ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            )}>{c}</button>
        ))}
      </div>

      {/* ── Data ── */}
      {filtered.length === 0 ? (
        <div className="premium-card py-16 text-center">
          <p className="text-gray-400 text-sm">No expenses found. <button onClick={() => openModal()} className="text-black font-semibold underline">Add one?</button></p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((row, i) => (
              <div key={i} className="premium-card space-y-3 animate-fade-slide-up">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{row.category || '—'}</p>
                    <p className="text-xs text-gray-400">{row._parsed?.iso || row.date || '—'}</p>
                  </div>
                  <p className="font-bold text-base text-red-600 flex-shrink-0">{fmt(row.amount)}</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                  <button onClick={() => openModal(row)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors min-h-[36px]">
                    <Edit2 size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(row)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors min-h-[36px]">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block premium-card overflow-hidden">
            <div className="table-scroll-container">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Date', 'Category', 'Amount (₹)', 'Actions'].map(h => (
                      <th key={h} className="pb-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((row, i) => (
                    <tr key={i} className="group hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-3 text-sm text-gray-500 whitespace-nowrap">{row._parsed?.iso || row.date || '—'}</td>
                      <td className="py-3.5 px-3 text-sm font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-black flex-shrink-0" />
                          {row.category || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-sm font-bold text-red-600 whitespace-nowrap">{fmt(row.amount)}</td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openModal(row)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Edit"><Edit2 size={14}/></button>
                          <button onClick={() => handleDelete(row)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Showing {filtered.length} of {expensesData.length} expenses</span>
              <span className="text-xs font-bold">Total: {fmt(kpi.total)}</span>
            </div>
          </div>
        </>
      )}

      {/* ── Add/Edit Modal ── */}
      {isEditing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold">{formMode === 'edit' ? 'Edit Expense' : 'Add New Expense'}</h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-black hover:bg-gray-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Date <span className="text-red-500">*</span></label>
                  <input required type="date" className="premium-input"
                    value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
                </div>

                {/* Category — free text input */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Category <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Internet, Office Rent, Travel…"
                    className="premium-input"
                    value={formData.category}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                  />
                </div>

                {/* Amount */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Amount (₹) — whole numbers only</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                      placeholder="0" className="premium-input pl-8"
                      value={formData.amount} onChange={handleAmountChange} />
                  </div>
                  {formData.amount !== '' && (
                    <p className="text-xs text-gray-400 mt-1">= {fmt(formData.amount)}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100 pb-1">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 premium-button">
                  {isSubmitting ? 'Saving…' : formMode === 'add' ? 'Add Expense' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Centered Delete Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-slide-up">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={26} className="text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-center mb-1">Delete Expense?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-bold text-black">{deleteTarget.category}</span> — {fmt(deleteTarget.amount)}
              <br /><span className="text-xs">This cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                className="flex-1 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting}
                className="flex-1 py-3 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors min-h-[44px] disabled:opacity-60">
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── KPI sub-component ── */
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
