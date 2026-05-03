import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import { StatsCard } from './components/StatsCard';
import { ChartComponent } from './components/ChartComponent';
import { DataTable } from './components/DataTable';
import { EmployeeManager } from './components/EmployeeManager';
import { ClientManager } from './components/ClientManager';
import { ExpenseManager } from './components/ExpenseManager';
import { fetchData } from './services/googleSheets';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Bell,
  User,
  Menu,
  Search,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils/cn';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ employees: [], clients: [], expenses: [], password: '' });
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchData();
      setData(result);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateFinancials = () => {
    const expenses = data.expenses || [];
    const clients = data.clients || [];
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const totalRevenue = clients.reduce((sum, client) => sum + Number(client.amount || 0), 0);
    const netBalance = totalRevenue - totalExpenses;
    return {
      expenses: `$${totalExpenses.toLocaleString()}`,
      revenue: `$${totalRevenue.toLocaleString()}`,
      balance: `$${netBalance.toLocaleString()}`
    };
  };

  const financials = calculateFinancials();

  if (!isAuthenticated) {
    return (
      <Login
        onAccess={() => {
          setIsAuthenticated(true);
          localStorage.setItem('isLoggedIn', 'true');
        }}
        correctPassword={data.password || '0000'}
        isDataLoading={loading}
      />
    );
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    return path.replace('/', '').charAt(0).toUpperCase() + path.replace('/', '').slice(1);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading data…</p>
        </div>
      );
    }

    return (
      <Routes location={location} key={location.pathname}>
        {/* ─── Dashboard ─────────────────────────────────── */}
        <Route path="/" element={
          <div className="space-y-6">
            {/* Stats Grid — 2 cols on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <StatsCard label="Monthly Expense" value={financials.expenses} icon={TrendingDown} trend="-12%" />
              <StatsCard label="Total Revenue"   value={financials.revenue}  icon={TrendingUp}   trend="+8%"  />
              <StatsCard label="Net Balance"     value={financials.balance}  icon={Wallet}  />
              <StatsCard label="Yearly Total"    value="$124,500"             icon={DollarSign} />
            </div>

            {/* Chart + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2">
                <ChartComponent title="Monthly Expense Trends" />
              </div>
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="premium-card">
                  <h3 className="text-base font-bold mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="premium-button w-full text-sm">Add New Expense</button>
                    <button className="w-full py-2.5 px-4 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors min-h-[44px]">
                      Export Report
                    </button>
                  </div>
                </div>
                {/* Active Employees */}
                <div className="premium-card">
                  <h3 className="text-base font-bold mb-3">Active Employees</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-900 flex items-center justify-center text-[10px] font-bold text-white">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-gray-400 font-medium">+12 more</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        } />

        {/* ─── Employees ─────────────────────────────────── */}
        <Route path="/employees" element={
          <EmployeeManager employeesData={data.employees} onDataChanged={loadData} />
        } />

        {/* ─── Clients ───────────────────────────────────── */}
        <Route path="/clients" element={
          <ClientManager clientsData={data.clients} onDataChanged={loadData} />
        } />

        {/* ─── Expenses ──────────────────────────────────── */}
        <Route path="/expenses" element={
          <ExpenseManager expensesData={data.expenses} onDataChanged={loadData} />
        } />
      </Routes>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: '12px', fontSize: '14px', maxWidth: '90vw' }
        }}
      />

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={() => {
          setIsAuthenticated(false);
          localStorage.removeItem('isLoggedIn');
        }}
      />

      {/* Main Content — shifts right on desktop */}
      <main
        className={cn(
          'flex-1 min-h-screen w-full transition-all duration-300',
          /* desktop offset for sidebar */
          collapsed ? 'lg:ml-20' : 'lg:ml-64',
          /* bottom padding for mobile tab bar */
          'pb-20 lg:pb-0'
        )}
      >
        {/* ─── Top Header ──────────────────────────────── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
          <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 gap-3">
            
            {/* Left: Hamburger (mobile only) + Title */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="icon-btn lg:hidden text-gray-500 hover:bg-gray-100 flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
              <h1 className="text-base sm:text-lg font-bold text-black truncate capitalize">
                {getPageTitle()}
              </h1>
            </div>

            {/* Right: Search (desktop) | Icons */}
            <div className="flex items-center gap-2">
              {/* Desktop inline search */}
              <div className="hidden sm:flex relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search…"
                  className="bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2 text-sm w-52 focus:ring-2 focus:ring-black focus:w-64 transition-all"
                />
              </div>

              {/* Mobile search toggle */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="icon-btn sm:hidden text-gray-500 hover:bg-gray-100"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              {/* Refresh */}
              <button
                onClick={loadData}
                className="icon-btn text-gray-500 hover:bg-gray-100"
                aria-label="Refresh data"
                title="Refresh data"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>

              {/* Bell */}
              <button className="icon-btn relative text-gray-500 hover:bg-gray-100" aria-label="Notifications">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>

              {/* Avatar */}
              <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold leading-none">Admin</p>
                  <p className="text-[11px] text-gray-400 leading-none mt-0.5">Main Account</p>
                </div>
                <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <User size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile expandable search */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="sm:hidden overflow-hidden border-t border-gray-100"
              >
                <div className="px-3 py-2 relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search…"
                    autoFocus
                    className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-black"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ─── Page Content ────────────────────────────── */}
        <div className="px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto">
          {/* Subtitle row */}
          <div className="mb-5">
            <p className="text-gray-400 text-sm">Welcome back! Here's what's happening today.</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
