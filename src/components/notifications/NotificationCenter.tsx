import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { formatRelativeDate } from '@/lib/format';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  module: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const clearAll = async () => {
    for (const n of notifications) {
      await supabase.from('notifications').delete().eq('id', n.id);
    }
    setNotifications([]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case 'transactions': return 'text-primary';
      case 'budgets': return 'text-[hsl(var(--warning))]';
      case 'savings': return 'text-[hsl(var(--income))]';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(true)}>
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4" /> Notifications
                {unreadCount > 0 && (
                  <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </span>
              <div className="flex gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
                    <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {notifications.length > 0 ? (
            <div className="space-y-1">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                    n.is_read ? 'bg-muted/20 opacity-70' : 'bg-muted/40 hover:bg-muted/60'
                  }`}
                >
                  <span className="text-sm mt-0.5">{getTypeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{n.title}</p>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] capitalize ${getModuleColor(n.module)}`}>{n.module}</span>
                      <span className="text-[10px] text-muted-foreground">{formatRelativeDate(n.created_at)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
