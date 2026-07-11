import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatClient from './ChatClient';
import { auth } from '@/auth';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChatPage({ params, searchParams }: PageProps) {
  // Await params and searchParams per Next.js 15+ / 16 guidelines
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const prompt = resolvedSearchParams?.prompt;

  const supabase = await createClient();

  // Validate user authentication session
  const session = await auth();

  if (!session || !session.user) {
    redirect('/');
  }

  // Fetch the chat session metadata (making sure the user owns it)
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (chatError || !chat) {
    notFound();
  }


  // Fetch past messages ordered chronologically
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', id)
    .order('created_at', { ascending: true });

  return (
    <ChatClient
      chatId={id}
      chatTitle={chat.title}
      agentId={chat.agent_id}
      initialMessages={messages || []}
      initialPrompt={typeof prompt === 'string' ? prompt : undefined}
    />
  );
}
