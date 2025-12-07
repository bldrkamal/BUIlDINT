export interface Point2D {
    x: number; // Normalized 0-1000
    y: number; // Normalized 0-1000
}

export interface DetectedWall {
    start: Point2D;
    end: Point2D;
    thickness?: number; // Wall thickness in mm (225 for external, 150 for partition)
    confidence: number; // 0-1
    type: 'wall' | 'partition' | 'railing';
    lengthMM?: number; // Real-world length in millimeters (if detected from dimensions)
}

export interface DetectedOpening {
    type: 'door' | 'window';
    position: Point2D; // Center point on wall
    widthMM: number; // Width in mm (e.g., 900 for standard door)
    heightMM?: number; // Height in mm
    wallIndex?: number; // Index of the wall this opening belongs to
    swingDirection?: 'left' | 'right' | 'double'; // For doors
    confidence: number; // 0-1
}

export interface ScaleReference {
    start: Point2D;
    end: Point2D;
    realWorldLength: number; // In mm or m based on unit
    unit: 'm' | 'mm' | 'ft';
}

export interface DetectedDimension {
    text: string; // Original text like "4.5m", "3000", "12'-6""
    value: number; // Numeric value in mm
    unit: 'mm' | 'm' | 'ft' | 'in';
}

export interface GeminiFloorPlanResponse {
    walls: DetectedWall[];
    openings?: DetectedOpening[]; // Doors and windows detected
    scaleReference?: ScaleReference;
    estimatedScale?: number; // Normalized units per meter (e.g., 100 means 1000 units = 10m)
    dimensions?: DetectedDimension[]; // All dimension annotations found in the image
    summary: string; // Brief description of what was found
    roomCount?: number; // Number of rooms detected
    totalAreaM2?: number; // Estimated total area in square meters
}
