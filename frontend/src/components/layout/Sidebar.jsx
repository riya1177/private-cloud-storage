import React from 'react';
import { NavLink } from 'react-router-dom';
import { Cloud, LayoutDashboard, Folder, Settings, ShieldCheck, LogOut, Share2, Users } from 'lucide-react';
import StorageIndicator from '../ui/StorageIndicator';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ files = [], isOpen = false, onClose }) => {
  const { username, logoutUser } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Files', path: '/files', icon: Folder },
    { name: 'Shared by Me', path: '/shared-by-me', icon: Share2 },
    { name: 'Shared with Me', path: '/shared-with-me', icon: Users },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm lg:hidden animate-backdrop"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between transition-all duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-5">
          <div className="flex items-center gap-3 px-2 py-1 mb-6">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none transition-colors">
                Private Cloud
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
                Secure Storage Pool
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/20 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Storage & User Profile */}
        <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-900 transition-colors">
          {/* Storage Indicator */}
          <StorageIndicator files={files} />

          {/* Security Status Badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-slate-900/50 border border-emerald-200/80 dark:border-slate-800/60 text-[11px] text-emerald-700 dark:text-emerald-400 transition-colors">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">End-to-End Encryption</span>
          </div>

          {/* User Profile Info */}
          <div className="flex items-center justify-between pt-2 px-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center uppercase shrink-0 border border-indigo-200 dark:border-indigo-500/30">
                {username ? username.charAt(0) : 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate transition-colors">
                  {username || 'User'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate transition-colors">
                  Authenticated
                </p>
              </div>
            </div>

            <button
              onClick={logoutUser}
              title="Logout"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
