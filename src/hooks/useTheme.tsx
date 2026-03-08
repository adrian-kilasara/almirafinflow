import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

/**
 * Applies the theme from user settings to the document root.
 * Call once at app root level.
 */
export function useThemeEffect() {
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!prefersDark) {
        root.classList.add('light');
        body.classList.add('light');
      }
    } else if (settings.theme === 'light') {
      root.classList.add('light');
      body.classList.add('light');
    }
    // dark is the default (no class needed)

    // Performance mode: disable animations
    if (settings.performance_mode) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [settings.theme, settings.performance_mode]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      document.body.classList.remove('light', 'dark');
      if (!e.matches) {
        root.classList.add('light');
        document.body.classList.add('light');
      }
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);
}
