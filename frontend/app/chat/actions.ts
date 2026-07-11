'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export async function createChat(agentId?: string) {
  const supabase = await createClient();
  const session = await auth();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  let title = 'New Chat';

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: session.user.id,
      title,
      agent_id: agentId || null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/chat', 'layout');
  redirect(`/chat/${data.id}`);
}

export async function renameChat(chatId: string, title: string) {
  const supabase = await createClient();
  const session = await auth();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('chats')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', chatId)
    .eq('user_id', session.user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/chat', 'layout');
}

export async function deleteChat(chatId: string) {
  const supabase = await createClient();
  const session = await auth();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', session.user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/chat', 'layout');
}

export async function getChats() {
  const supabase = await createClient();
  const session = await auth();
  if (!session || !session.user) return [];

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return [];
  return data;
}

export async function createChatAndGetId(agentId?: string) {
  const supabase = await createClient();
  const session = await auth();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  let title = 'New Chat';

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: session.user.id,
      title,
      agent_id: agentId || null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/chat', 'layout');
  return data.id;
}

export async function createMessage(chatId: string, role: 'user' | 'assistant', content: string) {
  const supabase = await createClient();
  const session = await auth();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  // Double check that the user owns the chat
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', session.user.id)
    .single();

  if (chatError || !chat) {
    throw new Error('Unauthorized or chat not found');
  }

  const { error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      role,
      content,
    });

  if (error) {
    throw new Error(error.message);
  }
}



