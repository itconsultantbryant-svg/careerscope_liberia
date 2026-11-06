import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children, flush = false }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <Navbar showSidebarToggle sidebarOpen={open} onSidebarToggle={() => setOpen(!open)} />
    <Sidebar role={user.role} isOpen={open} onClose={() => setOpen(false)} />
    <main id="dashboard-content" className={`md:ml-64 min-w-0 ${flush ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
      <div className={flush ? '' : 'max-w-screen-2xl mx-auto'}>{children}</div>
    </main>
  </div>;
}
