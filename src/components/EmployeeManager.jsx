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
    doc.text(`Report: ${title}`, 14, 15);
    const headers = Object.keys(dataToExport[0]).filter(k => k !== 'id' && k !== 'Src Row');
    autoTable(doc, {
      head: [headers],
      body: dataToExport.map(row => headers.map(h => { let v = row[h]; if (h === 'Date' && v) return formatLocalYMD(parseDateObj(v)); return v || ''; })),
      startY: 20, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [17, 24, 39] }
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
      if (!dataToSave['Balance After Row (₹)'])
        dataToSave['Balance After Row (₹)'] = Number(dataToSave['Cash Given (₹)'] || 0) - Number(dataToSave['Expense (₹)'] || 0);
    }
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
      setFormData(editData);
    } else {
      setFormMode('add');
      setFormData({ 'Date': formatLocalYMD(new Date()), 'Employee Name': selectedEmployee || '', 'Project / Reference': '', 'Client / Vendor': '', 'Payment Mode': 'Cash', 'Cash Given (₹)': 0, 'Expense (₹)': 0, 'Balance After Row (₹)': 0, 'Status': 'Pending', 'Notes': '' });
    }
    setIsEditing(true);
  };

  /* ── Modal ── */
  const renderModal = () => {
    if (!isEditing) return null;
    const field = (label, key, type = 'text', opts = {}) => (
      <div className={opts.span2 ? 'sm:col-span-2' : ''}>
        <label className="block text-sm font-bold mb-2 text-gray-700">{label}</label>
        {opts.select ? (
          <select className="premium-input" value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })}>
            {opts.options.map(o => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} step={type === 'number' ? '0.01' : undefined} className="premium-input"
            value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })}
            {...(opts.list ? { list: opts.list } : {})} />
        )}
        {opts.datalist && (
          <datalist id={opts.list}>
            {employeeSummary.filter(e => e.name && e.name !== 'Unassigned').map(e => <option key={e.name} value={e.name} />)}
          </datalist>
        )}
      </div>
    );
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
              {field('Employee Name', 'Employee Name', 'text', { span2: true, list: 'employee-names', datalist: true })}
              {field('Date', 'Date', 'date')}
              {field('Payment Mode', 'Payment Mode', 'text', { select: true, options: ['Cash', 'UPI', 'Bank Transfer'] })}
              {field('Project / Reference', 'Project / Reference')}
              {field('Client / Vendor', 'Client / Vendor')}
              {field('Cash Given (₹)', 'Cash Given (₹)', 'number')}
              {field('Expense (₹)', 'Expense (₹)', 'number')}
              {field('Balance After Row (₹)', 'Balance After Row (₹)', 'number')}
              {field('Status', 'Status', 'text', { select: true, options: ['Pending', 'Completed'] })}
              {field('Notes', 'Notes', 'text', { span2: true })}
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
            { label: 'Expense', value: employeeData?.totalExpense || 0, color: 'text-red-600' },
            { label: 'Balance', value: employeeData?.balance || 0, color: (employeeData?.balance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600', highlight: true },
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
                { header: 'Date', render: (row) => row.Date ? formatLocalYMD(parseDateObj(row.Date)) || row.Date : '' },
                { header: 'Reference', accessor: 'Project / Reference' },
                { header: 'Vendor', accessor: 'Client / Vendor' },
                { header: 'Mode', accessor: 'Payment Mode' },
                { header: 'Cash (₹)', render: (row) => `₹${Number(row['Cash Given (₹)'] || 0).toLocaleString()}` },
                { header: 'Exp (₹)', render: (row) => `₹${Number(row['Expense (₹)'] || 0).toLocaleString()}` },
                { header: 'Status', render: (row) => (
                  <span className={cn('badge', row.Status === 'Completed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                    {row.Status}
                  </span>
                )},
                { header: 'Actions', render: (row) => (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(row)} className="icon-btn text-blue-500 hover:bg-blue-50 w-8 h-8 min-w-0 min-h-0 rounded-lg"><Edit2 size={14} strokeWidth={2} /></button>
                    <button onClick={() => handleDeleteRow(row)} className="icon-btn text-red-500 hover:bg-red-50 w-8 h-8 min-w-0 min-h-0 rounded-lg"><Trash2 size={14} strokeWidth={2} /></button>
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
  return (
    <>
      <div className="space-y-4 sm:space-y-5">
        {/* Controls */}
        <div className="controls-row">
          <h2 className="section-title">Employee Analytics</h2>
          <div className="controls-actions">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
              <select className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none min-h-[42px]"
                value={mainSelectedMonth} onChange={e => setMainSelectedMonth(e.target.value)}>
                <option value="All">All Months</option>
                {Array.from(new Set(employeesData.map(r => { if (!r.Date) return null; try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; } catch { return null; } }).filter(Boolean))).sort().reverse().map(m => (
                  <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 sm:flex-none sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
              <input type="text" placeholder="Search employee…" value={mainSearchQuery}
                onChange={e => setMainSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none min-h-[42px]" />
            </div>
            <button onClick={() => handleExportPDF(employeeSummary, 'Employee_Summary')} className="ghost-button text-sm">
              <Download size={14} /><span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => openEditModal()} className="premium-button text-sm">
              <Plus size={14} strokeWidth={2.5} /> Add Entry
            </button>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="premium-card" style={{ height: 'clamp(220px, 30vw, 300px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graphData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <RTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgb(0 0 0/0.1)', fontSize: 12 }} />
              <Bar dataKey="Cash" fill="#e5e7eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Expense" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Table */}
        <DataTable
          title="All Employees Summary"
          data={employeeSummary}
          columns={[
            { header: 'Employee', accessor: 'name' },
            { header: 'Cash (₹)', render: (row) => `₹${row.totalGiven.toLocaleString()}` },
            { header: 'Expense (₹)', render: (row) => `₹${row.totalExpense.toLocaleString()}` },
            { header: 'Balance (₹)', render: (row) => (
              <span className={cn('font-bold', row.balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                ₹{row.balance.toLocaleString()}
              </span>
            )},
            { header: 'Actions', render: (row) => (
              <button onClick={() => setSelectedEmployee(row.name)}
                className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-700 transition-colors min-h-[34px]">
                View
              </button>
            )}
          ]}
        />
      </div>
      {renderModal()}
    </>
  );
};
