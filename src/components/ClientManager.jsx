import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import {
  Search, Download, Plus, Edit2, Trash2,
  TrendingUp, CheckCircle, Clock, AlertCircle,
  X, BarChart2, Users, IndianRupee
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

/* ── GSheet columns: id | name | status | services | amount ── */

const STATUS_CONFIG = {
  Active:       { bg: 'bg-green-50',  text: 'text-green-700',  icon: CheckCircle },
  Pending:      { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Clock       },
  Closed:       { bg: 'bg-gray-100',  text: 'text-gray-600',   icon: CheckCircle },
  Overdue:      { bg: 'bg-red-50',    text: 'text-red-600',    icon: AlertCircle },
  'No activity':{ bg: 'bg-blue-50',   text: 'text-blue-600',   icon: AlertCircle },
};

const getStatusCfg = (s) =>
  STATUS_CONFIG[s] || { bg: 'bg-gray-100', text: 'text-gray-500', icon: AlertCircle };

const COLORS = ['#000000','#4b5563','#9ca3af','#d1d5db','#374151'];

/* Strict integer parser — never returns decimals */
const parseAmt = (v) => Math.floor(Number(v) || 0);
const fmt = (v) => `₹${parseAmt(v).toLocaleString('en-IN')}`;

const emptyForm = () => ({ name: '', services: '', status: 'Pending', amount: '' });

/* ════════════════════════════════════════════════════════════ */
export const ClientManager = ({ clientsData = [], onDataChanged }) => {
  const [searchQuery,  setSearchQuery]  = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isEditing,    setIsEditing]    = useState(false);
  const [formMode,     setFormMode]     = useState('add');
  const [formData,     setFormData]     = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // row to delete
  const [isDeleting,   setIsDeleting]   = useState(false);

  /* ─── Filtered data ─────────────────────────────────────── */
  const filtered = useMemo(() => {
    let rows = clientsData;
    if (statusFilter !== 'All')
      rows = rows.filter(r => (r.status || '') === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.services || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [clientsData, statusFilter, searchQuery]);

  /* ─── KPIs ──────────────────────────────────────────────── */
  const kpi = useMemo(() => ({
    totalRevenue: filtered.reduce((s, r) => s + parseAmt(r.amount), 0),
    total:        filtered.length,
    active:       filtered.filter(r => r.status === 'Active').length,
    pending:      filtered.filter(r => r.status === 'Pending' || r.status === 'Overdue').length,
  }), [filtered]);

  /* ─── Chart data ────────────────────────────────────────── */
  const barData = useMemo(() =>
    filtered.map(r => ({ name: (r.name || '').split(' ')[0], Revenue: parseAmt(r.amount) })),
  [filtered]);

  const pieData = useMemo(() => {
    const map = {};
    filtered.forEach(r => { const s = r.status || 'Unknown'; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  /* ─── Export PDF ────────────────────────────────────────── */
  const handleExportPDF = () => {
    if (!filtered.length) return toast.error('No data to export');
    const doc = new jsPDF();
    doc.text('Client Report', 14, 15);
    autoTable(doc, {
      head: [['Client', 'Services', 'Revenue (₹)', 'Status']],
      body: filtered.map(r => [r.name || '', r.services || '', parseAmt(r.amount).toLocaleString('en-IN'), r.status || '']),
      startY: 20, theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 0, 0] },
    });
    doc.save('Client_Report.pdf');
    toast.success('PDF Downloaded!');
  };

  /* ─── Amount: integers only ─────────────────────────────── */
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, ''); // strip non-digits
    setFormData(prev => ({ ...prev, amount: raw }));
  };

  /* ─── Open modal ────────────────────────────────────────── */
  const openModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      // 'Src Row' is what the Apps Script uses to locate the row.
      // Clients sheet uses 'id' — map it so the backend can find the row.
      const srcRow = row['Src Row'] || row.id;
      setFormData({
        _originalRow: row,
        id:           row.id,
        'Src Row':    srcRow,
        name:         row.name     || '',
        services:     row.services || '',
        status:       row.status   || 'Pending',
        amount:       String(parseAmt(row.amount) || ''),
      });
    } else {
      setFormMode('add');
      setFormData(emptyForm());
    }
    setIsEditing(true);
  };

  /* ─── Save ──────────────────────────────────────────────── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Client name is required');
    const amtVal = parseAmt(formData.amount);

    setIsSubmitting(true);
    const lt = toast.loading('Saving…');

    // 'Src Row' is what Apps Script uses to find the row.
    // For Clients, id acts as Src Row — send both so backend finds it either way.
    const srcRow = formData['Src Row'] || formData.id;

    const payload = {
      id:        formData.id,
      'Src Row': srcRow,
      name:      formData.name.trim(),
      services:  formData.services.trim(),
      status:    formData.status,
      amount:    amtVal,
    };

    // Duplicate keys with variants (trailing space/newline) so dirty GSheet headers still match
    const keysSnapshot = Object.keys(payload);
    keysSnapshot.forEach(key => {
      payload[key + ' ']  = payload[key];
      payload[key + '\n'] = payload[key];
      payload[key + '\r'] = payload[key];
    });

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

  /* ─── Delete — opens centered confirm modal ─────────────── */
  const handleDelete = (row) => setDeleteTarget(row);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const lt = toast.loading('Deleting…');

    // Build delete payload — map id → Src Row so Apps Script can find the row
    const srcRow = deleteTarget['Src Row'] || deleteTarget.id;
    const deletePayload = {
      ...deleteTarget,
      'Src Row':    srcRow,
      'Src Row ':   srcRow,
      'Src Row\n':  srcRow,
      'Src Row\r':  srcRow,
    };

    try {
      const r = await updateSheetData('delete', 'Clients', deletePayload);
      if (r.status === 'error') throw new Error(r.message);
      toast.success('Client deleted!', { id: lt });
      setDeleteTarget(null);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt });
    } finally { setIsDeleting(false); }
  };

  const allStatuses = useMemo(() => {
    const s = new Set(clientsData.map(r => r.status).filter(Boolean));
    return ['All', ...s];
  }, [clientsData]);

  /* ══════════ RENDER ══════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <h2 className="text-base font-bold">Client Management</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text" placeholder="Search client or service…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black min-h-[44px]"
            />
          </div>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors min-h-[44px]">
            <Download size={15} /><span className="hidden sm:inline">Export PDF</span>
          </button>
          <button onClick={() => openModal()} className="premium-button text-sm">
            <Plus size={15} /> Add Client
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={IndianRupee} label="Total Revenue"   value={fmt(kpi.totalRevenue)}  color="text-green-600" />
        <KpiCard icon={Users}       label="Total Clients"   value={kpi.total}              color="text-blue-600"  />
        <KpiCard icon={CheckCircle} label="Active"          value={kpi.active}             color="text-emerald-600" />
        <KpiCard icon={Clock}       label="Pending/Overdue" value={kpi.pending}            color="text-red-500"   />
      </div>

      {/* ── Charts ── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="premium-card lg:col-span-2 h-[220px] sm:h-[260px]">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><BarChart2 size={14}/> Revenue by Client</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={barData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Bar dataKey="Revenue" fill="#000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="premium-card h-[220px] sm:h-[260px]">
            <h3 className="text-sm font-bold mb-3">Status Breakdown</h3>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} clients`, n]} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Status chips ── */}
      <div className="flex gap-2 flex-wrap">
        {allStatuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border min-h-[36px]',
              statusFilter === s ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            )}>{s}</button>
        ))}
      </div>

      {/* ── Data ── */}
      {filtered.length === 0 ? (
        <div className="premium-card py-16 text-center">
          <p className="text-gray-400 text-sm">No clients found. <button onClick={() => openModal()} className="text-black font-semibold underline">Add one?</button></p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((row, i) => {
              const sc = getStatusCfg(row.status);
              const Icon = sc.icon;
              return (
                <div key={i} className="premium-card space-y-3 animate-fade-slide-up">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{row.name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{row.services || 'No service listed'}</p>
                    </div>
                    <span className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold flex-shrink-0', sc.bg, sc.text)}>
                      <Icon size={11} />{row.status || '—'}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Revenue</p>
                    <p className="font-bold text-base mt-0.5 text-green-700">{fmt(row.amount)}</p>
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
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block premium-card overflow-hidden">
            <div className="table-scroll-container">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Client', 'Services', 'Revenue (₹)', 'Status', 'Actions'].map(h => (
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
                        <td className="py-3.5 px-3 text-sm font-bold text-green-700 whitespace-nowrap">{fmt(row.amount)}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold', sc.bg, sc.text)}>
                            <Icon size={11} />{row.status || '—'}
                          </span>
                        </td>
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
            <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400 font-medium">
              Showing {filtered.length} of {clientsData.length} clients
            </div>
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {isEditing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold">{formMode === 'edit' ? 'Edit Client' : 'Add New Client'}</h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-black hover:bg-gray-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Client Name <span className="text-red-500">*</span></label>
                  <input
                    required type="text"
                    placeholder="e.g. Wedding Clients"
                    className="premium-input"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                {/* Services */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Services</label>
                  <input
                    type="text"
                    placeholder="e.g. Wedding Photography"
                    className="premium-input"
                    value={formData.services}
                    onChange={e => setFormData(p => ({ ...p, services: e.target.value }))}
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Status</label>
                  <select className="premium-input" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                    {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Revenue — integers only */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Revenue (₹) — whole numbers only</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      className="premium-input pl-8"
                      value={formData.amount}
                      onChange={handleAmountChange}
                    />
                  </div>
                  {formData.amount !== '' && (
                    <p className="text-xs text-gray-400 mt-1">
                      = {fmt(formData.amount)}
                    </p>
                  )}
                </div>

              </div>
              <div className="flex gap-3 pt-3 border-t border-gray-100 pb-1">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 premium-button">
                  {isSubmitting ? 'Saving…' : formMode === 'add' ? 'Add Client' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Centered Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-slide-up">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={26} className="text-red-500" />
              </div>
            </div>
            {/* Text */}
            <h3 className="text-lg font-bold text-center text-black mb-1">Delete Client?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to delete{' '}
              <span className="font-bold text-black">{deleteTarget.name}</span>?
              <br /><span className="text-xs">This action cannot be undone.</span>
            </p>
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors min-h-[44px] disabled:opacity-60"
              >
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
