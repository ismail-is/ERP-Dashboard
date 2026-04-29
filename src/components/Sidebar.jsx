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

const Sidebar = ({ collapsed, setCollapsed, onLogout }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    { id: 'overview', path: '/', label: 'Overview', icon: LayoutDashboard },
    { id: 'employees', path: '/employees', label: 'Employees', icon: Users },
    { id: 'clients', path: '/clients', label: 'Clients', icon: Briefcase },
    { id: 'expenses', path: '/expenses', label: 'Expenses', icon: Receipt },
  ];

  return (
    <div className={cn(
      "h-screen bg-white border-r border-gray-100 transition-all duration-300 flex flex-col fixed left-0 top-0 z-50",
      collapsed ? "w-20" : "w-20 lg:w-64"
    )}>
      <div className="p-6 flex items-center justify-between">
        {!collapsed && <span className="font-bold text-xl tracking-tight hidden lg:block">ERP CORE</span>}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 mt-4">
        {menuItems.map((item) => {
          const isActive = currentPath === item.path || (currentPath === '/' && item.id === 'overview');
          return (
            <Link
              key={item.id}
              to={item.path}
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
              {!collapsed && <span className="font-medium hidden lg:block">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all",
            "justify-center", !collapsed && "lg:justify-start"
          )}
        >
          <LogOut size={20} className="min-w-[20px]" />
          {!collapsed && <span className="font-medium hidden lg:block">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
