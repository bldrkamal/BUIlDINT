
import { calculateFloorArea } from './utils/geometry';
import { Wall } from './types';

// Mock Wall
const createWall = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
    id,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 225,
    height: 3000
});

// Case 1: Single Room (100x100)
const wallsSingle: Wall[] = [
    createWall('w1', 0, 0, 100, 0),
    createWall('w2', 100, 0, 100, 100),
    createWall('w3', 100, 100, 0, 100),
    createWall('w4', 0, 100, 0, 0)
];

console.log("--- Case 1: Single Room ---");
const areaSingle = calculateFloorArea(wallsSingle, 1);
console.log(`Calculated Area: ${areaSingle}`);
console.log(`Expected Area: 10000`);

if (Math.abs(areaSingle - 10000) < 1) {
    console.log("PASS: Single room area correct.");
} else {
    console.log("FAIL: Single room area incorrect.");
}

// Case 2: Two Rooms Sharing a Wall
// Room 1: (0,0) to (100,100)
// Room 2: (100,0) to (200,100)
// Shared Wall: (100,0) to (100,100)
const wallsShared: Wall[] = [
    createWall('w1', 0, 0, 100, 0),
    createWall('w2', 100, 0, 100, 100), // Shared
    createWall('w3', 100, 100, 0, 100),
    createWall('w4', 0, 100, 0, 0),
    createWall('w5', 100, 0, 200, 0),
    createWall('w6', 200, 0, 200, 100),
    createWall('w7', 200, 100, 100, 100)
];

console.log("\n--- Case 2: Shared Wall ---");
const areaShared = calculateFloorArea(wallsShared, 1);
console.log(`Calculated Area: ${areaShared}`);
console.log(`Expected Area: 20000`);

if (Math.abs(areaShared - 20000) < 1) {
    console.log("PASS: Shared wall area correct.");
} else {
    console.log("FAIL: Shared wall area incorrect.");
}

// Case 3: Gap (10px) - Should be closed by threshold (20px)
const wallsGap10: Wall[] = [
    createWall('w1', 0, 0, 100, 0),
    createWall('w2', 100, 0, 100, 90), // Gap of 10px to (100,100)
    createWall('w3', 100, 100, 0, 100),
    createWall('w4', 0, 100, 0, 0)
];

console.log("\n--- Case 3: Gap 10px ---");
const areaGap10 = calculateFloorArea(wallsGap10, 1);
console.log(`Calculated Area: ${areaGap10}`);
console.log(`Expected Area: 10000 (approx)`);

if (areaGap10 > 9000) {
    console.log("PASS: Small gap closed.");
} else {
    console.log("FAIL: Small gap NOT closed.");
}

// Case 4: Gap (30px) - Should NOT be closed (Threshold 20px)
const wallsGap30: Wall[] = [
    createWall('w1', 0, 0, 100, 0),
    createWall('w2', 100, 0, 100, 70), // Gap of 30px
    createWall('w3', 100, 100, 0, 100),
    createWall('w4', 0, 100, 0, 0)
];

console.log("\n--- Case 4: Gap 30px ---");
const areaGap30 = calculateFloorArea(wallsGap30, 1);
console.log(`Calculated Area: ${areaGap30}`);
console.log(`Expected Area: 0 (Gap too large)`);

if (areaGap30 === 0) {
    console.log("PASS: Large gap correctly ignored.");
} else {
    console.log("FAIL: Large gap incorrectly closed.");
}

// Case 5: Hashtag (Overshooting Intersections)
const wallsHashtag: Wall[] = [
    createWall('v1', 100, 0, 100, 300),
    createWall('v2', 200, 0, 200, 300),
    createWall('h1', 0, 100, 300, 100),
    createWall('h2', 0, 200, 300, 200)
];

console.log("\n--- Case 5: Hashtag (Overshooting Intersections) ---");
const areaHashtag = calculateFloorArea(wallsHashtag, 1);
console.log(`Calculated Area: ${areaHashtag}`);
console.log(`Expected Area: 10000`);

if (Math.abs(areaHashtag - 10000) < 100) {
    console.log("PASS: Hashtag intersection handled.");
} else {
    console.log("FAIL: Hashtag intersection NOT handled.");
}
