import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { updateSheetData } from '../services/googleSheets';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (v) => v ? `₹${Math.floor(Number(v)||0).toLocaleString('en-IN')}` : '—';
const today = () => new Date().toISOString().split('T')[0];

const INCOME_CATS = ['Investment','Live Streaming','Wedding','Rentals','Events','Social Media','Printing'];
const EXPENSE_CATS = ['Salary','Food','Transportation','Rental','Telecom','Electricity','Work Equipment','Sub Leasing','Repair & Maintenance','Security Deposits','Assets','Profit Share','Misc','Online Subscriptions'];
const SUBCATS = {
  'Live Streaming':['Live with LED','Live Streaming Only','YouTube Live','Facebook Live'],
  'Wedding':['Wedding Full','Wedding Photography','Wedding Videography','Wedding Editing'],
  'Events':['Live','Photography','Videography','Editing','Drone','Event Management'],
  'Social Media':['YouTube','Facebook','Instagram','Content Creation'],
  'Rentals':['Equipment Rental','Venue Rental'],
  'Printing':['Banner','Flex','Stationery'],
  'Investment':['Capital Investment','Loan'],
  'Salary':['Shafeeq','Razam','Aqthar','Basheer','Zaheer','Irshad','Other Staff'],
  'Food':['Breakfast','Lunch','Dinner','Groceries','Beverages'],
  'Transportation':['Wagon R','Volkswagen','Access 43','Access 44','Bus/Train/Flight','Tolls','Fuel'],
  'Rental':['Office Mangalore','Office Bangalore','Studio Rent'],
  'Telecom':['Internet','Mobile Recharge','Data Pack'],
  'Electricity':['Office Electricity','Studio Electricity'],
  'Work Equipment':['Camera','Lights','Audio','Computer','Accessories'],
  'Repair & Maintenance':['Vehicle Repair','Equipment Repair','Office Repair'],
  'Misc':['Other'],
  'Online Subscriptions':['Adobe','Google','Microsoft','Other SaaS'],
};
const EXECUTIVES = ['—','Shafeeq','Razam','Aqthar','Basheer','Zaheer','Irshad','Other'];
const PAYMENT_MODES = ['Cash','Bank Transfer','UPI','Card','Cheque'];
const STATUSES = ['Paid','Partial','Pending','Cancelled'];

const blank = () => ({
  date: today(), type: 'Income', category: '', subcategory: '',
  clientVendor: '', projectReference: '', paymentMode: 'Cash',
  invoiceNo: '', debit: '', credit: '', status: 'Paid',
  dueDate: '', notes: '', executive: '', executiveExpense: '', cashGiven: '',
});

const parseDateInfo = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return { monthName: '', year: '', monthNum: '' };
  return { monthName: MONTHS[dt.getMonth()], year: String(dt.getFullYear()), monthNum: String(dt.getMonth()+1) };
};

