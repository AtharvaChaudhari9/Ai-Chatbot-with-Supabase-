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

    const { chatId, prompt, model, localUrl, localModel } = await request.json();
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

    // Perform semantic search (RAG) context retrieval if documents exist for this chat session
    let enrichedPrompt = prompt;
    try {
      const { count, error: countError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .eq('user_id', user.id);

      if (!countError && count && count > 0) {
        // Generate embedding for the user query using Python backend
        const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
        const embedRes = await fetch(`${pythonBackendUrl}/api/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: prompt }),
        });

        if (!embedRes.ok) {
          throw new Error(`Python embedding service returned status ${embedRes.status}`);
        }

        const embedData = await embedRes.json();
        const queryEmbedding = embedData.embedding;
        if (queryEmbedding) {
          // Query database via pgvector match function RPC
          const { data: matchedChunks, error: matchError } = await supabase.rpc(
            'match_document_chunks',
            {
              query_embedding: queryEmbedding,
              match_threshold: 0.2, // Similarity threshold
              match_count: 5,       // Top 5 chunks
              filter_chat_id: chatId,
              filter_user_id: user.id,
            }
          );

          if (!matchError && matchedChunks && matchedChunks.length > 0) {
            const contextText = matchedChunks
              .map((c: any) => `[Document Chunk]:\n${c.content}`)
              .join('\n\n');

            enrichedPrompt = `You are a helpful assistant. Use the following retrieved document context chunks to answer the user's question. If you cannot find the answer in the provided context, answer using your general knowledge but clearly state that the information was not in the provided documents.

Retrieved Context Chunks:
---
${contextText}
---

User Question: ${prompt}`;
          }
        }
      }
    } catch (ragErr) {
      console.warn('RAG Context retrieval failed, falling back to standard prompt:', ragErr);
    }

    // Call Gemini or Local LLM based on selection
    let aiResponse: string;
    if (model === 'local') {
      const { generateLocalLLMResponse } = await import('@/lib/local-llm');
      aiResponse = await generateLocalLLMResponse(
        messages || [],
        enrichedPrompt,
        localUrl,
        localModel
      );
    } else {
      aiResponse = await generateGeminiResponse(
        messages || [],
        enrichedPrompt
      );
    }

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
