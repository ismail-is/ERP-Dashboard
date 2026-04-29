import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import { StatsCard } from './components/StatsCard';
import { ChartComponent } from './components/ChartComponent';
import { DataTable } from './components/DataTable';
import { EmployeeManager } from './components/EmployeeManager';
import { fetchData } from './services/googleSheets';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Users,
  Briefcase,
  Search,
  Bell,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils/cn';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState({ employees: [], clients: [], expenses: [], password: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pre-fetch password and data
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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard label="Monthly Expense" value={financials.expenses} icon={TrendingDown} trend="-12%" />
              <StatsCard label="Total Revenue" value={financials.revenue} icon={TrendingUp} trend="+8%" />
              <StatsCard label="Net Balance" value={financials.balance} icon={Wallet} />
              <StatsCard label="Yearly Total" value="$124,500" icon={DollarSign} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChartComponent title="Monthly Expense Trends" />
              </div>
              <div className="space-y-6">
                <div className="premium-card">
                  <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button className="w-full premium-button py-2 text-sm">Add New Expense</button>
                    <button className="w-full py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Export Report</button>
                  </div>
                </div>
                <div className="premium-card">
                  <h3 className="text-lg font-bold mb-4">Active Employees</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold">
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
        
        <Route path="/employees" element={<EmployeeManager employeesData={data.employees} onDataChanged={loadData} />} />
        
        <Route path="/clients" element={
          <DataTable 
            title="Client Management"
            data={data.clients}
            columns={[
              { header: 'Client', accessor: 'name' },
              { header: 'Service', accessor: 'services' },
              { header: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
              { header: 'Status', render: (row) => (
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">{row.status}</span>
              )}
            ]}
          />
        } />
        
        <Route path="/expenses" element={
          <DataTable 
            title="Expense Tracker"
            data={data.expenses}
            columns={[
              { header: 'Category', accessor: 'category' },
              { header: 'Amount', render: (row) => `$${Number(row.amount || 0).toLocaleString()}` },
              { header: 'Date', accessor: 'date' }
            ]}
          />
        } />
      </Routes>
    );
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard Overview';
    return `${path.replace('/', '')} Management`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster position="top-right" />
      <Sidebar 
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={() => {
          setIsAuthenticated(false);
          localStorage.removeItem('isLoggedIn');
        }}
      />
      
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen",
        collapsed ? "ml-20" : "ml-64"
      )}>
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="relative w-96 max-w-[40%]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search data..." 
              className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-gray-400 hover:text-black transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
              <div className="text-right">
                <p className="text-sm font-bold">Admin User</p>
                <p className="text-xs text-gray-400">Main Account</p>
              </div>
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-black capitalize">
              {getPageTitle()}
            </h2>
            <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
