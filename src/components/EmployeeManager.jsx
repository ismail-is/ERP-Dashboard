import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from './DataTable';
import { cn } from '../utils/cn';
import { updateSheetData } from '../services/googleSheets';
import { ArrowLeft, Download, Plus, Trash2, Edit2, Search, Calendar, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const parseDateObj = (dateStr) => {
  if (!dateStr) return new Date(0);
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length === 3) { d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); if (!isNaN(d.getTime())) return d; }
  return new Date(0);
};

const formatLocalYMD = (dateObj) => {
  if (isNaN(dateObj?.getTime())) return '';
  return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
};

const COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'];

export const EmployeeManager = ({ employeesData, onDataChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmployee = searchParams.get('employee');

  const setSelectedEmployee = (name) => {
    if (name) { searchParams.set('employee', name); setSearchParams(searchParams); }
    else { searchParams.delete('employee'); setSearchParams(searchParams); }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [mainSelectedMonth, setMainSelectedMonth] = useState('All');

  const employeeSummary = useMemo(() => {
    let filteredData = employeesData;
    if (mainSelectedMonth !== 'All') {
      filteredData = filteredData.filter(r => {
        if (!r.Date) return false;
        try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return false; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === mainSelectedMonth; }
        catch { return false; }
      });
    }
    if (mainSearchQuery) {
      const q = mainSearchQuery.toLowerCase();
      filteredData = filteredData.filter(r => (r['Employee Name'] || '').toLowerCase().includes(q));
    }
    const summaryMap = {};
    filteredData.forEach(row => {
      const rawName = row['Employee Name']?.trim() || 'Unassigned';
      const key = rawName.toLowerCase();
      if (!summaryMap[key]) summaryMap[key] = { name: rawName, totalGiven: 0, totalExpense: 0, balance: 0, rows: [] };
      summaryMap[key].totalGiven   += Number(row['Cash Given (₹)'] || 0);
      summaryMap[key].totalExpense += Number(row['Expense (₹)'] || 0);
      summaryMap[key].balance = summaryMap[key].totalGiven - summaryMap[key].totalExpense;
      summaryMap[key].rows.push(row);
    });
    return Object.values(summaryMap);
  }, [employeesData, mainSelectedMonth, mainSearchQuery]);

  const graphData = useMemo(() =>
    employeeSummary.map(emp => ({ name: emp.name.split(' ')[0], Cash: emp.totalGiven, Expense: emp.totalExpense })),
  [employeeSummary]);

  const handleExportPDF = (dataToExport, title) => {
    if (!dataToExport?.length) return toast.error('No data to export');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Report: ${title.replace(/_/g, ' ')}`, 14, 15);

    let head = [];
    let body = [];

    if (title === 'Employee_Summary') {
      head = [['Employee Name', 'Cash Given (Rs.)', 'Expense (Rs.)', 'Balance (Rs.)']];
      body = dataToExport.map(row => [
        row.name || 'Unassigned',
        row.totalGiven.toLocaleString('en-IN'),
        row.totalExpense.toLocaleString('en-IN'),
        row.balance.toLocaleString('en-IN')
      ]);
    } else {
      head = [['Date', 'Reference', 'Vendor', 'Mode', 'Cash Given (Rs.)', 'Expense (Rs.)', 'Status']];
      body = dataToExport.map(row => [
        row.Date ? formatLocalYMD(parseDateObj(row.Date)) : '',
        row['Project / Reference'] || '',
        row['Client / Vendor'] || '',
        row['Payment Mode'] || '',
        Math.floor(Number(row['Cash Given (₹)'] || 0)).toLocaleString('en-IN'),
        Math.floor(Number(row['Expense (₹)'] || 0)).toLocaleString('en-IN'),
        row.Status || ''
      ]);
    }

    autoTable(doc, {
      head,
      body,
      startY: 22,
      theme: 'grid',
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
    });

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF Downloaded!');
  };

  const handleSaveRow = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const dataToSave = { ...formData };
    Object.keys(formData).forEach(k => { dataToSave[k + '\n'] = formData[k]; dataToSave[k + ' '] = formData[k]; });
    if (formMode === 'add') {
      dataToSave['Src Row'] = Date.now().toString();
    }
    // Always auto-compute balance from integers
    const cashGiven = Math.floor(Number(dataToSave['Cash Given (₹)'] || 0));
    const expAmt    = Math.floor(Number(dataToSave['Expense (₹)'] || 0));
    dataToSave['Cash Given (₹)']        = cashGiven;
    dataToSave['Expense (₹)']           = expAmt;
    dataToSave['Balance After Row (₹)'] = cashGiven - expAmt;
    const lt = toast.loading('Saving…');
    try {
      const result = await updateSheetData(formMode, 'Employees', dataToSave);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(formMode === 'add' ? 'Entry added!' : 'Entry updated!', { id: lt });
      setIsEditing(false); setFormData({}); onDataChanged();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt, duration: 8000 });
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteRow = (row) => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-center items-center p-1">
        <p className="font-bold text-sm">Delete this row?</p>
        <div className="flex gap-2 w-full">
          <button className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold" onClick={() => toast.dismiss(t.id)}>Cancel</button>
          <button className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold" onClick={async () => {
            toast.dismiss(t.id);
            const lt = toast.loading('Deleting…');
            try {
              const result = await updateSheetData('delete', 'Employees', row);
              if (result.status === 'error') throw new Error(result.message);
              toast.success('Deleted!', { id: lt }); onDataChanged();
            } catch (err) { toast.error('Error deleting.', { id: lt }); }
          }}>Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const openEditModal = (row = null) => {
    if (row) {
      setFormMode('edit');
      const editData = { ...row };
      if (editData.Date) editData.Date = formatLocalYMD(parseDateObj(editData.Date));
      // Ensure integer values
      editData['Cash Given (₹)'] = Math.floor(Number(editData['Cash Given (₹)'] || 0));
      editData['Expense (₹)']    = Math.floor(Number(editData['Expense (₹)'] || 0));
      setFormData(editData);
    } else {
      setFormMode('add');
      setFormData({
        'Date': formatLocalYMD(new Date()),
        'Employee Name': selectedEmployee || '',
        'Project / Reference': '',
        'Client / Vendor': '',
        'Payment Mode': 'Cash',
        'Cash Given (₹)': '',
        'Expense (₹)': '',
        'Status': 'Pending',
        'Notes': ''
      });
    }
    setIsEditing(true);
  };

  /* ── Modal ── */
  const renderModal = () => {
    if (!isEditing) return null;

    /* integer-only handler */
    const handleInt = (key) => (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [key]: raw }));
    };

    const cash   = Math.floor(Number(formData['Cash Given (₹)'] || 0));
    const expAmt = Math.floor(Number(formData['Expense (₹)']    || 0));
    const bal    = cash - expAmt;

    return (
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
        <div className="modal-sheet">
          <div className="modal-handle"><div className="modal-handle-bar" /></div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-black text-gray-900">{formMode === 'edit' ? 'Edit Entry' : 'Add Entry'}</h3>
            <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-gray-900"><X size={18} strokeWidth={2} /></button>
          </div>
          <form onSubmit={handleSaveRow} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Employee Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold mb-2 text-gray-700">Employee Name <span className="text-gray-500">*</span></label>
                <input required type="text" list="employee-names" className="premium-input"
                  placeholder="Select or type name…"
                  value={formData['Employee Name'] || ''}
                  onChange={e => setFormData({ ...formData, 'Employee Name': e.target.value })} />
                <datalist id="employee-names">
                  {employeeSummary.filter(e => e.name && e.name !== 'Unassigned').map(e => <option key={e.name} value={e.name} />)}
                </datalist>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Date <span className="text-gray-500">*</span></label>
                <input required type="date" className="premium-input"
                  value={formData['Date'] || ''}
                  onChange={e => setFormData({ ...formData, 'Date': e.target.value })} />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Payment Mode</label>
                <select className="premium-input" value={formData['Payment Mode'] || 'Cash'}
                  onChange={e => setFormData({ ...formData, 'Payment Mode': e.target.value })}>
                  <option>Cash</option><option>UPI</option><option>Bank Transfer</option>
                </select>
              </div>

              {/* Project / Reference */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Project / Reference</label>
                <input type="text" className="premium-input" placeholder="e.g. Office Setup"
                  value={formData['Project / Reference'] || ''}
                  onChange={e => setFormData({ ...formData, 'Project / Reference': e.target.value })} />
              </div>

              {/* Client / Vendor */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Client / Vendor</label>
                <input type="text" className="premium-input" placeholder="e.g. Local Store"
                  value={formData['Client / Vendor'] || ''}
                  onChange={e => setFormData({ ...formData, 'Client / Vendor': e.target.value })} />
              </div>

              {/* Cash Given — integers only */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Cash Given (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">₹</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0"
                    className="premium-input !pl-6"
                    value={formData['Cash Given (₹)'] || ''}
                    onChange={handleInt('Cash Given (₹)')} />
                </div>
              </div>

              {/* Expense — integers only */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Expense (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">₹</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0"
                    className="premium-input !pl-6"
                    value={formData['Expense (₹)'] || ''}
                    onChange={handleInt('Expense (₹)')} />
                </div>
              </div>

              {/* Balance — auto-computed, shown read-only */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold mb-2 text-gray-700">Balance (auto-calculated)</label>
                <div className={`premium-input flex items-center gap-2 cursor-default select-none ${
                  bal >= 0 ? 'bg-gray-100 border-gray-200 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  <span className="font-black text-base">₹{Math.abs(bal).toLocaleString('en-IN')}</span>
                  <span className="text-xs font-semibold opacity-70">{bal >= 0 ? 'Surplus' : 'Deficit'}</span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Status</label>
                <select className="premium-input" value={formData['Status'] || 'Pending'}
                  onChange={e => setFormData({ ...formData, 'Status': e.target.value })}>
                  <option>Pending</option><option>Completed</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Notes</label>
                <input type="text" className="premium-input" placeholder="Optional notes…"
                  value={formData['Notes'] || ''}
                  onChange={e => setFormData({ ...formData, 'Notes': e.target.value })} />
              </div>

            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsEditing(false)} className="ghost-button flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="premium-button flex-1">{isSubmitting ? 'Saving…' : 'Save Entry'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ── Employee Detail View ── */
  if (selectedEmployee) {
    const employeeData = employeeSummary.find(e => e.name === selectedEmployee);
    let rows = employeeData ? [...employeeData.rows] : [];
    rows.sort((a, b) => parseDateObj(b.Date) - parseDateObj(a.Date));
    if (searchQuery) { const q = searchQuery.toLowerCase(); rows = rows.filter(r => (r['Project / Reference'] || '').toLowerCase().includes(q) || (r['Client / Vendor'] || '').toLowerCase().includes(q)); }
    if (selectedMonth !== 'All') {
      rows = rows.filter(r => {
        if (!r.Date) return false;
        try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return false; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth; }
        catch { return false; }
      });
    }
    const pieDataMap = {};
    rows.forEach(r => { const exp = Number(r['Expense (₹)'] || 0); if (exp > 0) { const k = r['Project / Reference'] || 'Other'; pieDataMap[k] = (pieDataMap[k] || 0) + exp; } });
    const pieData = Object.keys(pieDataMap).map(k => ({ name: k, value: pieDataMap[k] }));

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => { setSelectedEmployee(null); setSearchQuery(''); setSelectedMonth('All'); setIsEditing(false); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-semibold text-sm min-h-[42px]">
            <ArrowLeft size={18} strokeWidth={2} /> Back to Employees
          </button>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleExportPDF(rows, `${selectedEmployee}_Ledger`)} className="ghost-button text-sm">
              <Download size={14} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button onClick={() => openEditModal()} className="premium-button text-sm">
              <Plus size={14} strokeWidth={2.5} /> Add Entry
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">{selectedEmployee}</h2>
          <p className="text-sm text-gray-400 mt-0.5">Employee Ledger</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cash Given', value: employeeData?.totalGiven || 0, color: 'text-gray-900' },
            { label: 'Expense', value: employeeData?.totalExpense || 0, color: 'text-gray-600' },
            { label: 'Balance', value: employeeData?.balance || 0, color: (employeeData?.balance || 0) >= 0 ? 'text-gray-900' : 'text-gray-600', highlight: true },
          ].map(({ label, value, color, highlight }) => (
            <div key={label} className={cn('premium-card text-center py-4', highlight && 'border-2 border-gray-900')}>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={cn('text-base sm:text-xl font-black truncate', color)}>₹{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Pie */}
        {pieData.length > 0 && (
          <div className="premium-card">
            <h3 className="font-bold text-sm mb-4 text-gray-900">Expense Distribution</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2 h-[180px] sm:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="45%" outerRadius="68%" paddingAngle={4} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(val) => `₹${val.toLocaleString()}`} contentStyle={{ borderRadius: '12px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-2 max-h-32 overflow-y-auto no-scrollbar">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate max-w-[120px] text-gray-600">{entry.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">₹{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ledger */}
        <div className="premium-card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <h3 className="section-title">{selectedEmployee}'s Ledger</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
                <select className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none min-h-[42px]"
                  value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                  <option value="All">All Months</option>
                  {Array.from(new Set(employeeData?.rows.map(r => { if (!r.Date) return null; try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; } catch { return null; } }).filter(Boolean))).sort().reverse().map(m => (
                    <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
                <input type="text" placeholder="Search reference…" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none min-h-[42px]" />
              </div>
            </div>
          </div>
          <div className="p-4">
            <DataTable
              data={rows}
              columns={[
                { header: 'Date', render: (row) => {
                  if (!row.Date) return '—';
                  const d = parseDateObj(row.Date);
                  if (!d || isNaN(d.getTime())) return String(row.Date).split('T')[0];
                  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                }},
                { header: 'Reference', render: (row) => row['Project / Reference'] || '—' },
                { header: 'Vendor',    render: (row) => row['Client / Vendor']     || '—' },
                { header: 'Mode',      accessor: 'Payment Mode' },
                { header: 'Cash (₹)', render: (row) => `₹${Math.floor(Number(row['Cash Given (₹)'] || 0)).toLocaleString('en-IN')}` },
                { header: 'Exp (₹)',  render: (row) => `₹${Math.floor(Number(row['Expense (₹)']    || 0)).toLocaleString('en-IN')}` },
                { header: 'Status', render: (row) => (
                  <span className={cn('badge', row.Status === 'Completed' ? 'bg-gray-100 text-gray-900' : 'bg-gray-50 text-gray-600')}>
                    {row.Status || 'Pending'}
                  </span>
                )},
                { header: 'Actions', render: (row) => (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(row)} className="icon-btn text-gray-600 hover:bg-gray-100 w-8 h-8 min-w-0 min-h-0 rounded-lg"><Edit2 size={14} strokeWidth={2} /></button>
                    <button onClick={() => handleDeleteRow(row)} className="icon-btn text-gray-600 hover:bg-gray-100 w-8 h-8 min-w-0 min-h-0 rounded-lg"><Trash2 size={14} strokeWidth={2} /></button>
                  </div>
                )}
              ]}
            />
          </div>
        </div>
        {renderModal()}
      </div>
    );
  }

  /* ── Main List ── */
  const totalStaff = new Set(employeesData.map(e => (e['Employee Name']||'').trim().toLowerCase()).filter(Boolean)).size;
  const totalCash  = employeesData.reduce((s,r) => s + Math.floor(Number(r['Cash Given (₹)']||0)), 0);
  const totalExp   = employeesData.reduce((s,r) => s + Math.floor(Number(r['Expense (₹)']||0)), 0);
  const totalBal   = totalCash - totalExp;

  return (
    <>
      <div className="space-y-4 sm:space-y-5">

        {/* Header Controls */}
        <div className="controls-row">
          <div>
            <h2 className="section-title">Employees</h2>
            <p className="text-xs text-gray-400 mt-0.5">{totalStaff} staff · {employeesData.length} ledger entries</p>
          </div>
          <div className="controls-actions">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
              <select className="pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none min-h-[42px]"
                value={mainSelectedMonth} onChange={e => setMainSelectedMonth(e.target.value)}>
                <option value="All">All Months</option>
                {Array.from(new Set(employeesData.map(r => {
                  if (!r.Date) return null;
                  try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null;
                    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                  } catch { return null; }
                }).filter(Boolean))).sort().reverse().map(m => (
                  <option key={m} value={m}>{new Date(m+'-01').toLocaleDateString('default',{month:'short',year:'numeric'})}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 sm:flex-none sm:w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
              <input type="text" placeholder="Search employee…" value={mainSearchQuery}
                onChange={e => setMainSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none min-h-[42px]" />
            </div>
            <button onClick={() => handleExportPDF(employeeSummary, 'Employee_Summary')} className="ghost-button text-sm">
              <Download size={14}/><span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => openEditModal()} className="premium-button text-sm">
              <Plus size={14} strokeWidth={2.5}/> Add Entry
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Staff',   value: totalStaff,              color: 'text-gray-900'    },
            { label: 'Cash Given',    value: `₹${totalCash.toLocaleString('en-IN')}`, color: 'text-gray-700' },
            { label: 'Net Balance',   value: `₹${Math.abs(totalBal).toLocaleString('en-IN')}`, color: totalBal >= 0 ? 'text-gray-900' : 'text-gray-600' },
          ].map(({label, value, color}) => (
            <div key={label} className="premium-card text-center py-4">
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={cn('text-base sm:text-lg font-black truncate', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Bar Chart — only if data exists */}
        {graphData.length > 0 && (
          <div className="premium-card" style={{ height: 'clamp(200px, 28vw, 280px)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cash Given vs Expense per Employee</p>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={graphData} margin={{ top: 4, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <RTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }}
                  formatter={(v, n) => [`₹${Math.floor(v).toLocaleString('en-IN')}`, n]} />
                <Bar dataKey="Cash" name="Cash Given" fill="#e5e7eb" radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="Expense" name="Expense" fill="#111827" radius={[4,4,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Employee Cards */}
        {employeeSummary.length === 0 ? (
          <div className="premium-card py-16 text-center">
           
            <h3 className="text-base font-black text-gray-900 mb-1">No Employees Found</h3>
            <p className="text-sm text-gray-400 mb-5">
              {mainSearchQuery || mainSelectedMonth !== 'All'
                ? 'No results match your filter. Try clearing the search.'
                : 'Start by adding your first employee ledger entry.'}
            </p>
            {(!mainSearchQuery && mainSelectedMonth === 'All') && (
              <button onClick={() => openEditModal()} className="premium-button mx-auto">
                <Plus size={15} strokeWidth={2.5}/> Add First Entry
              </button>
            )}
            {(mainSearchQuery || mainSelectedMonth !== 'All') && (
              <button onClick={() => { setMainSearchQuery(''); setMainSelectedMonth('All'); }}
                className="ghost-button mx-auto">Clear Filters</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {employeeSummary.map((emp, i) => {
              const bal = emp.balance;
              const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
              const pct = emp.totalGiven > 0 ? Math.min(100, Math.round((emp.totalExpense / emp.totalGiven) * 100)) : 0;
              return (
                <div key={i}
                  onClick={() => setSelectedEmployee(emp.name)}
                  className="premium-card cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group">

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-[15px] text-gray-900 truncate">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.rows.length} ledger {emp.rows.length === 1 ? 'entry' : 'entries'}</p>
                    </div>
                    <ArrowLeft size={14} className="text-gray-300 group-hover:text-gray-900 rotate-180 transition-colors flex-shrink-0" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cash Given</p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">₹{Math.floor(emp.totalGiven).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Expense</p>
                      <p className="text-sm font-black text-gray-600 mt-0.5">₹{Math.floor(emp.totalExpense).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Spend bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
                      <span>Utilisation</span><span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: pct > 90 ? '#111827' : pct > 70 ? '#374151' : '#9ca3af' }} />
                    </div>
                  </div>

                  {/* Balance */}
                  <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold',
                    bal >= 0 ? 'bg-gray-100 text-gray-900' : 'bg-gray-50 text-gray-600')}>
                    <span>{bal >= 0 ? 'Surplus' : 'Deficit'}</span>
                    <span>₹{Math.abs(Math.floor(bal)).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
      {renderModal()}
    </>
  );
};
