import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateGeminiResponse } from '@/lib/gemini';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, prompt, model, localUrl, localModel } = await request.json();
    if (!chatId || !prompt) {
      return NextResponse.json({ error: 'Missing chatId or prompt' }, { status: 400 });
    }

    // Verify user owns the chat and select agent_id
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title, agent_id')
      .eq('id', chatId)
      .eq('user_id', session.user.id)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Retrieve agent configuration if this chat is linked to a custom agent
    let activeModel = model;
    let activeLocalModel = localModel;
    let systemPrompt = undefined;
    const agentId = chat.agent_id;

    if (agentId) {
      const { data: agent } = await supabase
        .from('custom_agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', session.user.id)
        .single();

      
      if (agent) {
        activeModel = agent.preferred_model || model;
        activeLocalModel = agent.local_model_name || localModel;
        systemPrompt = agent.system_prompt || undefined;
      }
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

    // Query documents for chat session and custom agent (RAG context integration)
    let docQuery = supabase
      .from('documents')
      .select('id')
      .eq('user_id', session.user.id);

    if (agentId) {
      docQuery = docQuery.or(`chat_id.eq.${chatId},agent_id.eq.${agentId}`);
    } else {
      docQuery = docQuery.eq('chat_id', chatId);
    }

    const { data: docs } = await docQuery;
    const docIds = docs?.map((d) => d.id) || [];

    let enrichedPrompt = prompt;
    if (docIds.length > 0) {
      try {
        // Retrieve relevant document chunks from python backend using Qdrant similarity search
        const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
        const token = session.accessToken;

        const retrieveRes = await fetch(`${pythonBackendUrl}/api/retrieve-chunks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            query: prompt,
            user_id: session.user.id,
            document_ids: docIds,
            k: 5
          }),
        });


        if (!retrieveRes.ok) {
          throw new Error(`Python retrieve-chunks service returned status ${retrieveRes.status}`);
        }

        const retrieveData = await retrieveRes.json();
        const matchedChunks = retrieveData.chunks;

        if (matchedChunks && matchedChunks.length > 0) {
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
      } catch (ragErr) {
        console.warn('RAG Context retrieval failed, falling back to standard prompt:', ragErr);
      }
    }

    // Call Gemini or Local LLM based on selection
    let aiResponse: string;
    if (activeModel === 'local') {
      const { generateLocalLLMResponse } = await import('@/lib/local-llm');
      aiResponse = await generateLocalLLMResponse(
        messages || [],
        enrichedPrompt,
        localUrl,
        activeLocalModel,
        systemPrompt
      );
    } else {
      let targetGeminiModel = 'gemini-2.5-flash';
      if (activeModel && activeModel !== 'gemini' && activeModel !== 'local') {
        targetGeminiModel = activeModel;
      }
      aiResponse = await generateGeminiResponse(
        messages || [],
        enrichedPrompt,
        systemPrompt,
        targetGeminiModel
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
