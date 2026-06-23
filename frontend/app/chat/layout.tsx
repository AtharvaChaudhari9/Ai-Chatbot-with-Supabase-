import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatLayoutClient from './LayoutClient';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // Fetch all chats for the authenticated user
  const { data: chats } = await supabase
    .from('chats')
    .select('*')
    .order('updated_at', { ascending: false });

  return (
    <ChatLayoutClient chats={chats || []} userEmail={user.email}>
      {children}
    </ChatLayoutClient>
  );
}
