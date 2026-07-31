'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function SessionSync() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isAuthPage = pathname === '/' || pathname === '/login';
    const isChatPage = pathname.startsWith('/chat');

    // If user is currently on /chat and authenticated, broadcast login success to all other tabs
    if (isChatPage && status === 'authenticated') {
      notifyLoginSuccess();
    }

    // Set up BroadcastChannel and Storage listener for multi-tab sync
    let authChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      authChannel = new BroadcastChannel('cognexa_auth_sync');
      authChannel.onmessage = (event) => {
        if (event.data === 'logout_event') {
          sessionStorage.setItem('cognexa_force_logout', 'true');
          signOut({ redirect: false });
          return;
        }

        if (event.data === 'login_success' || event.data === 'session_changed') {
          sessionStorage.removeItem('cognexa_force_logout');
          update().then((newSession) => {
            if (newSession?.user && isAuthPage) {
              router.replace('/chat');
            }
          });
        }
      };
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cognexa_logout_event') {
        sessionStorage.setItem('cognexa_force_logout', 'true');
        signOut({ redirect: false });
        return;
      }

      if (e.key === 'cognexa_login_event') {
        sessionStorage.removeItem('cognexa_force_logout');
        update().then((newSession) => {
          if (newSession?.user && isAuthPage) {
            router.replace('/chat');
          }
        });
      }
    };

    const handleFocus = () => {
      update().then((newSession) => {
        if (newSession?.user) {
          sessionStorage.removeItem('cognexa_force_logout');
          if (isAuthPage) {
            router.replace('/chat');
          }
        }
      });
    };

    // On initial mount or page load of landing/login, check if user session is active
    if (isAuthPage) {
      update().then((currentSession) => {
        if (currentSession?.user) {
          sessionStorage.removeItem('cognexa_force_logout');
          router.replace('/chat');
        } else {
          const searchParams = new URLSearchParams(window.location.search);
          const isForceLogout =
            sessionStorage.getItem('cognexa_force_logout') === 'true' ||
            searchParams.get('prompt') === 'login';

          if (isForceLogout && status === 'authenticated') {
            signOut({ redirect: false });
          }
        }
      });
    }

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
    sessionStorage.removeItem('cognexa_force_logout');
    localStorage.setItem('cognexa_login_event', Date.now().toString());
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('cognexa_auth_sync');
      channel.postMessage('login_success');
      channel.close();
    }
  }
}
