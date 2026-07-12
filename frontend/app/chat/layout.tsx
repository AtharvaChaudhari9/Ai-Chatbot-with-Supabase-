import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatLayoutClient from './LayoutClient';
import { auth } from '@/auth';

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


  // Fetch all chats for the authenticated user
  const { data: chats } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });

  return (
    <ChatLayoutClient chats={chats || []} userEmail={session.user.email ?? ''}>
      {children}
    </ChatLayoutClient>
  );
}
