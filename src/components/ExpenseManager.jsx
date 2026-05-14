import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import { Search, Download, Plus, Edit2, Trash2, X, BarChart2, IndianRupee, Tag, Calendar, TrendingDown, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS  = ['#111827','#374151','#6b7280','#9ca3af','#d1d5db','#1f2937'];

const parseAmt = (v) => Math.floor(Number(v) || 0);
const fmt      = (v) => `₹${parseAmt(v).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toISOString().split('T')[0];

const parseDate = (dateStr) => {
  if (!dateStr) return { month: '', year: '', iso: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '', year: '', iso: String(dateStr) };
  return { month: MONTHS[d.getMonth()], year: String(d.getFullYear()), iso: d.toISOString().split('T')[0] };
};

const emptyForm = () => ({ date: todayISO(), category: 'Internet', amount: '' });

/* ════════════════════════════════════════════════════════════ */
export const ExpenseManager = ({ expensesData = [], onDataChanged }) => {
  const [selMonth,    setSelMonth]    = useState('All');
  const [selYear,     setSelYear]     = useState('All');
  const [selCategory, setSelCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing,   setIsEditing]   = useState(false);
  const [formMode,    setFormMode]    = useState('add');
  const [formData,    setFormData]    = useState(emptyForm());
  const [isSubmitting,setIsSubmitting]= useState(false);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [isDeleting,  setIsDeleting]  = useState(false);

  const availableYears = useMemo(() => {
    const s = new Set(expensesData.map(r => parseDate(r.date).year).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [expensesData]);

  // Only months that actually have expense data
  const availableMonths = useMemo(() => {
    const s = new Set(expensesData.map(r => parseDate(r.date).month).filter(Boolean));
    return MONTHS.filter(m => s.has(m));
  }, [expensesData]);

  const enriched = useMemo(() =>
    expensesData.map(r => ({ ...r, _parsed: parseDate(r.date) })),
  [expensesData]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (selMonth    !== 'All') rows = rows.filter(r => r._parsed.month === selMonth);
    if (selYear     !== 'All') rows = rows.filter(r => r._parsed.year  === selYear);
    if (selCategory !== 'All') rows = rows.filter(r => (r.category || '') === selCategory);
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); rows = rows.filter(r => (r.category || '').toLowerCase().includes(q)); }
    return rows;
  }, [enriched, selMonth, selYear, selCategory, searchQuery]);

  const kpi = useMemo(() => {
    const total   = filtered.reduce((s, r) => s + parseAmt(r.amount), 0);
    const count   = filtered.length;
    const highest = filtered.reduce((max, r) => parseAmt(r.amount) > parseAmt(max.amount || 0) ? r : max, {});
    const catMap  = {};
    filtered.forEach(r => { catMap[r.category || 'Other'] = (catMap[r.category || 'Other'] || 0) + parseAmt(r.amount); });
    const topCat  = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    return { total, count, highest, topCat };
  }, [filtered]);

  const catBarData = useMemo(() => {
    const map = {};
    filtered.forEach(r => { const c = r.category || 'Other'; map[c] = (map[c] || 0) + parseAmt(r.amount); });
    return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const pieData  = useMemo(() => catBarData.slice(0, 6), [catBarData]);
  const lineData = useMemo(() => {
    const map = {};
    filtered.forEach(r => { const k = r._parsed.month || 'Unknown'; map[k] = (map[k] || 0) + parseAmt(r.amount); });
    return MONTHS.filter(m => map[m]).map(m => ({ month: m, amount: map[m] }));
  }, [filtered]);

  const chipCategories = useMemo(() => {
    const s = new Set(expensesData.map(r => r.category).filter(Boolean));
    return ['All', ...Array.from(s).sort()];
  }, [expensesData]);

  const handleExportPDF = () => {
    if (!filtered.length) return toast.error('No data to export');
    const doc = new jsPDF();
    // Use ASCII-safe header — jsPDF default font doesn't support \u20B9
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Report', 14, 15);
    autoTable(doc, {
      head: [['Date', 'Category', 'Amount (Rs.)']],
      body: filtered.map(r => [
        r._parsed.iso || r.date || '',
        r.category || '',
        parseAmt(r.amount).toLocaleString('en-IN')
      ]),
      startY: 22,
      theme: 'grid',
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
      foot: [['', 'TOTAL', parseAmt(kpi.total).toLocaleString('en-IN')]],
      footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });
    doc.save(`Expenses_${selMonth}_${selYear}.pdf`);
    toast.success('PDF Downloaded!');
  };

  const openModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      const srcRow = row['Src Row'] || row.id;
      setFormData({ id: row.id, 'Src Row': srcRow, date: row._parsed?.iso || row.date || todayISO(), category: row.category || 'Internet', amount: String(parseAmt(row.amount) || '') });
    } else { setFormMode('add'); setFormData(emptyForm()); }
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.date)     return toast.error('Date is required');
    if (!formData.category) return toast.error('Category is required');
    const amtVal = parseAmt(formData.amount);
    const srcRow  = formData['Src Row'] || formData.id;
    setIsSubmitting(true);
    const lt = toast.loading('Saving…');
    const payload = { id: formData.id, 'Src Row': srcRow, date: formData.date, category: formData.category, amount: amtVal };
    Object.keys({ ...payload }).forEach(k => { payload[k + ' '] = payload[k]; payload[k + '\n'] = payload[k]; payload[k + '\r'] = payload[k]; });
    try {
      const result = await updateSheetData(formMode, 'Expenses', payload);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(formMode === 'add' ? 'Expense added!' : 'Expense updated!', { id: lt });
      setIsEditing(false); onDataChanged?.();
    } catch (err) { toast.error('Error: ' + err.message, { id: lt, duration: 6000 }); }
    finally { setIsSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const lt = toast.loading('Deleting…');
    const srcRow = deleteTarget['Src Row'] || deleteTarget.id;
    const payload = { ...deleteTarget, 'Src Row': srcRow, 'Src Row ': srcRow, 'Src Row\n': srcRow };
    try {
      const r = await updateSheetData('delete', 'Expenses', payload);
      if (r.status === 'error') throw new Error(r.message);
      toast.success('Expense deleted!', { id: lt }); setDeleteTarget(null); onDataChanged?.();
    } catch (err) { toast.error('Error: ' + err.message, { id: lt }); }
    finally { setIsDeleting(false); }
  };

  /* ══════════ RENDER ══════════════════════════════════════════ */
  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Controls */}
      <div className="controls-row">
        <h2 className="section-title">Expense Tracker</h2>
        <div className="controls-actions">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
            <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
              className="pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none min-h-[42px]">
              <option value="All">All Months</option>
              {availableMonths.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {availableYears.length > 1 && (
            <select value={selYear} onChange={e => setSelYear(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none min-h-[42px]">
              <option value="All">All Years</option>
              {availableYears.map(y => <option key={y}>{y}</option>)}
            </select>
          )}
          <div className="relative flex-1 sm:flex-none sm:w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
            <input type="text" placeholder="Search…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none min-h-[42px]" />
          </div>
          <button onClick={handleExportPDF} className="ghost-button text-sm">
            <Download size={14} /><span className="hidden sm:inline">Export PDF</span>
          </button>
          <button onClick={() => openModal()} className="premium-button text-sm">
            <Plus size={14} strokeWidth={2.5} /> Add Expense
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid stagger-children">
        <KpiCard icon={IndianRupee}  label="Total Expenses"  value={fmt(kpi.total)}                   color="text-gray-900"    bg="bg-gray-100"    />
        <KpiCard icon={TrendingDown} label="Transactions"    value={kpi.count}                        color="text-gray-600"   bg="bg-gray-100"   />
        <KpiCard icon={Tag}          label="Top Category"    value={kpi.topCat?.[0] || '—'}           color="text-gray-500"  bg="bg-gray-100"  />
        <KpiCard icon={AlertCircle}  label="Highest Single"  value={fmt(kpi.highest?.amount || 0)}   color="text-gray-800" bg="bg-gray-200" />
      </div>

      {/* Charts */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="premium-card lg:col-span-2 overflow-hidden" style={{ height: 'clamp(200px, 28vw, 280px)' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900">
              <BarChart2 size={14} className="text-gray-400" /> Expenses by Category
            </h3>
            <ResponsiveContainer width="100%" height="84%">
              <BarChart data={catBarData} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }} formatter={v => [fmt(v), 'Amount']} />
                <Bar dataKey="amount" fill="#111827" radius={[5, 5, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="premium-card overflow-hidden" style={{ height: 'clamp(200px, 28vw, 280px)' }}>
            <h3 className="text-sm font-bold mb-2 text-gray-900">Category Split</h3>
            <ResponsiveContainer width="100%" height="88%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="48%" innerRadius="38%" outerRadius="58%" paddingAngle={4} dataKey="amount">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [fmt(v), 'Amount']} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {lineData.length > 1 && (
            <div className="premium-card lg:col-span-3 overflow-hidden" style={{ height: 'clamp(160px, 20vw, 200px)' }}>
              <h3 className="text-sm font-bold mb-3 text-gray-900">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height="78%">
                <LineChart data={lineData} margin={{ top: 0, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }} formatter={v => [fmt(v), 'Amount']} />
                  <Line type="monotone" dataKey="amount" stroke="#111827" strokeWidth={2.5} dot={{ fill: '#111827', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Filter chips */}
      <div className="chip-scroll">
        {chipCategories.map(c => (
          <button key={c} onClick={() => setSelCategory(c)}
            className={cn('filter-chip', selCategory === c && 'active')}>
            {c}
          </button>
        ))}
      </div>

      {/* Data */}
      {filtered.length === 0 ? (
        <div className="premium-card py-16 text-center">
          <p className="text-gray-400 text-sm font-medium">No expenses found.{' '}
            <button onClick={() => openModal()} className="text-gray-900 font-bold underline underline-offset-2">Add one?</button>
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 stagger-children">
            {filtered.map((row, i) => (
              <div key={i} className="row-card space-y-3 animate-fade-slide-up">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-[14px] text-gray-900 truncate">{row.category || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{row._parsed?.iso || row.date || '—'}</p>
                  </div>
                  <p className="font-black text-[16px] text-gray-900 flex-shrink-0">{fmt(row.amount)}</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                  <button onClick={() => openModal(row)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-100 transition-colors min-h-[36px]">
                    <Edit2 size={12} strokeWidth={2.5} /> Edit
                  </button>
                  <button onClick={() => setDeleteTarget(row)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-100 transition-colors min-h-[36px]">
                    <Trash2 size={12} strokeWidth={2.5} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block premium-card overflow-hidden p-0">
            <div className="table-scroll-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Date', 'Category', 'Amount (₹)', 'Actions'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i}>
                      <td className="text-gray-500">{row._parsed?.iso || row.date || '—'}</td>
                      <td>
                        <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                          <span className="w-2 h-2 rounded-full bg-gray-900 flex-shrink-0" />
                          {row.category || '—'}
                        </span>
                      </td>
                      <td className="font-bold text-gray-900">{fmt(row.amount)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openModal(row)} className="icon-btn text-gray-600 hover:bg-gray-100 w-8 h-8 min-w-0 min-h-0 rounded-lg" title="Edit"><Edit2 size={14} strokeWidth={2} /></button>
                          <button onClick={() => setDeleteTarget(row)} className="icon-btn text-gray-600 hover:bg-gray-100 w-8 h-8 min-w-0 min-h-0 rounded-lg" title="Delete"><Trash2 size={14} strokeWidth={2} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-semibold">Showing {filtered.length} of {expensesData.length} expenses</span>
              <span className="text-xs font-black text-gray-900">Total: {fmt(kpi.total)}</span>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="modal-handle"><div className="modal-handle-bar" /></div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">{formMode === 'edit' ? 'Edit Expense' : 'Add New Expense'}</h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-gray-900"><X size={18} strokeWidth={2} /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Date <span className="text-gray-500">*</span></label>
                  <input required type="date" className="premium-input" value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Category <span className="text-gray-500">*</span></label>
                  <input required type="text" placeholder="e.g. Internet, Office Rent…" className="premium-input"
                    value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold mb-2 text-gray-700">Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">₹</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="premium-input !pl-6"
                      value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                  </div>
                  {formData.amount !== '' && <p className="text-xs text-gray-400 mt-1.5 font-medium">= {fmt(formData.amount)}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditing(false)} className="ghost-button flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="premium-button flex-1">
                  {isSubmitting ? 'Saving…' : formMode === 'add' ? 'Add Expense' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-slide-up">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <Trash2 size={26} className="text-gray-900" strokeWidth={2} />
              </div>
            </div>
            <h3 className="text-[17px] font-black text-center text-gray-900 mb-1">Delete Expense?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-bold text-gray-900">{deleteTarget.category}</span> — {fmt(deleteTarget.amount)}
              <br /><span className="text-xs">This cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="ghost-button flex-1 justify-center">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting}
                className="flex-1 py-2.5 text-sm font-bold bg-gray-900 hover:bg-black text-white rounded-xl transition-colors min-h-[42px] disabled:opacity-60">
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── KPI Card ────────────────────────────────────────────────── */
const KpiCard = ({ icon: Icon, label, value, color, bg }) => (
  <div className="premium-card flex items-center gap-3">
    <div className={cn('p-2.5 rounded-xl flex-shrink-0', bg || 'bg-gray-50')}>
      <Icon size={18} className={color} strokeWidth={2} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className="text-[17px] sm:text-lg font-black text-gray-900 truncate">{value}</p>
    </div>
  </div>
);
