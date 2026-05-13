import React from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Receipt,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  StickyNote,
  BookOpen,
  Bot
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Link, useLocation } from 'react-router-dom';

const menuItems = [
  { id: 'overview',  path: '/',          label: 'Overview',  icon: LayoutDashboard },
  { id: 'employees', path: '/employees', label: 'Employees', icon: Users },
  { id: 'clients',   path: '/clients',   label: 'Clients',   icon: Briefcase },
  { id: 'expenses',  path: '/expenses',  label: 'Expenses',  icon: Receipt },
  { id: 'notes',     path: '/notes',     label: 'Notes',     icon: StickyNote },
  { id: 'journal',   path: '/journal',   label: 'Journal',   icon: BookOpen },
  { id: 'ai-assistant', path: '/ai-assistant', label: 'AI Assistant', icon: Bot },
];

const Sidebar = ({ collapsed, setCollapsed, mobileMenuOpen, setMobileMenuOpen, onLogout }) => {
  const location  = useLocation();
  const curr      = location.pathname;
  const isActive  = (item) => curr === item.path || (curr === '/' && item.id === 'overview');

  /* ── Shared nav link renderer ────────────────────────────── */
  const NavLink = ({ item, size = 20, showLabel = true, onClick }) => {
    const active = isActive(item);
    return (
      <Link
        to={item.path}
        onClick={onClick}
        title={!showLabel ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-[14px] transition-all select-none group',
          !showLabel && 'justify-center',
          active
            ? 'bg-gray-900 text-white shadow-sm'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <item.icon
          size={size}
          strokeWidth={active ? 2.5 : 1.8}
          className={cn(
            'flex-shrink-0 transition-colors',
            active ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'
          )}
        />
        {showLabel && <span>{item.label}</span>}
      </Link>
    );
  };

  /* ── Desktop Sidebar ─────────────────────────────────────── */
  const DesktopSidebar = (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen bg-white border-r border-gray-100',
        'fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{ boxShadow: '2px 0 16px rgb(0 0 0 / 0.04)' }}
    >
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-50 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black tracking-tight">E</span>
            </div>
            <span className="font-black text-[15px] tracking-tight text-gray-900">ERP CORE</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('icon-btn text-gray-400 hover:text-gray-900', collapsed && 'mx-auto')}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {!collapsed && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
            Navigation
          </p>
        )}
        {menuItems.map((item) => (
          <NavLink key={item.id} item={item} showLabel={!collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-50 flex-shrink-0 space-y-1">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">A</span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-900 leading-none">Admin</p>
                <p className="text-[11px] text-gray-400 leading-none mt-0.5">Main Account</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-all text-[14px] font-semibold',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={18} strokeWidth={2} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );

  /* ── Mobile Drawer (slides from left) ──────────────────────── */
  const MobileDrawer = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-all duration-300',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-full bg-white z-[95]',
          'flex flex-col transition-transform duration-300 ease-in-out',
          'w-[280px] max-w-[85vw]',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ boxShadow: '4px 0 24px rgb(0 0 0 / 0.12)' }}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-black">E</span>
            </div>
            <span className="font-black text-[15px] tracking-tight text-gray-900">ERP CORE</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="icon-btn text-gray-400 hover:text-gray-900"
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto space-y-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
            Navigation
          </p>
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              size={20}
              showLabel
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-50 flex-shrink-0 space-y-1">
          <div className="px-3 py-3 bg-gray-50 rounded-xl mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-900 leading-none">Admin</p>
                <p className="text-[12px] text-gray-500 leading-none mt-0.5">Main Account</p>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-gray-500 hover:bg-gray-100 transition-all text-[14px] font-semibold"
          >
            <LogOut size={18} strokeWidth={2} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );

  /* ── Mobile Bottom Tab Bar ─────────────────────────────────── */
  const MobileBottomNav = (
    <nav className="mobile-bottom-nav">
      <div className="grid grid-cols-5 h-[68px] max-w-md mx-auto px-1">
        {menuItems.slice(0, 5).map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-all duration-300',
                active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-9 h-9 transition-all duration-300',
                  active ? 'bg-gray-900 rounded-full shadow-md -translate-y-1' : 'bg-transparent'
                )}
              >
                <item.icon
                  size={18}
                  strokeWidth={active ? 2.5 : 2}
                  className={active ? 'text-white' : ''}
                />
              </span>
              <span className={cn('leading-none tracking-tight transition-transform', active ? '-translate-y-0.5' : '')}>
                {item.label}
              </span>
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
