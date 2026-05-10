import { GoogleGenAI, Type } from "@google/genai";
import { UsageFrequency } from "../types";

// Always use process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AnalyzedApp {
  name: string;
  usageHoursPerWeek: number;
  frequency: UsageFrequency;
  usageTimeLabel: string;
}

export const geminiService = {
  async analyzeScreenTime(base64Image: string, mimeType: string): Promise<AnalyzedApp[]> {
    const prompt = `Carefully analyze this screenshot of Apple Screen Time (iOS) or Digital Wellbeing (Android). 
    IMPORTANT: The user has been asked to provide a WEEKLY activity screenshot.
    
    1. Identify EVERY app or service listed.
    2. Extract the usage time per week.
    3. Convert that time into 'usageHoursPerWeek'.
    4. Map the usage to a 'UsageFrequency' value strictly following this scale:
       - 'never': 0 hours/week
       - 'rarely': < 2 hours/week
       - 'often': 2 to 5 hours/week
       - 'always': More than 5 hours/week
    
    5. 'usageTimeLabel' should be the exact string from the UI (e.g. "1h 45m").
    
    Be extremely thorough. Look for app icons and text.
    Return a JSON array of objects.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                usageHoursPerWeek: { type: Type.NUMBER },
                usageTimeLabel: { type: Type.STRING, description: "The exact time string from the UI, e.g. '1h 45m'" },
                frequency: { 
                  type: Type.STRING, 
                  enum: ['never', 'rarely', 'often', 'always'] 
                }
              },
              required: ['name', 'frequency', 'usageTimeLabel']
            }
          }
        }
      });

      const text = response.text || '[]';
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      return [];
    }
  }
};
