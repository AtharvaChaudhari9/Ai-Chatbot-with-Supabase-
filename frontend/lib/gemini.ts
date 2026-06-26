import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Generates response from Gemini model using the history of the conversation.
 */
export async function generateGeminiResponse(
  history: ChatMessage[],
  currentPrompt: string,
  systemInstruction?: string,
  modelName: string = 'gemini-2.5-flash'
) {
  // Map database roles ('user' | 'assistant') to Gemini SDK roles ('user' | 'model')
  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [{ text: currentPrompt }],
    },
  ];

  try {
    const config: Record<string, any> = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config,
    });

    return response.text || 'No response generated.';
  } catch (error: any) {
    console.error('Error generating content from Gemini API:', error);
    throw new Error(error.message || 'Gemini API invocation failed.');
  }
}
