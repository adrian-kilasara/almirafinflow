import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const IDLE_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
const CHANNEL_NAME = 'finflow-activity';

/**
 * Auto sign-out after 5 minutes of inactivity.
 * - Throttled activity listeners reset the timer.
 * - BroadcastChannel keeps multiple tabs in sync (activity in one tab keeps
 *   all tabs alive; a forced logout propagates to every tab).
 */
export function useIdleLogout(enabled: boolean) {
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);
  const lastResetRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
    channelRef.current = channel;

    const doLogout = async (broadcast = true) => {
      if (broadcast && channel) channel.postMessage({ type: 'logout' });
      try {
        await supabase.auth.signOut();
      } catch {}
      toast.warning('Signed out due to inactivity');
      navigate('/auth', { replace: true });
    };

    const scheduleLogout = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => doLogout(true), IDLE_MS);
    };

    const resetTimer = (broadcast = true) => {
      const now = Date.now();
      // Throttle to once every 250ms
      if (now - lastResetRef.current < 250) return;
      lastResetRef.current = now;
      scheduleLogout();
      if (broadcast && channel) channel.postMessage({ type: 'activity', at: now });
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, () => resetTimer(true), { passive: true })
    );

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resetTimer(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (channel) {
      channel.onmessage = (e) => {
        if (e.data?.type === 'activity') resetTimer(false);
        if (e.data?.type === 'logout') doLogout(false);
      };
    }

    scheduleLogout();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, () => resetTimer(true))
      );
      document.removeEventListener('visibilitychange', onVisibility);
      channel?.close();
    };
  }, [enabled, navigate]);
}
