import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateGeminiResponse } from '@/lib/gemini';
import { generateLocalLLMResponse } from '@/lib/local-llm';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    // 2. Parse request body
    const { roleName, roleDescription, systemPrompt, preferredModel, localModelName } = await request.json();

    if (!roleName || !roleName.trim()) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // 3. Construct prompt for prompt starters generation
    const generationPrompt = `You are a helper tool. Generate 4 conversation starter prompts (typical, helpful first questions a user would ask) for a specialized AI assistant that has the following details:
- Name: "${roleName}"
- Role Description: "${roleDescription || 'Not specified'}"
- System Instruction: "${systemPrompt || 'Not specified'}"

CRITICAL REQUIREMENTS:
- Output MUST be a valid JSON array of 4 strings (e.g., ["Prompt 1", "Prompt 2", "Prompt 3", "Prompt 4"]).
- Do NOT output any conversational text, explanations, markdown formatting, or HTML tags. Output ONLY the JSON array.
- Keep each starter prompt concise (under 50 characters).
- Make sure they are relevant to what this assistant is designed to do.`;

    let aiResponseText = '';

    if (preferredModel === 'local') {
      const targetModel = localModelName || 'llama3.2';
      // Call local LLM
      aiResponseText = await generateLocalLLMResponse([], generationPrompt, undefined, targetModel);
    } else {
      // Call Gemini API
      aiResponseText = await generateGeminiResponse([], generationPrompt);
    }

    // 4. Parse JSON list from response text
    let starters: string[] = [];
    try {
      // Clean potential LLM markdown blocks (e.g. ```json ... ```)
      let cleanedText = aiResponseText.trim();
      if (cleanedText.startsWith('```')) {
        // Strip out code block fences
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        starters = parsed.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5);
      }
    } catch (parseErr) {
      console.warn('Failed to parse starters response from LLM, falling back to regex extraction:', parseErr, aiResponseText);
      
      // Fallback: extract anything enclosed in quotes or lines starting with bullet points
      const lines = aiResponseText.split('\n');
      for (const line of lines) {
        const match = line.match(/"([^"]+)"/);
        if (match && match[1]) {
          starters.push(match[1].trim());
        }
      }
      
      // If we still have nothing, generate basic defaults
      if (starters.length === 0) {
        starters = [
          `Hi, how can I help you as a ${roleName}?`,
          `What are your main capabilities?`,
          `Give me an example of how you can help me.`
        ];
      }
    }

    // Double check size
    if (starters.length === 0) {
      starters = [
        `Review my project goals`,
        `Draft a simple query`,
        `Answer my specialized questions`
      ];
    }

    return NextResponse.json({ starters: starters.slice(0, 5) });
  } catch (err: any) {
    console.error('API Error in /api/agents/generate-starters:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
