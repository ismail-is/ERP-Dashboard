import React from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Receipt,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Link, useLocation } from 'react-router-dom';

const menuItems = [
  { id: 'overview',   path: '/',          label: 'Overview',  icon: LayoutDashboard },
  { id: 'employees',  path: '/employees', label: 'Employees', icon: Users },
  { id: 'clients',    path: '/clients',   label: 'Clients',   icon: Briefcase },
  { id: 'expenses',   path: '/expenses',  label: 'Expenses',  icon: Receipt },
];

const Sidebar = ({ collapsed, setCollapsed, mobileMenuOpen, setMobileMenuOpen, onLogout }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (item) =>
    currentPath === item.path || (currentPath === '/' && item.id === 'overview');

  /* ─── Desktop Sidebar ─────────────────────────────────────── */
  const DesktopSidebar = (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen bg-white border-r border-gray-100',
        'fixed left-0 top-0 z-50 transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo / Brand */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
        {!collapsed && (
          <span className="font-extrabold text-lg tracking-tight">ERP CORE</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="icon-btn text-gray-400 hover:text-black hover:bg-gray-100 ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium text-sm group',
              collapsed && 'justify-center',
              isActive(item)
                ? 'bg-black text-white shadow'
                : 'text-gray-500 hover:bg-gray-50 hover:text-black'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon
              size={20}
              className={cn(
                'flex-shrink-0 transition-colors',
                isActive(item) ? 'text-white' : 'text-gray-400 group-hover:text-black'
              )}
            />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all text-sm font-medium',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );

  /* ─── Mobile Drawer (slides from left) ────────────────────── */
  const MobileDrawer = (
    <>
      {/* Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-white z-50',
          'flex flex-col shadow-2xl transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 flex-shrink-0">
          <span className="font-extrabold text-lg tracking-tight">ERP CORE</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="icon-btn text-gray-400 hover:text-black hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-5 overflow-y-auto space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-medium text-[15px]',
                isActive(item)
                  ? 'bg-black text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-black'
              )}
            >
              <item.icon
                size={21}
                className={cn(
                  'flex-shrink-0',
                  isActive(item) ? 'text-white' : 'text-gray-400'
                )}
              />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onLogout}
            className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 transition-all text-[15px] font-medium"
          >
            <LogOut size={20} className="flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );

  /* ─── Mobile Bottom Tab Bar ────────────────────────────────── */
  const MobileBottomNav = (
    <nav className="mobile-bottom-nav">
      <div className="grid grid-cols-4 h-16">
        {menuItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-all',
                active ? 'text-black' : 'text-gray-400'
              )}
            >
              <span
                className={cn(
                  'p-1.5 rounded-xl transition-all',
                  active && 'bg-black text-white'
                )}
              >
                <item.icon size={19} className={active ? 'text-white' : ''} />
              </span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {DesktopSidebar}
      {MobileDrawer}
      {MobileBottomNav}
    </>
  );
};

export default Sidebar;
