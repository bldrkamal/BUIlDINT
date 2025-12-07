/**
 * DXF Parser Service
 * Parses DXF (AutoCAD Drawing Exchange Format) files and extracts wall geometry
 */

import { GeminiFloorPlanResponse } from '../types/gemini';

interface DXFEntity {
    type: string;
    layer?: string;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    vertices?: { x: number; y: number }[];
}

interface DXFParseResult {
    entities: DXFEntity[];
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Parse DXF file content and extract LINE and LWPOLYLINE entities
 */
function parseDXFContent(content: string): DXFParseResult {
    const lines = content.split('\n').map(l => l.trim());
    const entities: DXFEntity[] = [];
    let bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

    let i = 0;
    let inEntitiesSection = false;
    let currentEntity: DXFEntity | null = null;
    let currentCode = 0;

    while (i < lines.length) {
        const code = parseInt(lines[i], 10);
        const value = lines[i + 1] || '';

        // Check for ENTITIES section
        if (code === 2 && value === 'ENTITIES') {
            inEntitiesSection = true;
        }
        if (code === 0 && value === 'ENDSEC' && inEntitiesSection) {
            inEntitiesSection = false;
        }

        if (inEntitiesSection) {
            // New entity starts
            if (code === 0) {
                // Save previous entity
                if (currentEntity && (currentEntity.type === 'LINE' || currentEntity.type === 'LWPOLYLINE')) {
                    entities.push(currentEntity);
                }

                // Start new entity
                if (value === 'LINE' || value === 'LWPOLYLINE' || value === 'POLYLINE') {
                    currentEntity = { type: value, vertices: [] };
                } else {
                    currentEntity = null;
                }
            }

            // Parse entity properties
            if (currentEntity) {
                if (currentEntity.type === 'LINE') {
                    // LINE entity coordinates
                    if (code === 10) currentEntity.startX = parseFloat(value);
                    if (code === 20) currentEntity.startY = parseFloat(value);
                    if (code === 11) currentEntity.endX = parseFloat(value);
                    if (code === 21) currentEntity.endY = parseFloat(value);
                    if (code === 8) currentEntity.layer = value;
                }

                if (currentEntity.type === 'LWPOLYLINE') {
                    // LWPOLYLINE vertices
                    if (code === 10) {
                        currentEntity.vertices = currentEntity.vertices || [];
                        currentEntity.vertices.push({ x: parseFloat(value), y: 0 });
                    }
                    if (code === 20 && currentEntity.vertices && currentEntity.vertices.length > 0) {
                        currentEntity.vertices[currentEntity.vertices.length - 1].y = parseFloat(value);
                    }
                    if (code === 8) currentEntity.layer = value;
                }
            }
        }

        i += 2;
    }

    // Save last entity
    if (currentEntity && (currentEntity.type === 'LINE' || currentEntity.type === 'LWPOLYLINE')) {
        entities.push(currentEntity);
    }

    // Calculate bounds
    entities.forEach(entity => {
        if (entity.type === 'LINE') {
            if (entity.startX !== undefined) {
                bounds.minX = Math.min(bounds.minX, entity.startX);
                bounds.maxX = Math.max(bounds.maxX, entity.startX);
            }
            if (entity.endX !== undefined) {
                bounds.minX = Math.min(bounds.minX, entity.endX);
                bounds.maxX = Math.max(bounds.maxX, entity.endX);
            }
            if (entity.startY !== undefined) {
                bounds.minY = Math.min(bounds.minY, entity.startY);
                bounds.maxY = Math.max(bounds.maxY, entity.startY);
            }
            if (entity.endY !== undefined) {
                bounds.minY = Math.min(bounds.minY, entity.endY);
                bounds.maxY = Math.max(bounds.maxY, entity.endY);
            }
        }
        if (entity.type === 'LWPOLYLINE' && entity.vertices) {
            entity.vertices.forEach(v => {
                bounds.minX = Math.min(bounds.minX, v.x);
                bounds.maxX = Math.max(bounds.maxX, v.x);
                bounds.minY = Math.min(bounds.minY, v.y);
                bounds.maxY = Math.max(bounds.maxY, v.y);
            });
        }
    });

    return { entities, bounds };
}

/**
 * Convert DXF entities to wall data in Gemini response format
 * Normalizes coordinates to 0-1000 range
 */
export function parseDXFToWalls(content: string): GeminiFloorPlanResponse {
    const { entities, bounds } = parseDXFContent(content);

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Normalize to 0-1000 coordinate space
    const normalize = (x: number, y: number) => ({
        x: Math.round(((x - bounds.minX) / width) * 1000),
        y: Math.round(((bounds.maxY - y) / height) * 1000) // Flip Y (DXF has Y up, we have Y down)
    });

    const walls: GeminiFloorPlanResponse['walls'] = [];

    entities.forEach(entity => {
        if (entity.type === 'LINE' &&
            entity.startX !== undefined && entity.startY !== undefined &&
            entity.endX !== undefined && entity.endY !== undefined) {
            const start = normalize(entity.startX, entity.startY);
            const end = normalize(entity.endX, entity.endY);

            // Skip very short lines (likely not walls)
            const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            if (length < 20) return;

            // Determine wall type from layer name
            const layer = (entity.layer || '').toLowerCase();
            const isPartition = layer.includes('partition') || layer.includes('internal') || layer.includes('int');

            walls.push({
                start,
                end,
                thickness: isPartition ? 150 : 225,
                type: isPartition ? 'partition' : 'wall',
                confidence: 0.9
            });
        }

        if (entity.type === 'LWPOLYLINE' && entity.vertices && entity.vertices.length >= 2) {
            // Convert polyline to multiple wall segments
            const layer = (entity.layer || '').toLowerCase();
            const isPartition = layer.includes('partition') || layer.includes('internal') || layer.includes('int');

            for (let i = 0; i < entity.vertices.length - 1; i++) {
                const start = normalize(entity.vertices[i].x, entity.vertices[i].y);
                const end = normalize(entity.vertices[i + 1].x, entity.vertices[i + 1].y);

                const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                if (length < 20) continue;

                walls.push({
                    start,
                    end,
                    thickness: isPartition ? 150 : 225,
                    type: isPartition ? 'partition' : 'wall',
                    confidence: 0.9
                });
            }
        }
    });

    return {
        walls,
        scaleReference: {
            start: { x: 0, y: 0 },
            end: { x: 1000, y: 0 },
            realWorldLength: Math.round(width), // Assume DXF units are mm
            unit: 'mm'
        },
        summary: `Parsed ${walls.length} wall segments from DXF file (${entities.length} entities found)`
    };
}

/**
 * Read DXF file and return parsed wall data
 */
export async function parseDXFFile(file: File): Promise<GeminiFloorPlanResponse> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const result = parseDXFToWalls(content);
                resolve(result);
            } catch (error) {
                reject(new Error('Failed to parse DXF file. Please ensure it is a valid DXF format.'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file.'));
        };

        reader.readAsText(file);
    });
}
