import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  dismissed: boolean;
  created_at: string;
  read_at: string | null;
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId || userId === 'dev-user') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const items = (data || []) as Notification[];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription filtered to this user
  useEffect(() => {
    if (!userId || userId === 'dev-user') return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Only add if not dismissed (shouldn't be, but safety check)
          if (!newNotif.dismissed) {
            setNotifications((prev) => [newNotif, ...prev]);
            if (!newNotif.read) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq('id', notificationId);

        if (error) throw error;

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    []
  );

  // Mark all as read
  const markAllRead = useCallback(
    async () => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq('recipient_id', userId)
          .eq('read', false)
          .eq('dismissed', false);

        if (error) throw error;

        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      } catch (error) {
        console.error('Failed to mark all as read:', error);
      }
    },
    [userId]
  );

  // Clear all = dismiss all (hides from view, doesn't delete)
  const clearAll = useCallback(
    async () => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('notifications')
          .update({ dismissed: true })
          .eq('recipient_id', userId)
          .eq('dismissed', false);

        if (error) throw error;

        setNotifications([]);
        setUnreadCount(0);
      } catch (error) {
        console.error('Failed to clear notifications:', error);
      }
    },
    [userId]
  );

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    clearAll,
    refetch: fetchNotifications,
  };
}
