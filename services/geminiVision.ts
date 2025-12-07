import { GoogleGenAI } from "@google/genai";
import { GeminiFloorPlanResponse } from '../types/gemini';

export const GEMINI_SYSTEM_PROMPT = `
You are an expert architectural AI specialized in analyzing floor plan images. Your task is to extract COMPLETE building geometry including walls, doors, windows, and dimensions.

## Input
An image of a floor plan (sketch, CAD drawing, or architectural plan).

## Output
A strictly formatted JSON object with walls, openings (doors/windows), and scale information.

## CRITICAL INSTRUCTIONS

### 1. WALL DETECTION
- Trace ALL wall segments carefully - the complete outline of the building
- External walls (outer boundary) = type "wall" (225mm thick)
- Internal/partition walls = type "partition" (150mm thick)
- Each wall segment must be straight (split at corners/junctions)
- Include ALL walls, not just some

### 2. DOOR DETECTION
Doors appear as:
- Gaps in walls with an arc (swing arc symbol)
- Single/double lines across wall openings
- "D" or door symbols
Standard door widths: 750mm, 800mm, 900mm, 1000mm, 1200mm (double)

### 3. WINDOW DETECTION
Windows appear as:
- Three parallel lines across walls
- Rectangular shapes within walls
- "W" or window symbols
Standard window widths: 600mm, 900mm, 1200mm, 1500mm, 1800mm

### 4. DIMENSION READING
- Look for ALL dimension annotations (numbers like 3.5m, 4000, 12'-6")
- Read scale bars if present
- Extract room labels and areas if shown

## Coordinate System
- Normalized: (0,0) = top-left, (1000,1000) = bottom-right
- All coordinates as integers 0-1000
- Maintain correct proportions and relative positions

## JSON Structure (RETURN ONLY THIS, NO MARKDOWN):
{
  "walls": [
    {
      "start": { "x": 50, "y": 100 },
      "end": { "x": 450, "y": 100 },
      "thickness": 225,
      "type": "wall",
      "confidence": 0.95,
      "lengthMM": 4000
    }
  ],
  "openings": [
    {
      "type": "door",
      "position": { "x": 200, "y": 100 },
      "widthMM": 900,
      "heightMM": 2100,
      "wallIndex": 0,
      "swingDirection": "left",
      "confidence": 0.9
    },
    {
      "type": "window",
      "position": { "x": 350, "y": 100 },
      "widthMM": 1200,
      "heightMM": 1200,
      "wallIndex": 0,
      "confidence": 0.85
    }
  ],
  "scaleReference": {
    "start": { "x": 100, "y": 900 },
    "end": { "x": 400, "y": 900 },
    "realWorldLength": 5000,
    "unit": "mm"
  },
  "estimatedScale": 75,
  "dimensions": [
    { "text": "4.5m", "value": 4500, "unit": "mm" }
  ],
  "roomCount": 4,
  "totalAreaM2": 120,
  "summary": "3-bedroom house with living room, kitchen, 2 bathrooms. Approximately 120m². Main entrance on south wall."
}

## IMPORTANT
- The "position" of openings is where the door/window center is located (on the wall line)
- "wallIndex" refers to the index in the walls array (0-based)
- Include EVERY wall, door, and window you can identify
- Be thorough - this data is used for accurate construction cost estimation
`;

/**
 * Analyzes an image using the Gemini API.
 * @param imageBase64 The base64 encoded image string (without the data:image/... prefix)
 * @param apiKey The Google Gemini API Key
 * @param model The Gemini model to use (default: gemini-2.5-flash, alternate: gemini-3-pro-preview)
 */
export async function analyzeImageWithGemini(
  imageBase64: string,
  apiKey: string,
  model: string = 'gemini-2.5-flash'
): Promise<GeminiFloorPlanResponse> {
  if (!apiKey) {
    throw new Error("API Key is required for Gemini analysis.");
  }

  console.log('Initializing Gemini API...');
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Sending image to Gemini (Model: ${model})...`);

  try {
    const response = await ai.models.generateContent({
      model: model,
      config: {
        systemInstruction: GEMINI_SYSTEM_PROMPT,
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              text: `Analyze this floor plan image thoroughly:

STEP 1: TRACE THE COMPLETE BUILDING OUTLINE
- Start from top-left and trace ALL exterior walls clockwise
- Then identify ALL interior partition walls
- Each wall segment should be from corner to corner

STEP 2: IDENTIFY ALL OPENINGS
- Find EVERY door (look for swing arcs, gaps with arcs)
- Find EVERY window (look for triple lines, rectangular symbols)
- Note their positions on which wall

STEP 3: READ ALL DIMENSIONS
- Scan for dimension lines with numbers
- Look for scale indicators
- Extract room labels and areas if shown

STEP 4: ESTIMATE SCALE
- If dimensions are shown, use them to calculate exact scale
- Otherwise estimate based on typical room sizes (bedrooms ~12m², living ~20m²)

Return the COMPLETE JSON with:
- ALL walls forming the complete floor plan shape
- ALL doors with their swing directions
- ALL windows with their sizes
- Scale reference if dimension lines are visible
- Room count and total area estimate

Be precise and thorough - missing walls will result in incorrect construction estimates!`
            }
          ]
        }
      ]
    });

    const text = response.text;
    console.log("Gemini Raw Response:", text);

    if (!text) throw new Error("No response text generated.");

    // Clean up potential markdown code blocks
    let jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Try to extract JSON if there's text before/after
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    const data = JSON.parse(jsonString) as GeminiFloorPlanResponse;

    // Log extracted data for debugging
    console.log(`Extracted: ${data.walls?.length || 0} walls, ${data.openings?.length || 0} openings`);
    if (data.dimensions) {
      console.log("Detected Dimensions:", data.dimensions);
    }
    if (data.roomCount) {
      console.log(`Rooms: ${data.roomCount}, Area: ${data.totalAreaM2}m²`);
    }

    return data;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const msg = error.message || "Unknown error";
    if (msg.includes("429") || msg.includes("quota")) {
      throw new Error("Gemini API Quota Exceeded. Please try again later or check your plan.");
    } else if (msg.includes("404") || msg.includes("not found")) {
      throw new Error("Gemini Model Not Found. Please check the model name.");
    }
    throw new Error(`Failed to analyze image: ${msg}`);
  }
}
