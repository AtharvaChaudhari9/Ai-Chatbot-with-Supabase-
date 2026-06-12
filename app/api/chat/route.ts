import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateGeminiResponse } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, prompt } = await request.json();
    if (!chatId || !prompt) {
      return NextResponse.json({ error: 'Missing chatId or prompt' }, { status: 400 });
    }

    // Verify user owns the chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Fetch existing message history ordered by created_at ascending
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    // Save user message to database first
    const { error: userMsgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'user',
        content: prompt,
      });

    if (userMsgError) {
      return NextResponse.json({ error: 'Failed to save user message' }, { status: 500 });
    }

    // Call Gemini API with complete chat history
    const aiResponse = await generateGeminiResponse(
      messages || [],
      prompt
    );

    // Save AI response to database
    const { error: assistantMsgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: aiResponse,
      });

    if (assistantMsgError) {
      return NextResponse.json({ error: 'Failed to save AI response' }, { status: 500 });
    }

    // Autogenerate a clean title if this was a new chat with default title
    let newTitle: string | undefined;
    if (chat.title === 'New Chat') {
      newTitle = prompt.trim().substring(0, 32);
      if (prompt.trim().length > 32) newTitle += '...';
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (newTitle) {
      updatePayload.title = newTitle;
    }

    await supabase
      .from('chats')
      .update(updatePayload)
      .eq('id', chatId);

    return NextResponse.json({
      role: 'assistant',
      content: aiResponse,
      chatTitle: newTitle,
    });
  } catch (error: any) {
    console.error('API Error in /api/chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
