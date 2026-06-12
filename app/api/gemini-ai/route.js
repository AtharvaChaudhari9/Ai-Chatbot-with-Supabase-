import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
    try {
        const { message } = await request.json();

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: message,
        });

        return NextResponse.json({
            response: response.text,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}