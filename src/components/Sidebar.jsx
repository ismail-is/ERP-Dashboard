import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Receipt, 
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ collapsed, setCollapsed, mobileMenuOpen, setMobileMenuOpen, onLogout }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    { id: 'overview', path: '/', label: 'Overview', icon: LayoutDashboard },
    { id: 'employees', path: '/employees', label: 'Employees', icon: Users },
    { id: 'clients', path: '/clients', label: 'Clients', icon: Briefcase },
    { id: 'expenses', path: '/expenses', label: 'Expenses', icon: Receipt },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <div className={cn(
        "h-screen bg-white border-r border-gray-100 transition-all duration-300 flex flex-col fixed left-0 top-0 z-50",
        collapsed ? "lg:w-20" : "lg:w-64",
        "w-64", // default mobile width
        mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between">
          {!collapsed && <span className="font-bold text-xl tracking-tight lg:block">ERP CORE</span>}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden lg:block"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

      <nav className="flex-1 px-4 mt-4">
        {menuItems.map((item) => {
          const isActive = currentPath === item.path || (currentPath === '/' && item.id === 'overview');
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all mb-2 group",
                isActive
                  ? "bg-black text-white shadow-lg shadow-gray-200" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-colors min-w-[20px]",
                isActive ? "text-white" : "text-gray-400 group-hover:text-black"
              )} />
              {(!collapsed || mobileMenuOpen) && <span className="font-medium lg:block">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all",
            "justify-start", collapsed && "lg:justify-center"
          )}
        >
          <LogOut size={20} className="min-w-[20px]" />
          {(!collapsed || mobileMenuOpen) && <span className="font-medium lg:block">Logout</span>}
        </button>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
