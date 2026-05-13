import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { EmployeeManager } from './components/EmployeeManager';
import { ClientManager } from './components/ClientManager';
import { ExpenseManager } from './components/ExpenseManager';
import { NotesManager } from './components/NotesManager';
import { DailyJournal } from './components/DailyJournal';
import AIAssistant from './components/AIAssistant';
import { fetchData } from './services/googleSheets';
import { Bell, User, Menu, Search, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils/cn';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    !!localStorage.getItem('erp_password')
  );
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ employees: [], clients: [], expenses: [], notes: [], ledger: [], password: '' });
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const result = await fetchData();
      setData(result);
      
      // Strict password validation
      const savedPass = localStorage.getItem('erp_password');
      if (savedPass && result.password && savedPass !== result.password.toString()) {
        setIsAuthenticated(false);
        localStorage.removeItem('erp_password');
      }
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  };



  if (!isAuthenticated) {
    return (
      <Login
        onAccess={(pwd) => {
          setIsAuthenticated(true);
          localStorage.setItem('erp_password', pwd);
        }}
        correctPassword={data.password || '0000'}
        isDataLoading={loading}
      />
    );
  }

  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/')           return 'Dashboard';
    if (p === '/employees')  return 'Employees';
    if (p === '/clients')    return 'Clients';
    if (p === '/expenses')   return 'Expenses';
    if (p === '/notes')      return 'Sticky Notes';
    if (p === '/journal')    return 'Daily Journal';
    if (p === '/ai-assistant') return 'AI Assistant';
    return p.slice(1).charAt(0).toUpperCase() + p.slice(2);
  };

  const getPageSubtitle = () => {
    const p = location.pathname;
    if (p === '/')           return 'Welcome back! Here\'s your business overview.';
    if (p === '/employees')  return 'Manage employee ledgers and track payments.';
    if (p === '/clients')    return 'Track clients, revenue and project status.';
    if (p === '/expenses')   return 'Monitor and categorize business expenses.';
    if (p === '/notes')      return 'Jot down quick thoughts and important reminders.';
    if (p === '/journal')    return 'Full monthly financial journal — all transactions.';
    if (p === '/ai-assistant') return 'Ask questions about your business data.';
    return '';
  };

  const renderContent = () => {
    if (!initialLoaded && loading) {
      return (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <div className="spinner" />
          <p className="text-sm text-gray-400 font-medium">Loading your data…</p>
        </div>
      );
    }

    return (
      <Routes location={location} key={location.pathname}>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard data={data} />} />

        <Route path="/employees" element={
          <EmployeeManager employeesData={data.employees} onDataChanged={() => loadData(true)} />
        } />

        <Route path="/clients" element={
          <ClientManager clientsData={data.clients} onDataChanged={() => loadData(true)} />
        } />

        <Route path="/expenses" element={
          <ExpenseManager expensesData={data.expenses} onDataChanged={() => loadData(true)} />
        } />

        <Route path="/notes" element={
          <NotesManager notesData={data.notes} onDataChanged={() => loadData(true)} />
        } />

        <Route path="/journal" element={
          <DailyJournal ledgerData={data.ledger} employeesData={data.employees} onDataChanged={() => loadData(true)} />
        } />

        <Route path="/ai-assistant" element={
          <AIAssistant data={data} />
        } />
      </Routes>
    );
  };

  return (
    <div className="app-shell bg-gray-50">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 600,
            padding: '12px 16px',
            maxWidth: '90vw',
            boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
          },
          success: {
            iconTheme: { primary: '#111827', secondary: '#fff' }
          }
        }}
      />

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={() => {
          setIsAuthenticated(false);
          localStorage.removeItem('erp_password');
        }}
      />

      {/* Main Content */}
      <main
        className={cn(
          'main-content transition-all duration-300',
          collapsed ? 'lg:sidebar-collapsed' : 'lg:sidebar-expanded'
        )}
        style={{
          marginLeft: 0,
          ['--lg-ml']: collapsed ? '72px' : '260px',
        }}
      >
        {/* Top Header */}
        <header
          className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40"
          style={{ boxShadow: '0 1px 0 #f0f0f0' }}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 h-[58px] sm:h-16 gap-3">

            {/* Left */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="icon-btn lg:hidden text-gray-500 flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu size={20} strokeWidth={2} />
              </button>
              <div className="min-w-0">
                <h1 className="text-[15px] sm:text-[17px] font-black text-gray-900 truncate leading-tight">
                  {getPageTitle()}
                </h1>
                <p className="hidden sm:block text-[11px] text-gray-400 font-medium leading-tight mt-0.5 truncate">
                  {getPageSubtitle()}
                </p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Desktop search */}
              <div className="hidden md:flex relative items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                <input
                  type="text"
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  placeholder="Search…"
                  className="bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm font-medium w-44 focus:w-56 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                />
              </div>

              {/* Mobile search toggle */}
              <button
                onClick={() => setSearchOpen(v => !v)}
                className="icon-btn md:hidden text-gray-500"
                aria-label="Search"
              >
                {searchOpen ? <X size={18} strokeWidth={2} /> : <Search size={18} strokeWidth={2} />}
              </button>

              {/* Refresh */}
              <button
                onClick={loadData}
                className="icon-btn text-gray-500"
                aria-label="Refresh"
                title="Refresh data"
              >
                <RefreshCw
                  size={17}
                  strokeWidth={2.2}
                  className={loading ? 'animate-spin' : 'transition-transform hover:rotate-90'}
                />
              </button>

        
             

              {/* Avatar */}
              <div className="flex items-center gap-2 pl-2 border-l border-gray-100 ml-1">
                <div className="hidden sm:block text-right">
                  <p className="text-[12px] font-bold leading-tight text-gray-900">Admin</p>
                  <p className="text-[10px] text-gray-400 leading-tight">Main Account</p>
                </div>
                <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <User size={16} strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="md:hidden overflow-hidden border-t border-gray-100"
              >
                <div className="px-4 py-3 relative">
                  <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                  <input
                    type="text"
                    placeholder="Search…"
                    autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sidebar offset via inline style for desktop */}
      <style>{`
        @media (min-width: 1024px) {
          .main-content { margin-left: ${collapsed ? '72px' : '260px'} !important; }
        }
      `}</style>
    </div>
  );
}

export default App;