export const DailyJournal = ({ ledgerData = [], employeesData = [], onDataChanged }) => {
  // Build unique employee names for Salary subcategory
  const employeeNames = [...new Set(employeesData.map(e => (e['Employee Name'] || '').trim()).filter(Boolean))];
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [modal, setModal]         = useState(false);
  const [mode, setMode]           = useState('add');
  const [form, setForm]           = useState(blank());
  const [saving, setSaving]       = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const enriched = useMemo(() => {
    let bal = 0;
    return ledgerData.map((r, i) => {
      const credit = Number(r.credit || r['Credit (₹)'] || 0);
      const debit  = Number(r.debit  || r['Debit (₹)']  || 0);
      const net    = credit - debit;
      bal += net;
      const di = parseDateInfo(r.date || r['Date'] || '');
      return { ...r, _credit: credit, _debit: debit, _net: net, _bal: bal, _di: di, _idx: i+1 };
    });
  }, [ledgerData]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterType  !== 'All') rows = rows.filter(r => (r.type||r['Type']||'') === filterType);
    if (filterMonth !== 'All') rows = rows.filter(r => r._di.monthName === filterMonth);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.category||'').toLowerCase().includes(q) ||
        (r.clientVendor||r['Client / Vendor']||'').toLowerCase().includes(q) ||
        (r.projectReference||r['Project / Reference']||'').toLowerCase().includes(q) ||
        (r.invoiceNo||r['Invoice No']||'').toLowerCase().includes(q) ||
        (r.subcategory||'').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [enriched, filterType, filterMonth, search]);

  const months = useMemo(() => [...new Set(enriched.map(r => r._di.monthName).filter(Boolean))], [enriched]);
  const totIncome  = filtered.filter(r => (r.type||r.Type) === 'Income').reduce((s,r) => s+r._credit, 0);
  const totExpense = filtered.filter(r => (r.type||r.Type) === 'Expense').reduce((s,r) => s+r._debit, 0);

  const openAdd  = () => { setForm(blank()); setMode('add');  setModal(true); };
  const openEdit = (r) => {
    setForm({
      id: r.id, 'Src Row': r['Src Row'] || r.id,
      date: r.date || r['Date'] || today(),
      type: r.type || r['Type'] || 'Income',
      category: r.category || r['Category'] || '',
      subcategory: r.subcategory || r['Subcategory'] || '',
      clientVendor: r.clientVendor || r['Client / Vendor'] || '',
      projectReference: r.projectReference || r['Project / Reference'] || '',
      paymentMode: r.paymentMode || r['Payment Mode'] || 'Cash',
      invoiceNo: r.invoiceNo || r['Invoice No'] || '',
      debit: String(r._debit || ''),
      credit: String(r._credit || ''),
      status: r.status || r['Status'] || 'Paid',
      dueDate: r.dueDate || r['Due Date'] || '',
      notes: r.notes || r['Notes'] || '',
      executive: r.executive || r['Executive / Staff'] || '',
      executiveExpense: String(r['Executive Expense (₹)'] || r.executiveExpense || ''),
      cashGiven: String(r['Cash Given (₹)'] || r.cashGiven || ''),
    });
    setMode('edit'); setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.date) return toast.error('Date required');
    setSaving(true);
    const lt = toast.loading('Saving…');
    const di = parseDateInfo(form.date);
    const debitVal  = Math.floor(Number(form.debit)  || 0);
    const creditVal = Math.floor(Number(form.credit) || 0);
    const payload = {
      id: form.id, 'Src Row': form['Src Row'],
      date: form.date, 'Month #': di.monthNum, year: di.year,
      type: form.type, category: form.category, subcategory: form.subcategory,
      clientVendor: form.clientVendor, projectReference: form.projectReference,
      paymentMode: form.paymentMode, invoiceNo: form.invoiceNo,
      debit: debitVal, credit: creditVal, net: creditVal - debitVal,
      status: form.status, dueDate: form.dueDate, notes: form.notes,
      executive: form.executive, executiveExpense: Number(form.executiveExpense)||0,
      cashGiven: Number(form.cashGiven)||0,
      'Client / Vendor': form.clientVendor, 'Project / Reference': form.projectReference,
      'Payment Mode': form.paymentMode, 'Invoice No': form.invoiceNo,
      'Debit (₹)': debitVal, 'Credit (₹)': creditVal, 'Net (₹)': creditVal - debitVal,
      'Due Date': form.dueDate, 'Executive / Staff': form.executive,
      'Executive Expense (₹)': Number(form.executiveExpense)||0,
      'Cash Given (₹)': Number(form.cashGiven)||0,
    };
    try {
      const res = await updateSheetData(mode, 'Ledger', payload);
      if (res.status === 'error') throw new Error(res.message);
      toast.success(mode === 'add' ? 'Entry added!' : 'Entry updated!', { id: lt });
      setModal(false); onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt, duration: 6000 });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    const lt = toast.loading('Deleting…');
    const srcRow = delTarget['Src Row'] || delTarget.id;
    try {
      const res = await updateSheetData('delete', 'Ledger', { ...delTarget, 'Src Row': srcRow });
      if (res.status === 'error') throw new Error(res.message);
      toast.success('Deleted!', { id: lt }); setDelTarget(null); onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt });
    } finally { setDeleting(false); }
  };

  const cats = form.type === 'Income' ? INCOME_CATS : EXPENSE_CATS;
  // Salary subcategory = live employee names from Employees page
  const subcats = form.category === 'Salary'
    ? (employeeNames.length > 0 ? employeeNames : SUBCATS['Salary'])
    : (SUBCATS[form.category] || []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">📒 Daily Journal</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search journal…"
              className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-gray-900 min-h-[42px] w-44"/>
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none appearance-none min-h-[42px]">
            <option value="All">All Months</option>
            {months.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none appearance-none min-h-[42px]">
            <option value="All">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
          <button onClick={openAdd} className="premium-button text-sm">
            <Plus size={14} strokeWidth={2.5}/> Add Entry
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: filtered.length, color: 'text-gray-800', bg: 'bg-gray-100' },
          { label: 'Total Income', value: fmt(totIncome), color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Total Expense', value: fmt(totExpense), color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Net Balance', value: fmt(totIncome - totExpense), color: totIncome-totExpense >= 0 ? 'text-green-900' : 'text-red-900', bg: totIncome-totExpense >= 0 ? 'bg-green-100' : 'bg-red-100' },
        ].map(k => (
          <div key={k.label} className="premium-card flex items-center gap-3">
            <div className={cn('p-2 rounded-xl', k.bg)}>
              <span className={cn('text-lg font-black', k.color)}>₹</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
              <p className="text-base font-black text-gray-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="premium-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['#','Date','Month/Year','Type','Category','Subcategory','Client/Vendor','Project/Ref','Payment','Invoice','Debit','Credit','Net','Balance','Status','Executive','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-bold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-12 text-gray-400 font-medium">No journal entries found</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-400 font-mono">{r['Entry ID'] || r._idx}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.date || r['Date'] || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r._di.monthName} / {r._di.year}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold',
                      (r.type||r.Type) === 'Income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                      {r.type || r['Type'] || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{r.category || r['Category'] || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.subcategory || r['Subcategory'] || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.clientVendor || r['Client / Vendor'] || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.projectReference || r['Project / Reference'] || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.paymentMode || r['Payment Mode'] || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{r.invoiceNo || r['Invoice No'] || '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-red-600 whitespace-nowrap">{r._debit ? fmt(r._debit) : '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-green-600 whitespace-nowrap">{r._credit ? fmt(r._credit) : '—'}</td>
                  <td className={cn('px-3 py-2.5 font-bold whitespace-nowrap', r._net >= 0 ? 'text-green-700' : 'text-red-700')}>
                    {r._net >= 0 ? fmt(r._net) : `(${fmt(Math.abs(r._net))})`}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">{fmt(r._bal)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold',
                      r.status === 'Paid' ? 'bg-green-50 text-green-700' :
                      r.status === 'Partial' ? 'bg-yellow-50 text-yellow-700' :
                      r.status === 'Pending' ? 'bg-orange-50 text-orange-700' :
                      'bg-red-50 text-red-700')}>
                      {r.status || r['Status'] || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.executive || r['Executive / Staff'] || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(r)} className="icon-btn w-7 h-7 min-w-0 min-h-0 rounded-lg hover:bg-gray-100"><Edit2 size={13}/></button>
                      <button onClick={() => setDelTarget(r)} className="icon-btn w-7 h-7 min-w-0 min-h-0 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-semibold">Showing {filtered.length} of {ledgerData.length} entries</span>
          <span className="text-xs font-black text-gray-900">Net: {fmt(totIncome - totExpense)}</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-sheet">
            <div className="modal-handle"><div className="modal-handle-bar"/></div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">{mode === 'edit' ? 'Edit Entry' : 'Add Journal Entry'}</h3>
              <button onClick={() => setModal(false)} className="icon-btn"><X size={18}/></button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Date *</label>
                  <input required type="date" className="premium-input" value={form.date} onChange={e => set('date', e.target.value)}/>
                </div>
                {/* Type */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Type *</label>
                  <select required className="premium-input" value={form.type} onChange={e => { set('type', e.target.value); set('category',''); set('subcategory',''); }}>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
                {/* Category */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Category</label>
                  <select className="premium-input" value={form.category} onChange={e => { set('category', e.target.value); set('subcategory',''); }}>
                    <option value="">— Select —</option>
                    {cats.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {/* Subcategory */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Subcategory</label>
                  <select className="premium-input" value={form.subcategory} onChange={e => set('subcategory', e.target.value)}>
                    <option value="">— Select —</option>
                    {subcats.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {/* Client/Vendor */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Client / Vendor</label>
                  <input type="text" className="premium-input" placeholder="Name" value={form.clientVendor} onChange={e => set('clientVendor', e.target.value)}/>
                </div>
                {/* Project */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Project / Reference</label>
                  <input type="text" className="premium-input" placeholder="Project name" value={form.projectReference} onChange={e => set('projectReference', e.target.value)}/>
                </div>
                {/* Payment Mode */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Payment Mode</label>
                  <select className="premium-input" value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                {/* Invoice No */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Invoice No</label>
                  <input type="text" className="premium-input" placeholder="INV-001" value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)}/>
                </div>
                {/* Debit */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Debit (₹)</label>
                  <input type="number" min="0" className="premium-input" placeholder="0" value={form.debit} onChange={e => { set('debit', e.target.value); if(e.target.value) set('credit',''); }}/>
                </div>
                {/* Credit */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Credit (₹)</label>
                  <input type="number" min="0" className="premium-input" placeholder="0" value={form.credit} onChange={e => { set('credit', e.target.value); if(e.target.value) set('debit',''); }}/>
                </div>
                {/* Status */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Status</label>
                  <select className="premium-input" value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {/* Due Date */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Due Date</label>
                  <input type="date" className="premium-input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}/>
                </div>
                {/* Executive */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Executive / Staff</label>
                  <select className="premium-input" value={form.executive} onChange={e => set('executive', e.target.value)}>
                    {EXECUTIVES.map(ex => <option key={ex}>{ex}</option>)}
                  </select>
                </div>
                {/* Cash Given */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Cash Given (₹)</label>
                  <input type="number" min="0" className="premium-input" placeholder="0" value={form.cashGiven} onChange={e => set('cashGiven', e.target.value)}/>
                </div>
                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold mb-1 text-gray-700">Notes</label>
                  <input type="text" className="premium-input" placeholder="Remarks…" value={form.notes} onChange={e => set('notes', e.target.value)}/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="ghost-button flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="premium-button flex-1">
                  {saving ? 'Saving…' : mode === 'add' ? 'Add Entry' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {delTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={26} className="text-red-500"/>
              </div>
            </div>
            <h3 className="text-[17px] font-black text-center text-gray-900 mb-1">Delete Entry?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-bold text-gray-900">{delTarget.category || 'This entry'}</span>
              <br/><span className="text-xs">This cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)} disabled={deleting} className="ghost-button flex-1 justify-center">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors min-h-[42px] disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyJournal;
