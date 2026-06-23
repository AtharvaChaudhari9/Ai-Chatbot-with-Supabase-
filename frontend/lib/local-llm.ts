export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Generates response from Local LLM (Ollama) using the history of the conversation.
 */
export async function generateLocalLLMResponse(
  history: ChatMessage[],
  currentPrompt: string,
  url?: string,
  modelName?: string
) {
  // Map messages to Ollama chat format
  const messages = [
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
    {
      role: 'user',
      content: currentPrompt,
    },
  ];

  let targetUrl = url?.trim() || process.env.LOCAL_LLM_URL || 'http://127.0.0.1:11434';
  if ((targetUrl.includes('127.0.0.1') || targetUrl.includes('localhost')) && process.env.LOCAL_LLM_URL) {
    targetUrl = process.env.LOCAL_LLM_URL;
  }
  const targetModel = modelName?.trim() || process.env.LOCAL_LLM_MODEL || 'llama3.2';

  try {
    // Call Ollama local endpoint
    const response = await fetch(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API responded with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data.message || !data.message.content) {
      throw new Error('Ollama API returned an empty or invalid message content.');
    }

    return data.message.content;
  } catch (error: any) {
    console.error('Error generating content from Local LLM:', error);
    throw new Error(
      `Failed to reach Local LLM. Please make sure Ollama is running at "${targetUrl}" and you have run \`ollama pull ${targetModel}\`. (Error: ${error.message})`
    );
  }
}
