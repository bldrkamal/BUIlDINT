
import { GoogleGenAI } from "@google/genai";
import { CalculationResult, ProjectSettings } from "../types";

export const getConstructionInsights = async (
  results: CalculationResult,
  settings: ProjectSettings
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Please configure your environment.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a senior Quantity Surveyor and Civil Engineer in Nigeria. 
    Analyze the following construction data for a residential building floor plan (bungalow).
    
    Data:
    - Total Net Wall Area: ${results.netArea.toFixed(2)} sq meters
    - Estimated Sandcrete Blocks (9-inch equivalent): ${results.blockCount} units
    - Block Size Used: ${settings.blockLength}mm x ${settings.blockHeight}mm
    - Wall Height: ${settings.wallHeightDefault}mm
    - Lintel Concrete Volume: ${results.concreteVolume.toFixed(2)} m3
    - Lintel Reinforcement Main: ${settings.mainBarCount} bars of Y${settings.mainBarDiameter}, Total Length: ${results.reinforcementMainLength.toFixed(1)} meters
    - Lintel Stirrups: Y${settings.stirrupBarDiameter}, Total Length: ${results.reinforcementStirrupLength.toFixed(1)} meters
    
    Please provide a concise estimation report in valid Markdown format including:
    1. **Cement Estimation**: Calculate bags of cement (Dangote/BUA 50kg) needed for:
       - Laying the blocks (Mortar mix ratio 1:6).
       - Rendering (Plastering) both sides of the walls (12mm thickness, ratio 1:4).
       - Concrete for Lintel (1:2:4 mix).
    2. **Sand & Granite**: Tons of sharp sand (for laying/concrete) and plaster sand (soft sand), plus Granite for lintel.
    3. **Reinforcement**: Confirm the steel bar estimates (Y${settings.mainBarDiameter} and Y${settings.stirrupBarDiameter}) and suggest binding wire quantity (kg).
    4. **Cost Advice**: Very brief current market trend advice for building materials in Nigeria (Generic advice, no specific prices needed unless typical ranges).

    Keep it professional, direct, and formatted for a builder to read.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate insights. Please try again later.";
  }
};
