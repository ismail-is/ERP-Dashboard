import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from './DataTable';
import { cn } from '../utils/cn';
import { updateSheetData } from '../services/googleSheets';
import { ArrowLeft, Download, Plus, Trash2, Edit2, Search, Calendar } from 'lucide-react';
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
    // assume DD, MM, YYYY
    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

const formatLocalYMD = (dateObj) => {
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
};

export const EmployeeManager = ({ employeesData, onDataChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmployee = searchParams.get('employee');

  const setSelectedEmployee = (name) => {
    if (name) {
      searchParams.set('employee', name);
      setSearchParams(searchParams);
    } else {
      searchParams.delete('employee');
      setSearchParams(searchParams);
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [mainSelectedMonth, setMainSelectedMonth] = useState('All');

  // --- Aggregate Data for Main View ---
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
      filteredData = filteredData.filter(r => 
        (r['Employee Name'] || '').toLowerCase().includes(q)
      );
    }

    const summaryMap = {};
    filteredData.forEach(row => {
      const rawName = row['Employee Name']?.trim() ? row['Employee Name'].trim() : 'Unassigned';
      // Case insensitive grouping
      const normalizedKey = rawName.toLowerCase();
      
      if (!summaryMap[normalizedKey]) {
        summaryMap[normalizedKey] = { name: rawName, totalGiven: 0, totalExpense: 0, balance: 0, rows: [] };
      }
      summaryMap[normalizedKey].totalGiven += Number(row['Cash Given (₹)'] || 0);
      summaryMap[normalizedKey].totalExpense += Number(row['Expense (₹)'] || 0);
      summaryMap[normalizedKey].balance = summaryMap[normalizedKey].totalGiven - summaryMap[normalizedKey].totalExpense;
      summaryMap[normalizedKey].rows.push(row);
    });
    return Object.values(summaryMap);
  }, [employeesData, mainSelectedMonth, mainSearchQuery]);

  // --- Graph Data ---
  const graphData = useMemo(() => {
    return employeeSummary.map(emp => ({
      name: emp.name,
      Cash: emp.totalGiven,
      Expense: emp.totalExpense
    }));
  }, [employeeSummary]);

  const COLORS = ['#000000', '#4b5563', '#9ca3af', '#d1d5db', '#111827'];

  const handleExportPDF = (dataToExport, title) => {
    if (!dataToExport || dataToExport.length === 0) return toast.error('No data to export');
    
    const doc = new jsPDF();
    doc.text(`Report: ${title}`, 14, 15);
    
    // AutoTable needs an array of arrays
    const headers = Object.keys(dataToExport[0]).filter(k => k !== 'id' && k !== 'Src Row');
    const tableData = dataToExport.map(row => headers.map(h => {
      let val = row[h];
      if (h === 'Date' && val) return formatLocalYMD(parseDateObj(val));
      return val || '';
    }));

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 0] }
    });

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF Downloaded!');
  };

  const handleSaveRow = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const action = formMode;
    
    const dataToSave = { ...formData };
    
    // BULLETPROOF BACKWARD COMPATIBILITY
    // If the user forgot to update their Apps Script, the backend still has "dirty" headers (with \n or spaces).
    // By duplicating the keys with trailing spaces and newlines, we guarantee the old backend will find the data!
    Object.keys(formData).forEach(key => {
      dataToSave[key + '\n'] = formData[key];
      dataToSave[key + ' '] = formData[key];
      dataToSave[key + '\r'] = formData[key];
    });

    if (action === 'add') {
      dataToSave['Src Row'] = Date.now().toString(); 
      // Auto calculate balance for this row if not provided
      if (!dataToSave['Balance After Row (₹)']) {
         dataToSave['Balance After Row (₹)'] = Number(dataToSave['Cash Given (₹)'] || 0) - Number(dataToSave['Expense (₹)'] || 0);
      }
    }
    
    const loadingToast = toast.loading('Saving transaction...');
    try {
      const result = await updateSheetData(action, 'Employees', dataToSave);
      if (result.status === 'error') throw new Error(result.message);
      toast.success(action === 'add' ? 'Entry added successfully!' : 'Entry updated successfully!', { id: loadingToast });
      setIsEditing(false);
      setFormData({});
      onDataChanged(); 
    } catch (err) {
      toast.error('Error saving: ' + err.message, { id: loadingToast, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRow = (row) => {
    toast((t) => (
      <div className="flex flex-col gap-4 text-center items-center justify-center p-2">
        <p className="font-bold text-sm text-black">Are you sure you want to delete this row?</p>
        <div className="flex justify-center gap-3 w-full">
          <button 
            className="flex-1 px-4 py-2 border-2 border-black bg-white text-black hover:bg-gray-50 rounded-xl text-xs font-bold transition-colors" 
            onClick={() => toast.dismiss(t.id)}
          >Cancel</button>
          <button 
            className="flex-1 px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors" 
            onClick={async () => {
              toast.dismiss(t.id);
              setIsSubmitting(true);
              const loadingToast = toast.loading('Deleting...');
              try {
                const result = await updateSheetData('delete', 'Employees', row);
                if (result.status === 'error') throw new Error(result.message);
                toast.success('Row deleted successfully!', { id: loadingToast });
                onDataChanged();
              } catch (err) {
                toast.error('Error deleting data.', { id: loadingToast });
              } finally {
                setIsSubmitting(false);
              }
            }}
          >Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const openEditModal = (row = null) => {
    try {
      if (row) {
        setFormMode('edit');
        const editData = { ...row };
        if (editData.Date) {
          editData.Date = formatLocalYMD(parseDateObj(editData.Date));
        }
        setFormData(editData);
      } else {
        setFormMode('add');
        // Setup empty form with current date
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
    } catch (err) {
      toast.error('Error opening form: ' + err.message);
    }
  };

  if (selectedEmployee) {
    const employeeData = employeeSummary.find(e => e.name === selectedEmployee);
    let rows = employeeData ? employeeData.rows : [];
    
    // Sort by Date Descending (newest first)
    rows.sort((a, b) => parseDateObj(b.Date) - parseDateObj(a.Date));

    // Filter rows by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => 
        (r['Project / Reference'] || '').toLowerCase().includes(q) ||
        (r['Client / Vendor'] || '').toLowerCase().includes(q)
      );
    }

    // Filter by Month
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

    // Pie Chart Data (Expenses distribution by Reference/Project)
    const pieDataMap = {};
    rows.forEach(r => {
      const exp = Number(r['Expense (₹)'] || 0);
      if (exp > 0) {
        const key = r['Project / Reference'] || 'Other';
        pieDataMap[key] = (pieDataMap[key] || 0) + exp;
      }
    });
    const pieData = Object.keys(pieDataMap).map(k => ({ name: k, value: pieDataMap[k] }));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { setSelectedEmployee(null); setSearchQuery(''); setSelectedMonth('All'); setIsEditing(false); }} className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors">
            <ArrowLeft size={20} /> Back to All Employees
          </button>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => handleExportPDF(rows, `${selectedEmployee}_Ledger`)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
              <Download size={16} /> Export PDF
            </button>
            <button onClick={() => openEditModal()} className="flex items-center gap-2 premium-button py-2 text-sm">
              <Plus size={16} /> Add Entry
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="premium-card">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Total Cash Given</p>
            <h3 className="text-2xl font-bold">₹{(employeeData?.totalGiven || 0).toLocaleString()}</h3>
          </div>
          <div className="premium-card">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Total Expense</p>
            <h3 className="text-2xl font-bold">₹{(employeeData?.totalExpense || 0).toLocaleString()}</h3>
          </div>
          <div className="premium-card border-2 border-black">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Net Balance</p>
            <h3 className="text-2xl font-bold">₹{(employeeData?.balance || 0).toLocaleString()}</h3>
          </div>
        </div>
        
        {pieData.length > 0 && (
          <div className="premium-card min-h-[250px] flex flex-col md:flex-row items-center py-6">
            <div className="w-full md:w-1/3 text-center px-4 mb-6 md:mb-0">
              <h3 className="font-bold text-lg">Expense Distribution</h3>
              <p className="text-sm text-gray-500 mb-4">By Project/Reference</p>
              <div className="text-left space-y-2 max-h-32 overflow-y-auto">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="truncate max-w-[100px]">{entry.name}</span>
                    </div>
                    <span className="font-bold">₹{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-2/3 h-[250px] md:h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(val) => `₹${val.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Ledger Table with Search and Month Filter */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold">{selectedEmployee}'s Ledger</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select 
                  className="w-full sm:w-auto pl-9 pr-8 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                >
                  <option value="All">All Months</option>
                  {Array.from(new Set(employeeData?.rows.map(r => {
                    if(!r.Date) return null;
                    try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; } catch { return null; }
                  }).filter(Boolean))).sort().reverse().map(m => (
                    <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search Reference/Vendor..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>
          <DataTable 
            data={rows}
          columns={[
            { header: 'Date', render: (row) => {
              if (!row.Date) return '';
              return formatLocalYMD(parseDateObj(row.Date)) || row.Date;
            }},
            { header: 'Reference', accessor: 'Project / Reference' },
            { header: 'Vendor/Client', accessor: 'Client / Vendor' },
            { header: 'Mode', accessor: 'Payment Mode' },
            { header: 'Cash (₹)', render: (row) => `₹${Number(row['Cash Given (₹)'] || 0).toLocaleString()}` },
            { header: 'Exp (₹)', render: (row) => `₹${Number(row['Expense (₹)'] || 0).toLocaleString()}` },
            { header: 'Status', render: (row) => (
              <span className={cn(
                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                row.Status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
              )}>{row.Status}</span>
            )},
            { header: 'Actions', render: (row) => (
              <div className="flex items-center gap-3">
                <button onClick={() => openEditModal(row)} className="text-blue-500 hover:text-blue-700 transition-colors" title="Edit"><Edit2 size={16}/></button>
                <button onClick={() => handleDeleteRow(row)} className="text-red-500 hover:text-red-700 transition-colors" title="Delete"><Trash2 size={16}/></button>
              </div>
            )}
          ]}
        />
        </div>
        {renderModal()}
      </div>
    );
  }

  function renderModal() {
    if (!isEditing) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <h3 className="text-xl font-bold mb-4 sm:mb-6">{formMode === 'edit' ? 'Edit Entry' : 'Add Entry'}</h3>
          <form onSubmit={handleSaveRow} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Employee Name</label>
                <input type="text" required list="employee-names" className="premium-input" value={formData['Employee Name'] || ''} onChange={e => setFormData({...formData, 'Employee Name': e.target.value})} />
                <datalist id="employee-names">
                  {employeeSummary.filter(emp => emp.name && emp.name !== 'Unassigned').map(emp => (
                    <option key={emp.name} value={emp.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" required className="premium-input" value={formData['Date'] || ''} onChange={e => setFormData({...formData, 'Date': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Mode</label>
                <select className="premium-input" value={formData['Payment Mode'] || 'Cash'} onChange={e => setFormData({...formData, 'Payment Mode': e.target.value})}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Project / Reference</label>
                <input type="text" className="premium-input" value={formData['Project / Reference'] || ''} onChange={e => setFormData({...formData, 'Project / Reference': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client / Vendor</label>
                <input type="text" className="premium-input" value={formData['Client / Vendor'] || ''} onChange={e => setFormData({...formData, 'Client / Vendor': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cash Given (₹)</label>
                <input type="number" step="0.01" className="premium-input" value={formData['Cash Given (₹)'] || ''} onChange={e => setFormData({...formData, 'Cash Given (₹)': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expense (₹)</label>
                <input type="number" step="0.01" className="premium-input" value={formData['Expense (₹)'] || ''} onChange={e => setFormData({...formData, 'Expense (₹)': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Balance After Row (₹)</label>
                <input type="number" step="0.01" className="premium-input" value={formData['Balance After Row (₹)'] || ''} onChange={e => setFormData({...formData, 'Balance After Row (₹)': e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="premium-input" value={formData['Status'] || 'Pending'} onChange={e => setFormData({...formData, 'Status': e.target.value})}>
                  <option>Pending</option>
                  <option>Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input type="text" className="premium-input" value={formData['Notes'] || ''} onChange={e => setFormData({...formData, 'Notes': e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 text-gray-500 hover:text-black font-medium transition-colors">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="premium-button">
                {isSubmitting ? 'Saving...' : 'Save Row'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Employee List View ---
  return (
    <>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-bold">Employee Analytics</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black appearance-none"
              value={mainSelectedMonth}
              onChange={e => setMainSelectedMonth(e.target.value)}
            >
              <option value="All">All Months</option>
              {Array.from(new Set(employeesData.map(r => {
                if(!r.Date) return null;
                try { const d = parseDateObj(r.Date); if (isNaN(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; } catch { return null; }
              }).filter(Boolean))).sort().reverse().map(m => (
                <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</option>
              ))}
            </select>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search Employee..." 
              value={mainSearchQuery}
              onChange={e => setMainSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black"
            />
          </div>
          <button onClick={() => handleExportPDF(employeeSummary, 'Employee_Summary')} className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
            <Download size={16} /> Export PDF
          </button>
          <button onClick={() => openEditModal()} className="w-full sm:w-auto flex justify-center items-center gap-2 premium-button py-2 text-sm">
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      {/* Graph Area */}
      <div className="premium-card h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="Cash" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expense" fill="#000000" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable 
        title="All Employees Summary"
        data={employeeSummary}
        columns={[
          { header: 'Employee Name', accessor: 'name' },
          { header: 'Total Cash Given (₹)', render: (row) => `₹${row.totalGiven.toLocaleString()}` },
          { header: 'Total Expense (₹)', render: (row) => `₹${row.totalExpense.toLocaleString()}` },
          { header: 'Net Balance (₹)', render: (row) => (
            <span className={row.balance >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
              ₹{row.balance.toLocaleString()}
            </span>
          )},
          { header: 'Actions', render: (row) => (
            <button 
              onClick={() => setSelectedEmployee(row.name)} 
              className="text-black font-medium underline text-sm hover:text-gray-600"
            >
              View Ledger
            </button>
          )}
        ]}
      />
      </div>

      {renderModal()}
    </>
  );
};
