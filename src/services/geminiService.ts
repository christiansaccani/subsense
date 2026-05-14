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
  async analyzeScreenTime(base64Image: string, mimeType: string, isPremium: boolean): Promise<AnalyzedApp[]> {
    if (!isPremium) {
      throw new Error("Premium account required for AI analysis.");
    }

    if (this.isAnalyzing) {
      throw new Error("An analysis is already in progress.");
    }
    
    this.isAnalyzing = true;

    const prompt = `Carefully analyze this screenshot of Apple Screen Time (iOS) or Digital Wellbeing (Android). 
    IMPORTANT: The user has been asked to provide a WEEKLY activity screenshot.
    
    1. Identify ONLY apps or services that are CLEARLY VISIBLE in the provided screenshot.
    2. Extract the usage time per week.
    3. Convert that time into 'usageHoursPerWeek'.
    4. Map the usage to a 'UsageFrequency' value strictly following this scale:
       - 'never': 0 hours/week (only if listed with 0 or explicitly mentioned as unused)
       - 'rarely': < 2 hours/week
       - 'often': 2 to 5 hours/week
       - 'always': More than 5 hours/week
    
    5. 'usageTimeLabel' must be the exact string visible from the UI (e.g. "1h 45m").
    
    CRITICAL: Do not guess or infer apps that are not visible. If an app is not in the screenshot, do not include it in the results.
    Return a JSON array of objects.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
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

      this.isAnalyzing = false;
      const text = response.text || '[]';
      return JSON.parse(text);
    } catch (error: any) {
      console.error("Gemini analysis failed:", error);
      this.isAnalyzing = false; // Reset guard
      if (error?.message?.includes('429') || error?.status === 429 || error?.message?.toLowerCase().includes('rate limit')) {
        throw new Error("Limite di richieste raggiunto (Rate Limit). Riprova tra un minuto per favore.");
      }
      throw new Error("Errore durante l'analisi dell'immagine. Riprova.");
    }
  },
  isAnalyzing: false
};
