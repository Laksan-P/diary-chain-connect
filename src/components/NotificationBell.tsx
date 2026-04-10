import React, { useState, useEffect } from 'react';
import { Bell, Info, CheckCircle2, XCircle, Clock, RefreshCcw } from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { getNotifications, markNotificationRead } from '@/services/api';
import type { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string | number) => {
    try {
      // Optimistic UI update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      await markNotificationRead(id);
    } catch (err) {
      console.error('Failed to mark read:', err);
      // Revert on error if necessary
      fetchNotes();
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    
    try {
      await Promise.all(unread.map(n => markNotificationRead(n.id)));
      fetchNotes();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatMessage = (msg: string) => {
    if (!msg || !msg.includes('|')) return msg || '';
    const [key, paramsStr] = msg.split('|');
    const params: Record<string, string> = {};
    paramsStr.split(',').forEach(p => {
      const parts = p.split(':');
      if (parts.length >= 2) {
        params[parts[0]] = parts.slice(1).join(':');
      }
    });

    // Formatting based on keys
    let text = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Custom logic for CC/Nestle messages
    if (key.includes('cc_collection')) {
      text = `Nestlé Decision: ${params.result === 'Pass' ? 'PASS' : 'REJECTED'}`;
    }

    if (params.id) text += ` #${params.id}`;
    if (params.farmer) text += ` [Farmer: ${params.farmer}]`;
    if (params.vehicle) text += ` [Vehicle: ${params.vehicle}]`;
    if (params.transporter) text += ` [Transporter: ${params.transporter}]`;
    if (params.reason) text += ` - Reason: ${params.reason}`;
    if (params.amount) text += ` - Rs. ${params.amount}`;
    if (params.days) text += ` in ${params.days} days`;
    
    return text;
  };

  const getIcon = (type: string, title: string, message: string) => {
    const combined = (title + ' ' + message).toLowerCase();
    if (combined.includes('pass') || combined.includes('approve') || combined.includes('accept') || combined.includes('success')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    if (combined.includes('fail') || combined.includes('reject') || combined.includes('rejection')) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-display font-bold text-sm">Notifications</h4>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase font-bold text-muted-foreground hover:text-primary" onClick={handleMarkAllAsRead}>
                Mark all read
              </Button>
            )}
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">
              {unreadCount} New
            </span>
          </div>
        </div>
        <div className="max-h-[350px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer group ${!n.isRead ? 'bg-primary/[0.03]' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getIcon(n.type, n.title, n.message)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={`text-xs leading-relaxed break-words ${!n.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {formatMessage(n.message)}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : 'Just now'}
                        </div>
                        {!n.isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-[10px] uppercase font-bold tracking-wider gap-2 hover:bg-primary/5 text-primary" 
            onClick={fetchNotes}
            disabled={loading}
          >
            <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
