import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from './DataTable';
import { cn } from '../utils/cn';
import { updateSheetData } from '../services/googleSheets';
import { ArrowLeft, Download, Plus, Trash2, Edit2, Search, Calendar, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const parseDateObj = (dateStr) => {
  if (!dateStr) return new Date(0);
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = String(dateStr).split(/[-/]/);
  if (parts.length === 3) {
    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

const formatLocalYMD = (dateObj) => {
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
};

const COLORS = ['#000000', '#4b5563', '#9ca3af', '#d1d5db', '#111827'];

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
        try {
          const d = parseDateObj(r.Date);
          if (isNaN(d.getTime())) return false;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === mainSelectedMonth;
        } catch { return false; }
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
      summaryMap[key].totalGiven += Number(row['Cash Given (₹)'] || 0);
      summaryMap[key].totalExpense += Number(row['Expense (₹)'] || 0);
      summaryMap[key].balance = summaryMap[key].totalGiven - summaryMap[key].totalExpense;
      summaryMap[key].rows.push(row);
    });
    return Object.values(summaryMap);
  }, [employeesData, mainSelectedMonth, mainSearchQuery]);

  const graphData = useMemo(() =>
    employeeSummary.map(emp => ({ name: emp.name, Cash: emp.totalGiven, Expense: emp.totalExpense })),
  [employeeSummary]);

  const handleExportPDF = (dataToExport, title) => {
    if (!dataToExport || dataToExport.length === 0) return toast.error('No data to export');
    const doc = new jsPDF();
    doc.text(`Report: ${title}`, 14, 15);
    const headers = Object.keys(dataToExport[0]).filter(k => k !== 'id' && k !== 'Src Row');
    const tableData = dataToExport.map(row => headers.map(h => {
      let val = row[h];
      if (h === 'Date' && val) return formatLocalYMD(parseDateObj(val));
      return val || '';
    }));
    autoTable(doc, { head: [headers], body: tableData, startY: 20, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [0, 0, 0] } });
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF Downloaded!');
  };

  const handleSaveRow = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const action = formMode;
    const dataToSave = { ...formData };
    Object.keys(formData).forEach(key => {
      dataToSave[key + '\n'] = formData[key];
      dataToSave[key + ' '] = formData[key];
    });
    if (action === 'add') {
      dataToSave['Src Row'] = Date.now().toString();
      if (!dataToSave['Balance After Row (₹)']) {
        dataToSave['Balance After Row (₹)'] = Number(dataToSave['Cash Given (₹)'] || 0) - Number(dataToSave['Expense (₹)'] || 0);
      }
    }
    const loadingToast = toast.loading('Saving…');
    try {
      const result = await updateSheetData(action, 'Employees', dataToSave);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(action === 'add' ? 'Entry added!' : 'Entry updated!', { id: loadingToast });
      setIsEditing(false);
      setFormData({});
      onDataChanged();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: loadingToast, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRow = (row) => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-center items-center p-1">
        <p className="font-bold text-sm">Delete this row?</p>
        <div className="flex gap-3 w-full">
          <button className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold" onClick={() => toast.dismiss(t.id)}>Cancel</button>
          <button className="flex-1 px-3 py-2 bg-black text-white rounded-xl text-xs font-bold" onClick={async () => {
            toast.dismiss(t.id);
            setIsSubmitting(true);
            const lt = toast.loading('Deleting…');
            try {
              const result = await updateSheetData('delete', 'Employees', row);
              if (result.status === 'error') throw new Error(result.message);
              toast.success('Deleted!', { id: lt });
              onDataChanged();
            } catch (err) {
              toast.error('Error deleting.', { id: lt });
            } finally { setIsSubmitting(false); }
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
      setFormData({
        'Date': formatLocalYMD(new Date()),
        'Employee Name': selectedEmployee || '',
        'Project / Reference': '',
        'Client / Vendor': '',
        'Payment Mode': 'Cash',
        'Cash Given (₹)': 0,
        'Expense (₹)': 0,
        'Balance After Row (₹)': 0,
        'Status': 'Pending',
        'Notes': ''
      });
    }
    setIsEditing(true);
  };

  /* ─── Modal (bottom sheet on mobile) ─── */
  function renderModal() {
    if (!isEditing) return null;
    return (
      <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsEditing(false); }}>
        <div className="modal-sheet">
          {/* Handle bar for mobile */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold">{formMode === 'edit' ? 'Edit Entry' : 'Add Entry'}</h3>
            <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-black hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSaveRow} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold mb-1.5">Employee Name</label>
                <input type="text" required list="employee-names" className="premium-input" value={formData['Employee Name'] || ''} onChange={e => setFormData({...formData, 'Employee Name': e.target.value})} />
                <datalist id="employee-names">
                  {employeeSummary.filter(e => e.name && e.name !== 'Unassigned').map(e => <option key={e.name} value={e.name} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Date</label>
                <input type="date" required className="premium-input" value={formData['Date'] || ''} onChange={e => setFormData({...formData, 'Date': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Payment Mode</label>
                <select className="premium-input" value={formData['Payment Mode'] || 'Cash'} onChange={e => setFormData({...formData, 'Payment Mode': e.target.value})}>
                  <option>Cash</option><option>UPI</option><option>Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Project / Reference</label>
                <input type="text" className="premium-input" value={formData['Project / Reference'] || ''} onChange={e => setFormData({...formData, 'Project / Reference': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Client / Vendor</label>
                <input type="text" className="premium-input" value={formData['Client / Vendor'] || ''} onChange={e => setFormData({...formData, 'Client / Vendor': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Cash Given (₹)</label>
                <input type="number" step="0.01" className="premium-input" value={formData['Cash Given (₹)'] || ''} onChange={e => setFormData({...formData, 'Cash Given (₹)': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Expense (₹)</label>
                <input type="number" step="0.01" className="premium-input" value={formData['Expense (₹)'] || ''} onChange={e => setFormData({...formData, 'Expense (₹)': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Balance After Row (₹)</label>
                <input type="number" step="0.01" className="premium-input" value={formData['Balance After Row (₹)'] || ''} onChange={e => setFormData({...formData, 'Balance After Row (₹)': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Status</label>
                <select className="premium-input" value={formData['Status'] || 'Pending'} onChange={e => setFormData({...formData, 'Status': e.target.value})}>
                  <option>Pending</option><option>Completed</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold mb-1.5">Notes</label>
                <input type="text" className="premium-input" value={formData['Notes'] || ''} onChange={e => setFormData({...formData, 'Notes': e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100 pb-2">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 premium-button">
                {isSubmitting ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ─── Employee Detail View ─── */
  if (selectedEmployee) {
    const employeeData = employeeSummary.find(e => e.name === selectedEmployee);
    let rows = employeeData ? [...employeeData.rows] : [];
    rows.sort((a, b) => parseDateObj(b.Date) - parseDateObj(a.Date));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => (r['Project / Reference'] || '').toLowerCase().includes(q) || (r['Client / Vendor'] || '').toLowerCase().includes(q));
    }
    if (selectedMonth !== 'All') {
      rows = rows.filter(r => {
        if (!r.Date) return false;
        try {
          const d = parseDateObj(r.Date);
          if (isNaN(d.getTime())) return false;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
        } catch { return false; }
      });
    }

    const pieDataMap = {};
    rows.forEach(r => {
      const exp = Number(r['Expense (₹)'] || 0);
      if (exp > 0) { const key = r['Project / Reference'] || 'Other'; pieDataMap[key] = (pieDataMap[key] || 0) + exp; }
    });
    const pieData = Object.keys(pieDataMap).map(k => ({ name: k, value: pieDataMap[k] }));

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => { setSelectedEmployee(null); setSearchQuery(''); setSelectedMonth('All'); setIsEditing(false); }}
            className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors font-medium text-sm min-h-[44px]"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleExportPDF(rows, `${selectedEmployee}_Ledger`)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors min-h-[44px]">
              <Download size={15} /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button onClick={() => openEditModal()} className="premium-button text-sm">
              <Plus size={15} /> Add Entry
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="premium-card text-center py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cash Given</p>
            <p className="text-lg sm:text-xl font-bold truncate">₹{(employeeData?.totalGiven || 0).toLocaleString()}</p>
          </div>
          <div className="premium-card text-center py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expense</p>
            <p className="text-lg sm:text-xl font-bold truncate">₹{(employeeData?.totalExpense || 0).toLocaleString()}</p>
          </div>
          <div className="premium-card text-center py-4 border-2 border-black">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Balance</p>
            <p className={cn('text-lg sm:text-xl font-bold truncate', (employeeData?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
              ₹{(employeeData?.balance || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="premium-card">
            <h3 className="font-bold text-sm mb-4">Expense Distribution</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val) => `₹${val.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-2 max-h-32 overflow-y-auto">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="font-bold">₹{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ledger table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <h3 className="text-base font-bold">{selectedEmployee}'s Ledger</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <select className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                  <option value="All">All Months</option>
                  {Array.from(new Set(employeeData?.rows.map(r => { if (!r.Date) return null; try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; } catch { return null; } }).filter(Boolean))).sort().reverse().map(m => (
                    <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input type="text" placeholder="Search reference…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black" />
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
                  <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold uppercase', row.Status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600')}>{row.Status}</span>
                )},
                { header: 'Actions', render: (row) => (
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(row)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Edit"><Edit2 size={15} /></button>
                    <button onClick={() => handleDeleteRow(row)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={15} /></button>
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

  /* ─── Main Employee List ─── */
  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold">Employee Analytics</h3>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select className="pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none min-h-[44px]" value={mainSelectedMonth} onChange={e => setMainSelectedMonth(e.target.value)}>
                <option value="All">All Months</option>
                {Array.from(new Set(employeesData.map(r => { if (!r.Date) return null; try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; } catch { return null; } }).filter(Boolean))).sort().reverse().map(m => (
                  <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 sm:flex-none sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="text" placeholder="Search employee…" value={mainSearchQuery} onChange={e => setMainSearchQuery(e.target.value)} className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black min-h-[44px]" />
            </div>
            <button onClick={() => handleExportPDF(employeeSummary, 'Employee_Summary')} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors min-h-[44px]">
              <Download size={15} /> <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => openEditModal()} className="premium-button text-sm">
              <Plus size={15} /> Add Entry
            </button>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="premium-card h-[250px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graphData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <RechartsTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} />
              <Bar dataKey="Cash" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill="#000000" radius={[4, 4, 0, 0]} />
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
              <span className={row.balance >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                ₹{row.balance.toLocaleString()}
              </span>
            )},
            { header: 'Actions', render: (row) => (
              <button onClick={() => setSelectedEmployee(row.name)} className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors min-h-[36px]">
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
