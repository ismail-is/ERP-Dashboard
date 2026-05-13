import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import { Search, Download, Plus, Edit2, Trash2, X, Calendar, IndianRupee, Tag, Filter, CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const INCOME_CATEGORIES = ['Investment','Live Streaming','Wedding','Rentals','Events','Social Media','Printing'];
const EXPENSE_CATEGORIES = ['Salary','Food','Transportation','Rental','Telecom','Electricity','Work Equipment','Sub Leasing','Repair & Maintenance','Security Deposits','Assets','Profit Share','Misc','Online Subscriptions'];

const SUBCATEGORIES = {
  'Live Streaming': ['Live with LED','Live Streaming Only','YouTube Live','Facebook Live'],
  'Wedding': ['Wedding Full','Wedding Photography','Wedding Videography','Wedding Editing'],
  'Events': ['Live','Photography','Videography','Editing','Drone','Event Management'],
  'Social Media': ['YouTube','Facebook','Instagram','Content Creation'],
  'Rentals': ['Equipment Rental','Venue Rental'],
  'Printing': ['Banner','Flex','Stationery'],
  'Investment': ['Capital Investment','Loan'],
  'Salary': ['Shafeeq','Razam','Aqthar','Basheer','Zaheer','Irshad','Other Staff'],
  'Food': ['Breakfast','Lunch','Dinner','Groceries','Beverages'],
  'Transportation': ['Wagon R','Volkswagen','Access 43','Access 44','Bus/Train/Flight Tickets','Tolls','Fuel'],
  'Rental': ['Office Mangalore','Office Bangalore','Studio Rent'],
  'Telecom': ['Internet','Mobile Recharge','Data Pack'],
  'Electricity': ['Office Electricity','Studio Electricity'],
  'Work Equipment': ['Camera','Lights','Audio','Computer','Accessories'],
  'Repair & Maintenance': ['Vehicle Repair','Equipment Repair','Office Repair'],
  'Misc': ['Other'],
  'Online Subscriptions': ['Adobe','Google','Microsoft','Other SaaS'],
};

const EXECUTIVES = ['Shafeeq','Razam','Aqthar','Basheer','Zaheer','Irshad','Other'];

const parseAmt = (v) => Math.floor(Number(v) || 0);
const fmt      = (v) => `₹${parseAmt(v).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toISOString().split('T')[0];

const parseDate = (dateStr) => {
  if (!dateStr) return { month: '', year: '', monthNum: '', iso: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '', year: '', monthNum: '', iso: String(dateStr) };
  return { 
    month: MONTHS[d.getMonth()], 
    year: String(d.getFullYear()), 
    monthNum: String(d.getMonth() + 1),
    iso: d.toISOString().split('T')[0] 
  };
};

const emptyForm = () => ({
  date: todayISO(),
  type: 'Income',
  category: '',
  subcategory: '',
  clientVendor: '',
  projectReference: '',
  paymentMode: 'Cash',
  invoiceNo: '',
  debit: '',
  credit: '',
  status: 'Paid',
  executive: '',
  executiveExpense: '',
  cashGiven: '',
  notes: '',
  dueDate: '',
});

export const LedgerManager = ({ ledgerData = [], onDataChanged }) => {
  const [selMonth,    setSelMonth]    = useState('All');
  const [selYear,     setSelYear]     = useState('All');
  const [selType,     setSelType]     = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing,   setIsEditing]   = useState(false);
  const [formMode,    setFormMode]    = useState('add');
  const [formData,    setFormData]    = useState(emptyForm());
  const [isSubmitting,setIsSubmitting]= useState(false);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [isDeleting,  setIsDeleting]  = useState(false);

  const availableYears = useMemo(() => {
    const s = new Set(ledgerData.map(r => parseDate(r.date).year).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [ledgerData]);

  const availableMonths = useMemo(() => {
    const s = new Set(ledgerData.map(r => parseDate(r.date).month).filter(Boolean));
    return MONTHS.filter(m => s.has(m));
  }, [ledgerData]);

  const enriched = useMemo(() =>
    ledgerData.map(r => ({ ...r, _parsed: parseDate(r.date) })),
  [ledgerData]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (selMonth    !== 'All') rows = rows.filter(r => r._parsed.month === selMonth);
    if (selYear     !== 'All') rows = rows.filter(r => r._parsed.year  === selYear);
    if (selType     !== 'All') rows = rows.filter(r => (r.type || '') === selType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => 
        (r.category || '').toLowerCase().includes(q) ||
        (r.clientVendor || '').toLowerCase().includes(q) ||
        (r.projectReference || '').toLowerCase().includes(q) ||
        (r.invoiceNo || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [enriched, selMonth, selYear, selType, searchQuery]);

  const kpi = useMemo(() => {
    const totalDebit  = filtered.reduce((s, r) => s + parseAmt(r.debit), 0);
    const totalCredit = filtered.reduce((s, r) => s + parseAmt(r.credit), 0);
    const net         = totalCredit - totalDebit;
    const count       = filtered.length;
    return { totalDebit, totalCredit, net, count };
  }, [filtered]);

  const handleExportPDF = () => {
    if (!filtered.length) return toast.error('No data to export');
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('General Ledger Report', 14, 15);
    
    autoTable(doc, {
      head: [['Date', 'Type', 'Category', 'Client/Vendor', 'Invoice No', 'Debit', 'Credit', 'Status']],
      body: filtered.map(r => [
        r._parsed.iso || r.date || '',
        r.type || '',
        r.category || '',
        r.clientVendor || '',
        r.invoiceNo || '',
        parseAmt(r.debit).toLocaleString('en-IN'),
        parseAmt(r.credit).toLocaleString('en-IN'),
        r.status || ''
      ]),
      startY: 22,
      theme: 'grid',
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
      foot: [['', '', '', 'TOTAL', '', parseAmt(kpi.totalDebit).toLocaleString('en-IN'), parseAmt(kpi.totalCredit).toLocaleString('en-IN'), '']],
      footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
    });
    doc.save(`Ledger_${selMonth}_${selYear}.pdf`);
    toast.success('PDF Downloaded!');
  };

  const openModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      const srcRow = row['Src Row'] || row.id;
      setFormData({
        id: row.id,
        'Src Row': srcRow,
        date: row._parsed?.iso || row.date || todayISO(),
        type: row.type || 'Debit',
        category: row.category || '',
        subcategory: row.subcategory || '',
        clientVendor: row.clientVendor || '',
        projectReference: row.projectReference || '',
        paymentMode: row.paymentMode || 'UPI',
        invoiceNo: row.invoiceNo || '',
        debit: String(parseAmt(row.debit) || ''),
        credit: String(parseAmt(row.credit) || ''),
        status: row.status || 'Completed'
      });
    } else { 
      setFormMode('add'); 
      setFormData(emptyForm()); 
    }
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.date) return toast.error('Date is required');
    
    const parsed = parseDate(formData.date);
    const debitVal = parseAmt(formData.debit);
    const creditVal = parseAmt(formData.credit);
    const netVal = creditVal - debitVal;
    
    const srcRow  = formData['Src Row'] || formData.id;
    setIsSubmitting(true);
    const lt = toast.loading('Saving…');
    
    const payload = { 
      id: formData.id, 
      'Src Row': srcRow, 
      date: formData.date,
      'Month #': parsed.monthNum,
      year: parsed.year,
      type: formData.type,
      category: formData.category,
      subcategory: formData.subcategory,
      clientVendor: formData.clientVendor,
      projectReference: formData.projectReference,
      paymentMode: formData.paymentMode,
      invoiceNo: formData.invoiceNo,
      debit: debitVal,
      credit: creditVal,
      net: netVal,
      status: formData.status
    };
    
    // Handle padding for sheet headers if needed (as seen in ExpenseManager)
    Object.keys({ ...payload }).forEach(k => { 
      payload[k + ' '] = payload[k]; 
      payload[k + '\n'] = payload[k]; 
      payload[k + '\r'] = payload[k]; 
    });

    try {
      const result = await updateSheetData(formMode, 'Ledger', payload);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(formMode === 'add' ? 'Entry added!' : 'Entry updated!', { id: lt });
      setIsEditing(false); 
      onDataChanged?.();
    } catch (err) { 
      toast.error('Error: ' + err.message, { id: lt, duration: 6000 }); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const lt = toast.loading('Deleting…');
    const srcRow = deleteTarget['Src Row'] || deleteTarget.id;
    const payload = { ...deleteTarget, 'Src Row': srcRow, 'Src Row ': srcRow, 'Src Row\n': srcRow };
    try {
      const r = await updateSheetData('delete', 'Ledger', payload);
      if (r.status === 'error') throw new Error(r.message);
      toast.success('Entry deleted!', { id: lt }); 
      setDeleteTarget(null); 
      onDataChanged?.();
    } catch (err) { 
      toast.error('Error: ' + err.message, { id: lt }); 
    } finally { 
      setIsDeleting(false); 
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Completed') return <CheckCircle2 size={14} className="text-green-500" />;
    if (status === 'Pending') return <Clock size={14} className="text-yellow-500" />;
    if (status === 'Cancelled') return <XCircle size={14} className="text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls */}
      <div className="controls-row">
        <h2 className="section-title">📒 Daily Journal</h2>
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
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
            <select value={selType} onChange={e => setSelType(e.target.value)}
              className="pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none min-h-[42px]">
              <option value="All">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
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
            <Plus size={14} strokeWidth={2.5} /> Add Entry
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid stagger-children">
        <KpiCard icon={IndianRupee} label="Total Debit" value={fmt(kpi.totalDebit)} color="text-red-600" bg="bg-red-50" />
        <KpiCard icon={IndianRupee} label="Total Credit" value={fmt(kpi.totalCredit)} color="text-green-600" bg="bg-green-50" />
        <KpiCard icon={Tag} label="Net Balance" value={fmt(kpi.net)} color={kpi.net >= 0 ? "text-green-900" : "text-red-900"} bg={kpi.net >= 0 ? "bg-green-100" : "bg-red-100"} />
        <KpiCard icon={Calendar} label="Total Entries" value={kpi.count} color="text-gray-800" bg="bg-gray-100" />
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block premium-card overflow-hidden p-0">
        <div className="table-scroll-container">
          <table className="data-table">
            <thead>
              <tr>
                {['Date', 'Type', 'Category', 'Client / Vendor', 'Invoice No', 'Debit (₹)', 'Credit (₹)', 'Status', 'Actions'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  <td className="text-gray-500">{row._parsed?.iso || row.date || '—'}</td>
                  <td>
                    <span className={cn(
                      'inline-flex items-center px-2 py-1 rounded-md text-xs font-bold',
                      row.type === 'Income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    )}>
                      {row.type || '—'}
                    </span>
                  </td>
                  <td className="font-semibold text-gray-900">{row.category || '—'}</td>
                  <td className="text-gray-600">{row.clientVendor || '—'}</td>
                  <td className="text-gray-500 font-mono text-xs">{row.invoiceNo || '—'}</td>
                  <td className="font-bold text-red-600">{row.debit ? fmt(row.debit) : '—'}</td>
                  <td className="font-bold text-green-600">{row.credit ? fmt(row.credit) : '—'}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(row.status)}
                      <span className="text-xs font-medium text-gray-700">{row.status || '—'}</span>
                    </div>
                  </td>
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
          <span className="text-xs text-gray-400 font-semibold">Showing {filtered.length} of {ledgerData.length} entries</span>
          <span className="text-xs font-black text-gray-900">Net: {fmt(kpi.net)}</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="modal-handle"><div className="modal-handle-bar" /></div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">{formMode === 'edit' ? 'Edit Entry' : 'Add New Entry'}</h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-gray-900"><X size={18} strokeWidth={2} /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Date <span className="text-gray-500">*</span></label>
                  <input required type="date" className="premium-input" value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Type <span className="text-red-400">*</span></label>
                  <select required className="premium-input" value={formData.type}
                    onChange={e => setFormData(p => ({ ...p, type: e.target.value, category: '', subcategory: '' }))}>
                    <option value="Income">💚 Income</option>
                    <option value="Expense">🔴 Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Category</label>
                  <select className="premium-input" value={formData.category}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value, subcategory: '' }))}>
                    <option value="">— Select Category —</option>
                    {(formData.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Subcategory</label>
                  <select className="premium-input" value={formData.subcategory}
                    onChange={e => setFormData(p => ({ ...p, subcategory: e.target.value }))}>
                    <option value="">— Select Subcategory —</option>
                    {(SUBCATEGORIES[formData.category] || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Client / Vendor</label>
                  <input type="text" placeholder="Name" className="premium-input"
                    value={formData.clientVendor} onChange={e => setFormData(p => ({ ...p, clientVendor: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Project / Reference</label>
                  <input type="text" placeholder="Project Name" className="premium-input"
                    value={formData.projectReference} onChange={e => setFormData(p => ({ ...p, projectReference: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Payment Mode</label>
                  <select className="premium-input" value={formData.paymentMode}
                    onChange={e => setFormData(p => ({ ...p, paymentMode: e.target.value }))}>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Executive / Staff</label>
                  <select className="premium-input" value={formData.executive}
                    onChange={e => setFormData(p => ({ ...p, executive: e.target.value }))}>
                    <option value="">— None —</option>
                    {EXECUTIVES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Invoice No</label>
                  <input type="text" placeholder="INV-001" className="premium-input"
                    value={formData.invoiceNo} onChange={e => setFormData(p => ({ ...p, invoiceNo: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Debit (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">₹</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="premium-input pl-8"
                      value={formData.debit} onChange={e => setFormData(p => ({ ...p, debit: e.target.value.replace(/[^0-9]/g, ''), credit: '' }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Credit (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">₹</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="premium-input pl-8"
                      value={formData.credit} onChange={e => setFormData(p => ({ ...p, credit: e.target.value.replace(/[^0-9]/g, ''), debit: '' }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Status</label>
                  <select className="premium-input" value={formData.status}
                    onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Due Date</label>
                  <input type="date" className="premium-input" value={formData.dueDate}
                    onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold mb-2 text-gray-700">Notes</label>
                  <input type="text" placeholder="Any remarks…" className="premium-input"
                    value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditing(false)} className="ghost-button flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="premium-button flex-1">
                  {isSubmitting ? 'Saving…' : formMode === 'add' ? 'Add Entry' : 'Save Changes'}
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
            <h3 className="text-[17px] font-black text-center text-gray-900 mb-1">Delete Entry?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-bold text-gray-900">{deleteTarget.category || 'Entry'}</span>
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
