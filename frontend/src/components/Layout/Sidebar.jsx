import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  Inbox, 
  Users, 
  Package, 
  ShoppingCart, 
  Calendar, 
  BookOpen, 
  Cpu, 
  BarChart3, 
  Settings, 
  ShieldAlert, 
  Sun, 
  Moon,
  MessageSquare,
  Wrench,
  User,
  LogOut
} from 'lucide-react';

const Sidebar = () => {
  const clerk = useClerk();
  const { user } = useUser();
  const { darkMode, setDarkMode, activeWorkspace, workspaceSettings } = useApp();
  const location = useLocation();

  // Modules config — null means "not yet loaded, show all"
  const modules = workspaceSettings?.modules || null;

  const allNavItems = [
    { name: 'Dashboard',     path: '/',              icon: LayoutDashboard },
    { name: 'Inbox',         path: '/inbox',          icon: Inbox },
    { name: 'Clientes',      path: '/customers',      icon: Users },
    { name: 'Produtos',      path: '/products',       icon: Package,      moduleKey: 'products' },
    { name: 'Serviços',      path: '/services',       icon: Wrench,       moduleKey: 'services' },
    { name: 'Pedidos',       path: '/orders',         icon: ShoppingCart, moduleKey: 'orders' },
    { name: 'Agendamentos',  path: '/appointments',   icon: Calendar,     moduleKey: 'appointments' },
    { name: 'Conhecimento',  path: '/knowledge-base', icon: BookOpen },
    { name: 'Automações',    path: '/automations',    icon: Cpu },
    { name: 'Relatórios',    path: '/analytics',      icon: BarChart3 },
    { name: 'Configurações', path: '/settings',       icon: Settings },
    { name: 'Equipe',        path: '/team',           icon: ShieldAlert }
  ];

  // Filter: if moduleKey is defined and modules is loaded, only show if enabled
  const navItems = allNavItems.filter(item => {
    if (!item.moduleKey) return true;          // Always-visible items
    if (modules === null) return true;          // Not loaded yet — show all
    return modules[item.moduleKey] !== false;   // Hide only if explicitly false
  });

  return (
    <aside className="w-64 h-screen glass-panel rounded-none border-r border-black/5 dark:border-white/5 flex flex-col justify-between p-4 select-none shrink-0">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2 py-1">
          <img src="/logoaliceclean.png?v=3" alt="Alice Logo" className="w-9 h-9 object-contain bg-transparent shadow-glowing" />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wide text-foreground">Alice</span>
            <span className="text-xs text-foreground/50">{activeWorkspace?.name || 'Carregando...'}</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-600/10 dark:bg-gradient-to-r dark:from-indigo-600/30 dark:to-purple-600/20 text-indigo-600 dark:text-white border-l-2 border-indigo-500 pl-4 font-bold' 
                    : 'text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Dark/Light mode theme switcher & Clerk profile info */}
      <div className="flex flex-col gap-4 border-t border-black/5 dark:border-white/5 pt-4">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-all duration-200"
        >
          <span className="flex items-center gap-3">
            {!darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            Tema {!darkMode ? 'Claro' : 'Escuro'}
          </span>
          <div className="w-8 h-4 rounded-full bg-black/10 dark:bg-white/10 flex items-center p-0.5 transition-all duration-300">
            <div className={`w-3 h-3 rounded-full bg-white transition-all duration-300 ${!darkMode ? 'translate-x-4 bg-indigo-500' : ''}`} />
          </div>
        </button>

        {/* User profile card with Clerk Account Options */}
        <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 mt-1 font-sans">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img 
              src={user?.imageUrl} 
              alt={user?.fullName || 'User Avatar'} 
              className="w-8 h-8 rounded-lg border border-indigo-500/20 shadow-indigo-600/10 shadow-lg object-cover shrink-0"
            />
            <div className="flex flex-col text-left overflow-hidden text-ellipsis">
              <span className="text-xs font-bold text-foreground truncate">{user?.fullName || 'Usuário'}</span>
              <span className="text-[10px] text-foreground/40 truncate">{user?.primaryEmailAddress?.emailAddress || ''}</span>
            </div>
          </div>
          
          {/* Custom quick action buttons */}
          <div className="grid grid-cols-2 gap-2 border-t border-black/5 dark:border-white/5 pt-2">
            <button
              onClick={() => clerk.openUserProfile()}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[10px] font-bold text-foreground/75 cursor-pointer transition active:scale-95 border border-black/5 dark:border-white/5"
              title="Editar Perfil"
            >
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span>Editar</span>
            </button>
            <button
              onClick={() => clerk.signOut({ redirectUrl: '/' })}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-[10px] font-bold text-red-500 cursor-pointer transition active:scale-95 border border-red-500/10"
              title="Sair da Conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
