import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatLayoutClient from './LayoutClient';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const session = await auth();

  if (!session || !session.user) {
    redirect('/');
  }


  console.log("DEBUG: Active session user ID =", session.user.id);

  // Fetch all chats for the authenticated user
  const { data: chats } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });

  // Fetch user profile on the server side to prevent rendering lag
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, mfa_enabled')
    .eq('id', session.user.id)
    .maybeSingle();

  return (
    <ChatLayoutClient 
      chats={chats || []} 
      userEmail={session.user.email ?? ''}
      defaultName={session.user.name ?? ''}
      defaultImage={session.user.image ?? ''}
      initialNickname={profile?.nickname || null}
      initialAvatarUrl={profile?.avatar_url || null}
      initialMfaEnabled={profile?.mfa_enabled || false}
    >
      {children}
    </ChatLayoutClient>
  );
}
