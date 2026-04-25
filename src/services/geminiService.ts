import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DetailedLocation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  type: string;
}

export async function parseLocation(query: string): Promise<DetailedLocation> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Find the precise latitude and longitude for the location: "${query}". 
    It could be a zip code, landmark, city, GPS coordinates, or town.
    Return a JSON object with the location name, lat, lon, country, and type (e.g., landmark, city, coordinates).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          lat: { type: Type.NUMBER },
          lon: { type: Type.NUMBER },
          country: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ["name", "lat", "lon", "country", "type"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function getFunFacts(location: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide 3 interesting fun facts about the weather or geography of ${location}. Output as a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text);
}
