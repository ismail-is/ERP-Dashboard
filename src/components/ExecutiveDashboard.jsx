import React, { useState, useMemo } from 'react';
import { cn } from '../utils/cn';
import { Search, Download, Plus, Edit2, Trash2, Calendar, IndianRupee, Tag, Filter, CheckCircle2, Clock, XCircle, ArrowRight, Activity, Users, Briefcase, Receipt, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateSheetData } from '../services/googleSheets';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = [2025, 2026, 2027, 2028];

const INCOME_CATEGORIES = ["Investment","Live Streaming","Wedding","Rentals","Events","Social Media","Printing"];
const EXPENSE_CATEGORIES = ["Salary","Food","Transportation","Rental","Telecom","Electricity","Work Equipment","Sub Leasing","Repair & Maintenance","Security Deposits","Assets","Profit Share","Misc","Online Subscriptions"];
const PAYMENT_MODES = ["Cash","Bank Transfer","UPI","Cheque","Card","Online","Other"];
const STAFF_LIST = ["Shafeeq","Aqthar","Razan","Irshad","Zaheer","Raazim","Basheer","Munavvar","Accountant","Haris","nisar"];

const parseAmt = (v) => Math.floor(Number(v) || 0);
const fmt      = (v) => `₹${parseAmt(v).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toISOString().split('T')[0];

export const ExecutiveDashboard = ({ data = {}, onDataChanged }) => {
  const [selMonth, setSelMonth] = useState('Jan');
  const [selYear, setSelYear] = useState('2026');
  const [searchQuery, setSearchQuery] = useState('');
  
  const eventsData = data.events || [];

  // Use data from clients if available, otherwise use sample data
  const clientsData = data.clients && data.clients.length > 0 ? data.clients : [
    { name: "Bedra Media", amount: 85000, outstanding: 0, status: "Closed" },
    { name: "Wedding Clients", amount: 42000, outstanding: 12000, status: "Pending" },
    { name: "Salam TV", amount: 0, outstanding: 0, status: "No activity" },
    { name: "Samudhaya TV", amount: 0, outstanding: 0, status: "No activity" },
    { name: "SR Enterprises", amount: 0, outstanding: 0, status: "No activity" },
  ];

  // Use data from ledger if available, otherwise use sample data
  const ledgerData = data.ledger && data.ledger.length > 0 ? data.ledger : [
    { id: 1, date: "2026-01-05", type: "Income", category: "Live Streaming", subcategory: "Live with LED", clientVendor: "Bedra Media", projectReference: "Republic Day Live", paymentMode: "Bank Transfer", invoiceNo: "INV-2601-001", debit: 0, credit: 85000, status: "Paid", dueDate: "2026-01-20", notes: "Sample income", executive: "Shafeeq", executiveExpense: 0, cashGiven: 0, executiveBalance: 0 },
    { id: 2, date: "2026-01-08", type: "Income", category: "Wedding", subcategory: "Wedding Full", clientVendor: "Wedding Clients", projectReference: "Aisha Wedding", paymentMode: "Cash", invoiceNo: "INV-2601-002", debit: 0, credit: 42000, status: "Partial", dueDate: "2026-01-25", notes: "Sample partial collection", executive: "Shafeeq", executiveExpense: 0, cashGiven: 0, executiveBalance: 0 },
    { id: 3, date: "2026-01-09", type: "Expense", category: "Salary", subcategory: "Shafeeq", clientVendor: "Shafeeq", projectReference: "January salary", paymentMode: "Bank Transfer", invoiceNo: "", debit: 18000, credit: 0, status: "Paid", dueDate: "2026-01-09", notes: "Sample salary expense", executive: "Shafeeq", executiveExpense: 18000, cashGiven: 0, executiveBalance: -18000 },
    { id: 4, date: "2026-01-10", type: "Expense", category: "Transportation", subcategory: "Wagon R", clientVendor: "Fuel Vendor", projectReference: "Client location travel", paymentMode: "Cash", invoiceNo: "", debit: 4500, credit: 0, status: "Paid", dueDate: "2026-01-10", notes: "Sample travel expense", executive: "Shafeeq", executiveExpense: 0, cashGiven: 0, executiveBalance: 0 },
  ];

  // Filter ledger data based on selected month and year
  const filteredLedger = useMemo(() => {
    return ledgerData.filter(r => {
      const d = new Date(r.date);
      if (isNaN(d.getTime())) return false;
      const m = MONTHS[d.getMonth()];
      const y = String(d.getFullYear());
      return m === selMonth && y === selYear;
    });
  }, [ledgerData, selMonth, selYear]);

  // Calculate KPIs
  const kpi = useMemo(() => {
    const totalIncome = filteredLedger.filter(r => r.type === 'Income').reduce((s, r) => s + parseAmt(r.credit), 0);
    const totalExpense = filteredLedger.filter(r => r.type === 'Expense').reduce((s, r) => s + parseAmt(r.debit), 0);
    const netProfit = totalIncome - totalExpense;
    
    // Mock outstanding for now based on clients or hardcoded for sample
    const outstanding = 12000; 
    const collectionRate = totalIncome > 0 ? ((totalIncome / (totalIncome + outstanding)) * 100).toFixed(1) : "0.0";
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : "0.0";

    return { 
      totalIncome, 
      totalExpense, 
      netProfit, 
      outstanding,
      collectionRate,
      profitMargin
    };
  }, [filteredLedger]);

  // Enriched ledger with running balance
  const enrichedLedger = useMemo(() => {
    let bal = 0;
    return filteredLedger.map(r => {
      const net = parseAmt(r.credit) - parseAmt(r.debit);
      bal += net;
      return { ...r, runningBalance: bal, net };
    });
  }, [filteredLedger]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">EXECUTIVE FINANCE DASHBOARD</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">This file is for one selected month only. Change Month and Year above.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
              className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none">
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="relative">
            <select value={selYear} onChange={e => setSelYear(e.target.value)}
              className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none appearance-none">
              {YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button className="premium-button text-sm flex items-center gap-1">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* KPI Grid Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Total Income" value={fmt(kpi.totalIncome)} color="text-green-600" bg="bg-green-50" />
        <KpiCard icon={TrendingDown} label="Total Expense" value={fmt(kpi.totalExpense)} color="text-red-600" bg="bg-red-50" />
        <KpiCard icon={Tag} label="Net Profit" value={fmt(kpi.netProfit)} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard icon={Clock} label="Outstanding" value={fmt(kpi.outstanding)} color="text-yellow-600" bg="bg-yellow-50" />
      </div>

      {/* KPI Grid Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Collection Rate" value={`${kpi.collectionRate}%`} color="text-teal-600" bg="bg-teal-50" />
        <KpiCard icon={IndianRupee} label="Running Balance" value="-" color="text-gray-600" bg="bg-gray-50" />
        <KpiCard icon={Briefcase} label="Assets Value" value="-" color="text-gray-600" bg="bg-gray-50" />
        <KpiCard icon={Receipt} label="Profit Margin" value={`${kpi.profitMargin}%`} color="text-indigo-600" bg="bg-indigo-50" />
      </div>

      {/* Daily Journal Section */}
      <div className="premium-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-sm font-black text-gray-900">DAILY JOURNAL</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
              <input type="text" placeholder="Search journal..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-gray-900 outline-none w-40 sm:w-56" />
            </div>
            <button className="ghost-button text-xs py-1.5 h-auto">
              <Plus size={12} /> Add Entry
            </button>
          </div>
        </div>

        <div className="table-scroll-container" style={{ maxHeight: '400px' }}>
          <table className="data-table text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                {[
                  'Entry ID', 'Date', 'Month # / Year', 'Type', 'Category', 'Subcategory', 
                  'Client / Vendor', 'Project / Reference', 'Payment Mode', 'Invoice No', 
                  'Debit (₹)', 'Credit (₹)', 'Net (₹)', 'Running Balance (₹)', 'Status', 
                  'Due Date', 'Notes', 'Executive / Staff', 'Executive Expense (₹)', 
                  'Cash Given (₹)', 'Executive Balance (₹)'
                ].map(h => (
                  <th key={h} className="whitespace-nowrap py-2 px-3 text-left font-bold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedLedger.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-10 text-center text-gray-400 font-medium">
                    No data available for {selMonth} {selYear}
                  </td>
                </tr>
              ) : (
                enrichedLedger.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <td className="py-2 px-3 text-gray-400 font-mono">{row.id || i + 1}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{row.date}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{selMonth} / {selYear}</td>
                    <td className="py-2 px-3">
                      <span className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold',
                        row.type === 'Income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      )}>
                        {row.type || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-gray-900">{row.category || '—'}</td>
                    <td className="py-2 px-3 text-gray-600">{row.subcategory || '—'}</td>
                    <td className="py-2 px-3 text-gray-600">{row.clientVendor || '—'}</td>
                    <td className="py-2 px-3 text-gray-600">{row.projectReference || '—'}</td>
                    <td className="py-2 px-3 text-gray-500">{row.paymentMode || '—'}</td>
                    <td className="py-2 px-3 text-gray-500 font-mono">{row.invoiceNo || '—'}</td>
                    <td className="py-2 px-3 font-bold text-red-600 text-right">{row.debit ? fmt(row.debit) : '—'}</td>
                    <td className="py-2 px-3 font-bold text-green-600 text-right">{row.credit ? fmt(row.credit) : '—'}</td>
                    <td className="py-2 px-3 font-bold text-gray-900 text-right">{fmt(row.net)}</td>
                    <td className="py-2 px-3 font-bold text-gray-900 text-right">{fmt(row.runningBalance)}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        {row.status === 'Paid' || row.status === 'Completed' ? <CheckCircle2 size={12} className="text-green-500" /> : <Clock size={12} className="text-yellow-500" />}
                        <span className="text-[11px] font-medium text-gray-700">{row.status || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">{row.dueDate || '—'}</td>
                    <td className="py-2 px-3 text-gray-500 max-w-[150px] truncate" title={row.notes}>{row.notes || '—'}</td>
                    <td className="py-2 px-3 text-gray-600">{row.executive || '—'}</td>
                    <td className="py-2 px-3 font-bold text-red-600 text-right">{row.executiveExpense ? fmt(row.executiveExpense) : '—'}</td>
                    <td className="py-2 px-3 font-bold text-green-600 text-right">{row.cashGiven ? fmt(row.cashGiven) : '—'}</td>
                    <td className="py-2 px-3 font-bold text-gray-900 text-right">{row.executiveBalance ? fmt(row.executiveBalance) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Statement & Event Tracker Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client Statement */}
        <div className="premium-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900">CLIENT STATEMENT</h2>
            <button className="ghost-button text-xs py-1.5 h-auto">View All</button>
          </div>
          <div className="table-scroll-container">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  {['Client', 'Revenue (₹)', 'Open Invoices (₹)', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-bold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientsData.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400">No client data</td></tr>
                ) : (
                  clientsData.slice(0, 5).map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-3 font-bold text-gray-900">{c.name || '—'}</td>
                      <td className="py-2 px-3 font-bold text-green-600">{c.amount ? fmt(c.amount) : '—'}</td>
                      <td className="py-2 px-3 font-bold text-red-600">{c.outstanding ? fmt(c.outstanding) : '—'}</td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          'badge text-[10px] px-1.5 py-0.5 rounded font-bold',
                          c.status === 'Closed' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-50 text-yellow-700'
                        )}>
                          {c.status || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Event Tracker */}
        <div className="premium-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900">MONTHLY EVENT TRACKER</h2>
            <button className="ghost-button text-xs py-1.5 h-auto">View All</button>
          </div>
          <div className="table-scroll-container">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  {['Date', 'Event/Project Name', 'Client', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-bold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventsData.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400">No events recorded for this month</td></tr>
                ) : (
                  eventsData.slice(0, 5).map((e, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-500">{e.date || '—'}</td>
                      <td className="py-2 px-3 font-bold text-gray-900">{e.name || '—'}</td>
                      <td className="py-2 px-3 text-gray-600">{e.client || '—'}</td>
                      <td className="py-2 px-3">
                        <span className="badge text-[10px] px-1.5 py-0.5 rounded font-bold bg-green-50 text-green-700">
                          {e.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, color, bg }) => (
  <div className="premium-card flex items-center gap-3 bg-white hover:shadow-md transition-shadow">
    <div className={cn('p-2.5 rounded-xl flex-shrink-0', bg || 'bg-gray-50')}>
      <Icon size={18} className={color} strokeWidth={2} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className="text-[17px] sm:text-lg font-black text-gray-900 truncate">{value}</p>
    </div>
  </div>
);

export default ExecutiveDashboard;
