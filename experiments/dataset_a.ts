
import { Wall, Point } from '../types';
import { wallToPolygon, computeUnion, calculateMultiPolygonArea, distance } from '../utils/geometry';

// CONSTANTS in geometry.ts
const SCALE = 0.05; // 1px = 20mm
const CONVERSION_FACTOR = 1 / SCALE;

console.log("experiment: Dataset A (Synthetic Primitive Benchmark)");
console.log("====================================================");

// Helper: deg to rad
const rad = (deg: number) => deg * (Math.PI / 180);

interface TestCase {
    name: string;
    walls: Wall[];
    angle: number;
    expectedArea?: number;
}

// Fixed Dimensions
// Wall Length = 2m = 2000mm = 100px
// Wall Thickness = 225mm
const L_mm = 2000;
const W_mm = 225;
const L_px = L_mm * SCALE;
const W_px = W_mm * SCALE;

// Origin
const O: Point = { x: 500, y: 500 };

const createJunction = (angleDeg: number, type: 'L' | 'X' | 'T'): Wall[] => {
    const walls: Wall[] = [];
    const id = () => Math.random().toString(36).substr(2, 5);

    // Wall 1: Horizontal (Fixed)
    // For L and T, starts at Origin. For X, Origin is center.

    if (type === 'X') {
        // Horizontal crossing origin
        walls.push({
            id: id(),
            start: { x: O.x - L_px / 2, y: O.y },
            end: { x: O.x + L_px / 2, y: O.y },
            thickness: W_mm,
            height: 3000, type: 'wall'
        });
    } else {
        // Horizontal starting at origin
        walls.push({
            id: id(),
            start: O,
            end: { x: O.x + L_px, y: O.y },
            thickness: W_mm,
            height: 3000, type: 'wall'
        });
    }

    // Wall 2: Angled
    const theta = rad(angleDeg);
    const dx = Math.cos(theta) * L_px;
    const dy = Math.sin(theta) * L_px;

    if (type === 'X') {
        // Crossing at origin
        const dx2 = Math.cos(theta) * (L_px / 2);
        const dy2 = Math.sin(theta) * (L_px / 2);
        walls.push({
            id: id(),
            start: { x: O.x - dx2, y: O.y - dy2 },
            end: { x: O.x + dx2, y: O.y + dy2 },
            thickness: W_mm,
            height: 3000, type: 'wall'
        });
    } else {
        // Starting at origin (L or T)
        walls.push({
            id: id(),
            start: O,
            end: { x: O.x + dx, y: O.y + dy },
            thickness: W_mm,
            height: 3000, type: 'wall'
        });

        // For T junction, we need the "Top" bar of the T to be continuous? 
        // Definition: T-Junction usually means one wall terminates into the midpoint of another.
        // Let's redefine T strictly: Wall 1 Horizontal centered at O. Wall 2 Vertical starting at O going down.
        if (type === 'T') {
            // Override - Wall 1 is the Top Bar (Horizontal centered)
            walls[0] = {
                id: id(),
                start: { x: O.x - L_px / 2, y: O.y },
                end: { x: O.x + L_px / 2, y: O.y },
                thickness: W_mm,
                height: 3000, type: 'wall'
            };
            // Wall 2 is the Stem (Vertical down) angle 90
            walls[1] = {
                id: id(),
                start: O,
                end: { x: O.x, y: O.y + L_px }, // 90 deg down
                thickness: W_mm,
                height: 3000, type: 'wall'
            };
        }
    }

    return walls;
};

// Theoretical Area Calculation
const calculateExactArea = (type: 'L' | 'X' | 'T', angleDeg: number): number => {
    // Area of one wall = L * W (in meters)
    const L_m = L_mm / 1000;
    const W_m = W_mm / 1000;
    const Area1 = L_m * W_m;
    const Area2 = L_m * W_m;

    const rads = rad(angleDeg);
    const sinTheta = Math.sin(rads);

    // Safety
    if (Math.abs(sinTheta) < 1e-6) return Math.max(Area1, Area2);

    let overlap = 0;

    if (type === 'X') {
        // Full Crossing: Parallelogram
        // Area = W^2 / sin(theta)
        overlap = (W_m * W_m) / Math.abs(sinTheta);
    } else if (type === 'T') {
        // T-Junction (90 deg T: W * W/2)
        if (Math.abs(angleDeg - 90) < 1) {
            overlap = (W_m * W_m) / 2;
        } else {
            // Fallback for non-90 T
            return 0;
        }
    } else if (type === 'L') {
        // Corner Junction (Starts at same point)
        // For 90: W^2 / 4. 
        overlap = (W_m * W_m) / (4 * Math.abs(sinTheta));
    }

    return Area1 + Area2 - overlap;
};

const runTest = (name: string, type: 'L' | 'X' | 'T', angle: number) => {
    const walls = createJunction(angle, type);

    // CSG (Actual)
    const polys = walls.map(wallToPolygon);
    const union = computeUnion(polys);
    const csgArea = calculateMultiPolygonArea(union);

    // Theoretical (Expected)
    const expected = calculateExactArea(type, angle);

    let errorPercent = 0;
    if (expected > 0) {
        const error = Math.abs(csgArea - expected);
        errorPercent = (error / expected) * 100;
    }

    console.log(`Test: ${name.padEnd(20)} | Angle: ${angle}° | Expected: ${expected > 0 ? expected.toFixed(4) : "N/A   "} m² | Actual: ${csgArea.toFixed(4)} m² | Error: ${expected > 0 ? errorPercent.toFixed(4) + "%" : "N/A"}`);
};

// --- RUN TESTS ---
runTest("L-Junction 90", 'L', 90);
runTest("T-Junction 90", 'T', 90);
runTest("X-Junction 90", 'X', 90);

// Acute
runTest("Acute L 45", 'L', 45);
runTest("Acute X 45", 'X', 45); // < 45 might be problematic?
runTest("Acute L 30", 'L', 30);

// Obtuse
runTest("Obtuse L 135", 'L', 135);
runTest("Obtuse X 135", 'X', 135);
runTest("Obtuse L 150", 'L', 150);

// Near Parallel (Edge case)
runTest("Acute L 10", 'L', 10);
