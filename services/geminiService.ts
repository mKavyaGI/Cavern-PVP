import { GoogleGenAI, Type } from "@google/genai";
import { Platform } from "../types";

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateLevel = async (): Promise<Platform[]> => {
  try {
    const model = "gemini-2.5-flash";
    const prompt = `
      Generate a 2D platformer level design as a JSON array.
      The level should be horizontal, starting at x=0 and extending to x=4000.
      The platforms should create a challenging but playable path.
      Include a "floor" platform at the very beginning (x=0, y=500, width=400) to start safely.
      
      Platforms must have:
      - x (number)
      - y (number, typically between 200 and 600)
      - width (number, typically 50-200)
      - height (number, typically 20-40)
      
      Ensure gaps are jumpable (max gap ~150px).
      Vary the height (y) to create verticality.
      Return roughly 20-30 platforms.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
            },
            required: ["x", "y", "width", "height"],
          },
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      // Add unique IDs
      return data.map((p: any, index: number) => ({ ...p, id: `plat-${index}` }));
    }
    
    throw new Error("No data returned");
  } catch (error) {
    console.error("Gemini Level Gen Error, using fallback:", error);
    // Fallback level
    return [
      { id: "start", x: 50, y: 400, width: 400, height: 40 },
      { id: "1", x: 500, y: 350, width: 150, height: 30 },
      { id: "2", x: 700, y: 450, width: 150, height: 30 },
      { id: "3", x: 900, y: 300, width: 100, height: 30 },
      { id: "4", x: 1100, y: 400, width: 200, height: 30 },
      { id: "5", x: 1400, y: 350, width: 100, height: 30 },
      { id: "6", x: 1600, y: 250, width: 150, height: 30 },
      { id: "7", x: 1900, y: 400, width: 300, height: 30 },
      { id: "8", x: 2300, y: 350, width: 100, height: 30 },
      { id: "9", x: 2500, y: 250, width: 100, height: 30 },
      { id: "10", x: 2700, y: 350, width: 150, height: 30 },
      { id: "11", x: 3000, y: 400, width: 200, height: 30 },
      { id: "12", x: 3300, y: 300, width: 150, height: 30 },
      { id: "13", x: 3600, y: 400, width: 400, height: 30 }, // End platform
    ];
  }
};
