
// ==========================================
// 1. SETUP PARAMETERS
// ==========================================
const THICKNESS = 0.225;  // 225mm Sandcrete Block
const HEIGHT = 3.0;       // 3m Height
// Standard scalar overlap volume for one intersection (t^2 * h)
const INTERSECTION_VOL = (THICKNESS ** 2) * HEIGHT;

// ==========================================
// 2. DEFINE THE ALGORITHMS
// ==========================================

interface Wall {
    length: number;
}

const calculate_naive = (walls: Wall[]): number => {
    /*
    The 'Naive' method simply sums the volume of every wall segment 
    as if they are independent bricks, ignoring overlaps.
    */
    let total_vol = 0;
    for (const w of walls) {
        const length = w.length;
        total_vol += length * THICKNESS * HEIGHT;
    }
    return total_vol;
};

const calculate_smm_centerline = (walls: Wall[], junctions: Record<string, number>): number => {
    /*
    The 'Standard Method of Measurement' (SMM) / Ground Truth.
    It calculates Gross Volume and manually deducts overlaps based on rules.
    L-Junction: Deduct 1x overlap
    T-Junction: Deduct 2x overlap
    Cross-Junction: Deduct 3x overlap
    */
    const gross_vol = calculate_naive(walls);
    let deduction = 0;

    for (const [j_type, count] of Object.entries(junctions)) {
        if (j_type === 'L') {
            deduction += count * (1 * INTERSECTION_VOL);
        } else if (j_type === 'T') {
            deduction += count * (2 * INTERSECTION_VOL);
        } else if (j_type === 'Cross') {
            deduction += count * (3 * INTERSECTION_VOL);
        }
    }

    return gross_vol - deduction;
};

const calculate_gt_oca = (walls: Wall[], nodes: number[]): number => {
    /*
    The 'Kamal GT-OCA' Algorithm.
    It uses Graph Theory Degrees.
    Formula: Correction = (Degree - 1) * t^2 * h
    */
    const gross_vol = calculate_naive(walls);
    let correction = 0;

    for (const degree of nodes) {
        if (degree > 1) {
            // The Scalar LJP Formula
            const node_correction = (degree - 1) * (THICKNESS ** 2) * HEIGHT;
            correction += node_correction;
        }
    }

    return gross_vol - correction;
};

// ==========================================
// 3. DEFINE THE TEST CASES (FLOOR PLANS)
// ==========================================

// CASE 1: L-Junction (Two 3m walls meeting at corner)
const case_1_walls = [{ length: 3.0 }, { length: 3.0 }];
const case_1_junctions = { 'L': 1 }; // For SMM
const case_1_nodes = [2]; // One node with Degree 2 (The corner)

// CASE 2: T-Junction (A 4m wall with a 3m partition connected to it)
const case_2_walls = [{ length: 2.0 }, { length: 2.0 }, { length: 3.0 }];
const case_2_junctions = { 'T': 1 };
const case_2_nodes = [3]; // One node with Degree 3

// CASE 3: Cross-Junction (Two 4m walls crossing)
const case_3_walls = [{ length: 2.0 }, { length: 2.0 }, { length: 2.0 }, { length: 2.0 }];
const case_3_junctions = { 'Cross': 1 };
const case_3_nodes = [4]; // One node with Degree 4

// CASE 4: The "Micro-Plan" (A 4x4m Room with one internal partition)
const case_4_walls = [
    { length: 4.0 }, { length: 4.0 }, // Vertical
    { length: 4.0 }, { length: 4.0 }, // Horizontal
    { length: 4.0 } // Internal
];
const case_4_junctions = { 'L': 4, 'T': 2 };
const case_4_nodes = [2, 2, 2, 2, 3, 3]; // 4 corners (deg 2), 2 T-joints (deg 3)

// ==========================================
// 4. RUN AUTOMATED VALIDATION
// ==========================================

const scenarios: [string, Wall[], Record<string, number>, number[]][] = [
    ["L-Junction", case_1_walls, case_1_junctions, case_1_nodes],
    ["T-Junction", case_2_walls, case_2_junctions, case_2_nodes],
    ["Cross-Junction", case_3_walls, case_3_junctions, case_3_nodes],
    ["Full Room Plan", case_4_walls, case_4_junctions, case_4_nodes],
];

// ==========================================
// 5. BLOCK COUNT CONVERSION
// ==========================================
const BLOCK_L = 0.450; // 450mm
const BLOCK_H = 0.225; // 225mm
const MORTAR = 0.025;  // 25mm

// Effective dimensions including mortar joint
const L_eff = BLOCK_L + MORTAR;
const H_eff = BLOCK_H + MORTAR;
const FaceArea = L_eff * H_eff; // m2

const volToBlocks = (vol: number): number => {
    // Area = Vol / Thickness
    const area = vol / THICKNESS;
    // Blocks = Area / FaceArea
    return Math.ceil(area / FaceArea);
};

console.log(`${"SCENARIO".padEnd(15)} | ${"NAIVE (Blk)".padEnd(12)} | ${"CENTER LINE".padEnd(12)} | ${"SGG-OCA (Blk)".padEnd(12)} | ${"SAVINGS".padEnd(10)}`);
console.log("-".repeat(75));

for (const [name, walls, junctions, nodes] of scenarios) {
    const v_naive = calculate_naive(walls);
    const v_smm = calculate_smm_centerline(walls, junctions);
    const v_gtoca = calculate_gt_oca(walls, nodes);

    const b_naive = volToBlocks(v_naive);
    const b_smm = volToBlocks(v_smm);
    const b_gtoca = volToBlocks(v_gtoca);

    // Calculate "Phantom Blocks" (Savings)
    const saved_blocks = b_naive - b_gtoca;

    // Check if GT-OCA matches SMM (Ground Truth)
    const is_accurate = Math.abs(v_gtoca - v_smm) < 0.0001;
    const status = is_accurate ? "✅" : "❌";

    console.log(`${name.padEnd(15)} | ${b_naive.toString().padEnd(12)} | ${b_smm.toString().padEnd(12)} | ${b_gtoca.toString().padEnd(12)} | ${saved_blocks.toString().padEnd(3)} blocks ${status}`);
    console.log("-".repeat(75));
}
