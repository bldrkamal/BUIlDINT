import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyDWEQtZWGdcgvsVzM84DJomkk-d0cCTrf4";

if (!apiKey) {
    console.error("No API Key found");
    process.exit(1);
}

console.log("Testing Gemini API with key ending in:", apiKey.slice(-4));

const ai = new GoogleGenAI({ apiKey });

async function testGemini() {
    try {
        // 1x1 white pixel jpeg base64
        const dummyImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

        console.log("Attempting to generate content with model: gemini-2.5-flash");

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: dummyImage
                            }
                        },
                        {
                            text: "Describe this image."
                        }
                    ]
                }
            ]
        });

        console.log("Response received!");
        console.log(response.text);

    } catch (error: any) {
        console.error("Error testing Gemini API:");
        console.error(error.message);
    }
}

testGemini();
