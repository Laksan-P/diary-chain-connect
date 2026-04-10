import React, { useState, useEffect } from 'react';
import { Bell, Info, CheckCircle2, XCircle, Clock, RefreshCcw } from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { getNotifications } from '@/services/api';
import type { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data);
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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatMessage = (msg: string) => {
    if (!msg.includes('|')) return msg;
    const [key, paramsStr] = msg.split('|');
    const params: Record<string, string> = {};
    paramsStr.split(',').forEach(p => {
      const [k, v] = p.split(':');
      params[k] = v;
    });

    // Simple replacement for common keys
    let text = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (params.id) text += ` #${params.id}`;
    if (params.farmer) text += ` - ${params.farmer}`;
    if (params.result) text += ` (${params.result})`;
    if (params.reason) text += ` : ${params.reason}`;
    if (params.amount) text += ` - Rs. ${params.amount}`;
    if (params.days) text += ` in ${params.days} days`;
    if (params.vehicle) text += ` [Vehicle: ${params.vehicle}]`;
    if (params.transporter) text += ` [Transporter: ${params.transporter}]`;
    
    return text;
  };

  const getIcon = (type: string, title: string) => {
    if (title.toLowerCase().includes('pass') || title.toLowerCase().includes('approve') || title.toLowerCase().includes('accept')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    if (title.toLowerCase().includes('fail') || title.toLowerCase().includes('reject')) {
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
          {unreadCount > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">
              {unreadCount} New
            </span>
          )}
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
                <div key={n.id} className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-primary/[0.02]' : ''}`}>
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getIcon(n.type, n.title)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className={`text-xs leading-relaxed ${!n.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {formatMessage(n.message)}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : 'Just now'}
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
