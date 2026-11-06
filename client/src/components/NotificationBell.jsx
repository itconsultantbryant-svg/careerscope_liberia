import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { toast } from 'sonner';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const button = useRef(null);
  const panel = useRef(null);
  const load = useCallback(async () => {
    try {
      const [items, count] = await Promise.all([api.get('/notifications'), api.get('/notifications/unread-count')]);
      setNotifications(items.data.notifications || []); setUnread(count.data.count || 0); setError('');
    } catch { setError('Notifications could not be refreshed.'); }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    if (socket) { socket.on('notification_created', load); socket.on('notifications_changed', load); socket.on('connect', load); }
    return () => { clearInterval(timer); socket?.off('notification_created', load); socket?.off('notifications_changed', load); socket?.off('connect', load); };
  }, [load, socket]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key === 'Escape') { setOpen(false); button.current?.focus(); }
      if (event.type === 'pointerdown' && !panel.current?.contains(event.target) && !button.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [open]);
  const visit = async (item) => {
    if (!item.is_read) {
      try { await api.patch(`/notifications/${item.id}/read`); await load(); }
      catch { toast.error('Could not update notification status'); }
    }
    setOpen(false);
    const target = item.target_path;
    if (target?.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) navigate(target);
  };
  return <>
    <button ref={button} type="button" onClick={() => setOpen(!open)} className="relative p-3 text-current rounded-lg hover:bg-gray-100/30" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
      <Bell className="w-6 h-6" />{unread > 0 && <span className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && createPortal(<section ref={panel} aria-label="Notifications" className="fixed top-20 right-3 left-3 sm:left-auto sm:w-96 z-[80] bg-white text-gray-900 border shadow-2xl rounded-xl max-h-[calc(100dvh-6rem)] overflow-y-auto">
      <header className="p-4 border-b flex items-center justify-between gap-3 sticky top-0 bg-white"><div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-gray-500">{isConnected ? 'Live updates connected' : 'Reconnecting · periodic refresh active'}</p></div><button aria-label="Close notifications" className="p-2" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button></header>
      {unread > 0 && <button className="p-3 text-sm text-primary-700 underline" onClick={async () => { try { await api.patch('/notifications/read-all'); await load(); } catch { toast.error('Could not mark notifications read'); } }}>Mark all read</button>}
      {error && <p className="p-3 text-sm text-red-700" role="status">{error}</p>}
      {!notifications.length && <p className="p-6 text-gray-500">You’re all caught up.</p>}
      <div className="divide-y">{notifications.map((item) => <button key={item.id} type="button" onClick={() => visit(item)} className={`block w-full text-left p-4 hover:bg-gray-100 ${item.is_read ? '' : 'bg-primary-50'}`}>
        <span className="block text-sm font-semibold">{!item.is_read && <span aria-label="Unread" className="inline-block w-2 h-2 bg-primary-600 rounded-full mr-2" />}{item.title}</span>
        <span className="block text-sm text-gray-600 mt-1 break-words">{item.message}</span>
        <time className="block text-xs text-gray-500 mt-2">{new Date(item.created_at).toLocaleString()}</time>
        {item.target_path && <span className="block text-xs text-primary-700 mt-2">Open related section →</span>}
      </button>)}</div>
    </section>, document.body)}
  </>;
}
