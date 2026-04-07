import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Milk, Users, Truck, DollarSign, BarChart3, LogOut, Menu, Settings, Building2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Dashboard', path: '/nestle', icon: BarChart3 },
  { title: 'Milk History', path: '/nestle/history', icon: Milk },
  { title: 'Chilling Centers', path: '/nestle/centers', icon: Building2 },
  { title: 'Farmers', path: '/nestle/farmers', icon: Users },
  { title: 'Dispatches', path: '/nestle/dispatches', icon: Truck },
  { title: 'Pricing Rules', path: '/nestle/pricing', icon: Settings },
  { title: 'Payments', path: '/nestle/payments', icon: DollarSign },
  { title: 'Analytics', path: '/nestle/analytics', icon: BarChart3 },
];

const NestleLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex bg-background">
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="glass-sidebar flex flex-col overflow-hidden flex-shrink-0"
      >
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
              <Milk className="w-5 h-5 text-sidebar-foreground" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sidebar-foreground text-sm">Nestlé HQ</h2>
              <p className="text-xs text-sidebar-foreground/60">{user?.name}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/nestle'}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
              activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
            >
              <item.icon className="w-4 h-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors w-full">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-4 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-semibold text-foreground">Nestlé Dashboard</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default NestleLayout;
