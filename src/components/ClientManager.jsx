import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import {
  Search, Download, Plus, Edit2, Trash2,
  TrendingUp, CheckCircle, Clock, AlertCircle,
  X, BarChart2, Users, IndianRupee, ChevronDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

const STATUS_CONFIG = {
  Active:        { bg: 'bg-gray-100', text: 'text-gray-900', dot: 'bg-gray-800', icon: CheckCircle },
  Pending:       { bg: 'bg-gray-50',  text: 'text-gray-600', dot: 'bg-gray-400', icon: Clock       },
  Closed:        { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', icon: CheckCircle },
  Overdue:       { bg: 'bg-gray-200', text: 'text-gray-800', dot: 'bg-gray-600', icon: AlertCircle },
  'No activity': { bg: 'bg-gray-50',  text: 'text-gray-500', dot: 'bg-gray-400', icon: AlertCircle },
};

const getStatusCfg = (s) =>
  STATUS_CONFIG[s] || { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', icon: AlertCircle };

const CHART_COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'];

const parseAmt = (v) => Math.floor(Number(v) || 0);
const fmt      = (v) => `₹${parseAmt(v).toLocaleString('en-IN')}`;
const emptyForm = () => ({ name: '', date: new Date().toISOString().split('T')[0], services: '', status: 'Pending', amount: '' });

/* ══════════════════════════════════════════════════════════════ */
export const ClientManager = ({ clientsData = [], onDataChanged }) => {
  const [searchQuery,  setSearchQuery]  = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isEditing,    setIsEditing]    = useState(false);
  const [formMode,     setFormMode]     = useState('add');
  const [formData,     setFormData]     = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  /* ── Filtered ─────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let rows = clientsData;
    if (statusFilter !== 'All') rows = rows.filter(r => (r.status || '') === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.name     || '').toLowerCase().includes(q) ||
        (r.services || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [clientsData, statusFilter, searchQuery]);

  /* ── KPIs ─────────────────────────────────────────────────── */
  const kpi = useMemo(() => ({
    totalRevenue: filtered.reduce((s, r) => s + parseAmt(r.amount), 0),
    total:        filtered.length,
    active:       filtered.filter(r => r.status === 'Active').length,
    pending:      filtered.filter(r => r.status === 'Pending' || r.status === 'Overdue').length,
  }), [filtered]);

  /* ── Charts ───────────────────────────────────────────────── */
  const barData = useMemo(() =>
    filtered.map(r => ({ name: (r.name || '').split(' ')[0], Revenue: parseAmt(r.amount) })),
  [filtered]);

  const pieData = useMemo(() => {
    const map = {};
    filtered.forEach(r => { const s = r.status || 'Unknown'; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  /* ── Statuses ─────────────────────────────────────────────── */
  const allStatuses = useMemo(() => {
    const s = new Set(clientsData.map(r => r.status).filter(Boolean));
    return ['All', ...s];
  }, [clientsData]);

  /* ── Export PDF ───────────────────────────────────────────── */
  const handleExportPDF = () => {
    if (!filtered.length) return toast.error('No data to export');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Client Report', 14, 15);
    autoTable(doc, {
      head: [['Client', 'Services', 'Revenue (Rs.)', 'Status']],
      body: filtered.map(r => [r.name || '', r.services || '', parseAmt(r.amount).toLocaleString('en-IN'), r.status || '']),
      startY: 22, theme: 'grid',
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });
    doc.save('Client_Report.pdf');
    toast.success('PDF Downloaded!');
  };

  /* ── Open modal ───────────────────────────────────────────── */
  const openModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      const srcRow = row['Src Row'] || row.id;
      setFormData({
        _originalRow: row, id: row.id, 'Src Row': srcRow,
        name: row.name || '',
        date: row.date || '',
        services: row.services || '',
        status: row.status || 'Pending',
        amount: String(parseAmt(row.amount) || ''),
      });
    } else {
      setFormMode('add');
      setFormData(emptyForm());
    }
    setIsEditing(true);
  };

  /* ── Save ─────────────────────────────────────────────────── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Client name is required');
    const amtVal  = parseAmt(formData.amount);
    const srcRow  = formData['Src Row'] || formData.id;
    setIsSubmitting(true);
    const lt = toast.loading('Saving…');
    const payload = { id: formData.id, 'Src Row': srcRow, name: formData.name.trim(), date: formData.date, services: formData.services.trim(), status: formData.status, amount: amtVal };
    Object.keys({ ...payload }).forEach(k => { payload[k + ' '] = payload[k]; payload[k + '\n'] = payload[k]; payload[k + '\r'] = payload[k]; });
    try {
      const result = await updateSheetData(formMode, 'Clients', payload);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(formMode === 'add' ? 'Client added!' : 'Client updated!', { id: lt });
      setIsEditing(false);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt, duration: 6000 });
    } finally { setIsSubmitting(false); }
  };

  /* ── Delete ───────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const lt = toast.loading('Deleting…');
    const srcRow = deleteTarget['Src Row'] || deleteTarget.id;
    const payload = { ...deleteTarget, 'Src Row': srcRow, 'Src Row ': srcRow, 'Src Row\n': srcRow, 'Src Row\r': srcRow };
    try {
      const r = await updateSheetData('delete', 'Clients', payload);
      if (r.status === 'error') throw new Error(r.message);
      toast.success('Client deleted!', { id: lt });
      setDeleteTarget(null);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt });
    } finally { setIsDeleting(false); }
  };

  /* ══════════ RENDER ══════════════════════════════════════════ */
  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Controls ───────────────────────────────────────── */}
      <div className="controls-row">
        <h2 className="section-title">Client Management</h2>
        <div className="controls-actions">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <input
              type="text" placeholder="Search…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all min-h-[42px]"
            />
          </div>
          <button onClick={handleExportPDF} className="ghost-button text-sm">
            <Download size={14} />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button onClick={() => openModal()} className="premium-button text-sm">
            <Plus size={14} strokeWidth={2.5} /> Add Client
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="kpi-grid stagger-children">
        <KpiCard icon={IndianRupee} label="Total Revenue"   value={fmt(kpi.totalRevenue)} color="text-gray-900" bg="bg-gray-100" />
        <KpiCard icon={Users}       label="Total Clients"   value={kpi.total}             color="text-gray-700" bg="bg-gray-100"    />
        <KpiCard icon={CheckCircle} label="Active"          value={kpi.active}            color="text-gray-900" bg="bg-gray-100" />
        <KpiCard icon={Clock}       label="Pending/Overdue" value={kpi.pending}           color="text-gray-800" bg="bg-gray-200"     />
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="premium-card lg:col-span-2 overflow-hidden" style={{ height: 'clamp(200px, 30vw, 280px)' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900">
              <BarChart2 size={14} className="text-gray-400" /> Revenue by Client
            </h3>
            <ResponsiveContainer width="100%" height="84%">
              <BarChart data={barData} margin={{ top: 0, right: 5, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12, fontWeight: 600 }}
                  formatter={(v) => [fmt(v), 'Revenue']}
                />
                <Bar dataKey="Revenue" fill="#111827" radius={[5, 5, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="premium-card overflow-hidden" style={{ height: 'clamp(200px, 30vw, 280px)' }}>
            <h3 className="text-sm font-bold mb-2 text-gray-900">Status Breakdown</h3>
            <ResponsiveContainer width="100%" height="88%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="48%" innerRadius="42%" outerRadius="62%" paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} clients`, n]} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Filter Chips ───────────────────────────────────── */}
      <div className="chip-scroll">
        {allStatuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('filter-chip', statusFilter === s && 'active')}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Data ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="premium-card py-16 text-center">
          <p className="text-gray-400 text-sm font-medium">
            No clients found.{' '}
            <button onClick={() => openModal()} className="text-gray-900 font-bold underline underline-offset-2">
              Add one?
            </button>
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 stagger-children">
            {filtered.map((row, i) => {
              const sc   = getStatusCfg(row.status);
              const Icon = sc.icon;
              return (
                <div key={i} className="row-card space-y-3 animate-fade-slide-up">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[14px] text-gray-900 truncate">{row.name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{row.date || 'No date'} · {row.services || 'No service listed'}</p>
                    </div>
                    <span className={cn('badge flex-shrink-0', sc.bg, sc.text)}>
                      <Icon size={10} strokeWidth={2.5} />{row.status || '—'}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Revenue</p>
                    <p className="font-black text-[15px] text-gray-900">{fmt(row.amount)}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                    <button onClick={() => openModal(row)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-100 transition-colors min-h-[36px]">
                      <Edit2 size={12} strokeWidth={2.5} /> Edit
                    </button>
                    <button onClick={() => setDeleteTarget(row)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-100 transition-colors min-h-[36px]">
                      <Trash2 size={12} strokeWidth={2.5} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block premium-card overflow-hidden p-0">
            <div className="table-scroll-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Date', 'Client', 'Services', 'Revenue', 'Status', 'Actions'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const sc   = getStatusCfg(row.status);
                    const Icon = sc.icon;
                    return (
                      <tr key={i}>
                        <td className="text-gray-500">{row.date || '—'}</td>
                        <td className="font-bold text-gray-900">{row.name || '—'}</td>
                        <td className="text-gray-500">{row.services || '—'}</td>
                        <td className="font-bold text-gray-900">{fmt(row.amount)}</td>
                        <td>
                          <span className={cn('badge', sc.bg, sc.text)}>
                            <Icon size={10} strokeWidth={2.5} />{row.status || '—'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openModal(row)}
                              className="icon-btn text-gray-600 hover:bg-gray-100 w-8 h-8 min-w-0 min-h-0 rounded-lg" title="Edit">
                              <Edit2 size={14} strokeWidth={2} />
                            </button>
                            <button onClick={() => setDeleteTarget(row)}
                              className="icon-btn text-gray-600 hover:bg-gray-100 w-8 h-8 min-w-0 min-h-0 rounded-lg" title="Delete">
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400 font-semibold flex items-center justify-between">
              <span>Showing {filtered.length} of {clientsData.length} clients</span>
              <span className="font-bold text-gray-700">Total: {fmt(kpi.totalRevenue)}</span>
            </div>
          </div>
        </>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────── */}
      {isEditing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="modal-handle"><div className="modal-handle-bar" /></div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">
                {formMode === 'edit' ? 'Edit Client' : 'Add New Client'}
              </h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-gray-900">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold mb-2 text-gray-700">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <input required type="text" placeholder="e.g. Acme Corporation"
                    className="premium-input"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Date <span className="text-red-500">*</span></label>
                  <input required type="date" className="premium-input"
                    value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Services</label>
                  <input type="text" placeholder="e.g. Wedding Photography"
                    className="premium-input"
                    value={formData.services}
                    onChange={e => setFormData(p => ({ ...p, services: e.target.value }))} />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Status</label>
                  <select className="premium-input" value={formData.status}
                    onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                    {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold mb-2 text-gray-700">Revenue (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">₹</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0"
                      className="premium-input !pl-6"
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                  </div>
                  {formData.amount !== '' && (
                    <p className="text-xs text-gray-400 mt-1.5 font-medium">= {fmt(formData.amount)}</p>
                  )}
                </div>

              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="ghost-button flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="premium-button flex-1">
                  {isSubmitting ? 'Saving…' : formMode === 'add' ? 'Add Client' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-slide-up">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <Trash2 size={26} className="text-gray-900" strokeWidth={2} />
              </div>
            </div>
            <h3 className="text-[17px] font-black text-center text-gray-900 mb-1">Delete Client?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to delete{' '}
              <span className="font-bold text-gray-900">{deleteTarget.name}</span>?
              <br /><span className="text-xs">This action cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                className="ghost-button flex-1 justify-center">Cancel</button>
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

/* ── KPI sub-component ──────────────────────────────────────── */
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
