
import { Wall } from './types';
import { wallToPolygon, computeUnion, calculateMultiPolygonArea } from './utils/geometry';

// Mock Wall
const createWall = (id: string, x1: number, y1: number, x2: number, y2: number, thick: number): Wall => ({
    id,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: thick,
    height: 3000
});

const runTest = () => {
    console.log("🧪 Testing CSG Logic...");

    // 1. Create T-Junction
    // Wall A: (0,0) to (100,0) [Horizontal, 20px thick]
    // Wall B: (50,0) to (50,100) [Vertical, 20px thick]
    // Scale is 0.05 (1px = 20mm), so 20px thick = 400mm
    // Let's use real mm inputs if wallToPolygon handles scale conversion.
    // wait, wallToPolygon divides by SCALE.
    // Input Wall coords are in PIXELS.

    const w1 = createWall('w1', 0, 100, 200, 100, 225); // Horizontal
    const w2 = createWall('w2', 100, 100, 100, 300, 225); // Vertical T from midpoint

    // 2. Convert to Polygons
    const p1 = wallToPolygon(w1);
    const p2 = wallToPolygon(w2);

    console.log("Polygon 1:", JSON.stringify(p1).slice(0, 50) + "...");

    // 3. Union
    const union = computeUnion([p1, p2]);
    const area = calculateMultiPolygonArea(union);

    console.log(`Union Area: ${area.toFixed(4)} m²`);

    // Expected Area Logic:
    // W1: Length 200px = 4m. Thickness 225mm = 0.225m. Area = 0.9 m2
    // W2: Length 200px = 4m. Thickness 0.225m. Area = 0.9 m2
    // Intersection: Square 225x225mm = 0.050625 m2
    // Expected Total = 1.8 - 0.050625 = 1.749...

    const len1 = (200 / 0.05) / 1000; // 4m
    const len2 = (200 / 0.05) / 1000; // 4m
    const thick = 0.225;

    const rawSum = (len1 * thick) + (len2 * thick);
    // Intersection is overlapping part.
    // W1 goes 0..200. W2 goes 100..300.
    // W2 starts exactly on W1 center line.
    // Intersection is 1/2 of junction?
    // Geometry: 
    // W1 Y range: 100 +/- (225/2 scaled).
    // W2 Y range: 100..300.
    // Overlap is Y: 100 to 100 + (225/2 scaled)? No, W2 starts at 100.
    // W1 covers Y from 100-HalfWidth to 100+HalfWidth.
    // W2 covers Y from 100 to 300.
    // So overlap is Y: [100, 100+HalfWidth]. ie Half intersection.

    // Actually, wallToPolygon expands centered on line.
    // W1 Y: 100 -> [100-w/2, 100+w/2]
    // W2 Y: 100..300. W2 X: 100 -> [100-w/2, 100+w/2]
    // Overlap Area = (Width) * (HalfWidth).

    const overlapArea = thick * (thick / 2); // 0.225 * 0.1125 = 0.0253...
    const expected = rawSum - overlapArea;

    console.log(`Expected (Approx): ${expected.toFixed(4)} m²`);

    if (Math.abs(area - expected) < 0.1) {
        console.log("✅ CSG Validation PASSED");
    } else {
        console.log("❌ CSG Validation FAILED: Deviation too large");
    }
};

runTest();
