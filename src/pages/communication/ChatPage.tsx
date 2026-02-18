import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { PageShell } from '../../components/PageShell';
import {
  Send,
  Hash,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { DefaultAvatar } from '../../components/DefaultAvatar';
import { renderContentWithMentions } from '../../lib/renderMentions';
import { INPUT_CLASS } from '../../lib/inputStyles';

// ── Types ─────────────────────────────────────────────────────
interface ChatRoom {
  id: string;
  name: string;
}

interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profile?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url: string | null;
  };
}

// Fixed room names (mapped to DB)
const ROOM_NAMES = ['Design', 'Production', 'General'] as const;

// ── Component ─────────────────────────────────────────────────
export default function ChatPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // ── State ───────────────────────────────────────────────────
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Ensure rooms exist ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingRooms(true);
      // Fetch existing rooms
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at');

      let roomList = (existing || []) as ChatRoom[];

      // Create missing fixed rooms
      for (const name of ROOM_NAMES) {
        if (!roomList.find((r) => r.name === name)) {
          const { data: newRoom } = await supabase
            .from('chat_rooms')
            .insert({ name, created_by: getUserIdForDb() })
            .select()
            .single();
          if (newRoom) roomList.push(newRoom as ChatRoom);
        }
      }

      // Sort by ROOM_NAMES order
      roomList = ROOM_NAMES.map(
        (name) => roomList.find((r) => r.name === name)!,
      ).filter(Boolean);

      setRooms(roomList);
      if (roomList.length > 0) setActiveRoomId(roomList[0].id);
      setLoadingRooms(false);
    })();
  }, [user?.id]);

  // ── Fetch messages for active room ──────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!activeRoomId) return;
    setLoadingMessages(true);

    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles!chat_messages_sender_id_fkey(full_name, first_name, last_name, avatar_url)')
      .eq('room_id', activeRoomId)
      .order('created_at', { ascending: true });

    setMessages((data || []) as ChatMessage[]);
    setLoadingMessages(false);
  }, [activeRoomId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Scroll to bottom ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Supabase Realtime subscription ──────────────────────────
  useEffect(() => {
    if (!activeRoomId) return;

    // Unsubscribe from previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeRoomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Fetch the profile for this message
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, first_name, last_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const enrichedMsg: ChatMessage = {
            ...newMsg,
            profile: profile || { avatar_url: null },
          };

          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === enrichedMsg.id)) return prev;
            return [...prev, enrichedMsg];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoomId]);

  // ── Send message ────────────────────────────────────────────
  const handleSend = async () => {
    const senderId = getUserIdForDb();
    if (!newMessage.trim() || !activeRoomId || !user || !senderId) return;
    setSending(true);

    await supabase.from('chat_messages').insert({
      room_id: activeRoomId,
      sender_id: senderId,
      content: newMessage.trim(),
    });

    setNewMessage('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Date helpers ────────────────────────────────────────────
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return t('chat.today');
    if (date.toDateString() === yesterday.toDateString()) return t('chat.yesterday');
    return date.toLocaleDateString();
  };

  const shouldShowDateSeparator = (idx: number) => {
    if (idx === 0) return true;
    const curr = new Date(messages[idx].created_at).toDateString();
    const prev = new Date(messages[idx - 1].created_at).toDateString();
    return curr !== prev;
  };

  // ── Room label ──────────────────────────────────────────────
  const roomLabel = (name: string) => {
    const key = name.toLowerCase() as 'design' | 'production' | 'general';
    return t(`chat.rooms.${key}`);
  };

  // ── Render ──────────────────────────────────────────────────
  if (loadingRooms) {
    return (
      <PageShell
        titleKey="pages.internalChat.title"
        descriptionKey="pages.internalChat.description"
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      titleKey="pages.internalChat.title"
      descriptionKey="pages.internalChat.description"
    >
      <div className="flex flex-col sm:flex-row bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        {/* ── Room tabs (horizontal on mobile, vertical sidebar on sm+) ── */}
        <div className="sm:w-56 shrink-0 sm:border-r border-b sm:border-b-0 border-nokturo-200 dark:border-nokturo-700 bg-nokturo-50 dark:bg-nokturo-800 flex sm:flex-col">
          <div className="hidden sm:block px-4 py-3 border-b border-nokturo-200 dark:border-nokturo-700">
            <h4 className="text-heading-5 font-extralight text-nokturo-500 uppercase tracking-wider">
              {t('nav.communication')}
            </h4>
          </div>
          <div className="flex sm:flex-col sm:flex-1 overflow-x-auto sm:overflow-y-auto py-1 sm:py-1 px-2 sm:px-0 gap-1 sm:gap-0">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm transition-colors whitespace-nowrap rounded sm:rounded-none sm:w-full ${
                  activeRoomId === room.id
                    ? 'bg-nokturo-200 dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100'
                    : 'text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200'
                }`}
              >
                <Hash className="w-4 h-4 shrink-0 text-nokturo-500" />
                {roomLabel(room.name)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main chat area ────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Room header */}
          <div className="px-4 py-3 border-b border-nokturo-200 shrink-0">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-nokturo-500" />
              <h3 className="text-heading-5 font-extralight text-nokturo-900">
                {rooms.find((r) => r.id === activeRoomId)
                  ? roomLabel(rooms.find((r) => r.id === activeRoomId)!.name)
                  : ''}
              </h3>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-nokturo-500 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="w-10 h-10 text-nokturo-600 mb-3" />
                <p className="text-nokturo-500 text-sm">{t('chat.noMessages')}</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.sender_id === user?.id;
                const showDate = shouldShowDateSeparator(idx);
                const name =
                  [msg.profile?.first_name, msg.profile?.last_name]
                    .filter(Boolean)
                    .join(' ') ||
                  msg.profile?.full_name ||
                  'Unknown';

                return (
                  <div key={msg.id}>
                    {/* Date separator */}
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-nokturo-200" />
                        <span className="text-xs text-nokturo-500 shrink-0">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-nokturo-200" />
                      </div>
                    )}

                    {/* Message */}
                    <div className="flex items-start gap-3 py-1.5 hover:bg-nokturo-50/70 rounded px-2 -mx-2 transition-colors group">
                      {/* Avatar */}
                      {msg.profile?.avatar_url ? (
                        <img
                          src={msg.profile.avatar_url}
                          alt={name}
                          className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-0.5 flex items-center justify-center bg-black">
                          <DefaultAvatar size={32} />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-nokturo-900">
                            {name}
                          </span>
                          <span className="text-[10px] text-nokturo-500">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-nokturo-600 leading-relaxed break-words">
                          {renderContentWithMentions(
                            msg.content,
                            isOwn,
                            [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || ''
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="px-4 py-3 border-t border-nokturo-200 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.messagePlaceholder')}
                rows={1}
                className={`${INPUT_CLASS} flex-1 resize-none max-h-32`}
                style={{ minHeight: '38px' }}
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-2 bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-900/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
