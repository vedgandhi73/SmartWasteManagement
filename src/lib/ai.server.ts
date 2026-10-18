import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Sends a prompt + image to Lovable AI and returns the parsed JSON object it answers with. */
export async function analyzeImageJson<T>(prompt: string, imageDataUrl: string): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new AiError(401, "AI is not configured.");
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt + "\nRespond with ONLY a JSON object, no markdown." },
          { type: "image", image: imageDataUrl },
        ],
      },
    ],
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  if (failure || !text) {
    const status = (failure as { statusCode?: number })?.statusCode ?? 500;
    console.error("AI call failed", failure);
    if (status === 402) throw new AiError(402, "AI credits are used up. Please top up to keep verifying photos.");
    if (status === 429) throw new AiError(429, "The AI is busy right now. Please try again in a minute.");
    throw new AiError(status, "The photo couldn't be analyzed. Please try again.");
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new AiError(500, "The AI response couldn't be read. Please try another photo.");
  return JSON.parse(match[0]) as T;
}
