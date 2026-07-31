'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function SessionSync() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isAuthPage = pathname === '/' || pathname === '/login';

    // If session is active on landing or login page, redirect to /chat
    if (isAuthPage && status === 'authenticated') {
      router.replace('/chat');
      return;
    }

    // Set up BroadcastChannel and Storage listener for multi-tab sync
    let authChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      authChannel = new BroadcastChannel('cognexa_auth_sync');
      authChannel.onmessage = (event) => {
        if (event.data === 'login_success' || event.data === 'session_changed') {
          update().then((newSession) => {
            if (newSession?.user && isAuthPage) {
              router.replace('/chat');
            }
          });
        }
      };
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cognexa_login_event' && isAuthPage) {
        update().then((newSession) => {
          if (newSession?.user) {
            router.replace('/chat');
          }
        });
      }
    };

    const handleFocus = () => {
      if (isAuthPage) {
        update().then((newSession) => {
          if (newSession?.user) {
            router.replace('/chat');
          }
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      if (authChannel) authChannel.close();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [status, pathname, router, update]);

  return null;
}

export function notifyLoginSuccess() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cognexa_login_event', Date.now().toString());
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('cognexa_auth_sync');
      channel.postMessage('login_success');
      channel.close();
    }
  }
}
