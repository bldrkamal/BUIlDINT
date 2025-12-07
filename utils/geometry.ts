
import { Point, Wall, SnapGuide } from '../types';
import * as martinez from 'martinez-polygon-clipping';

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const roundPoint = (p: Point, precision: number = 2): Point => {
  const factor = Math.pow(10, precision);
  return {
    x: Math.round(p.x * factor) / factor,
    y: Math.round(p.y * factor) / factor
  };
};

export const snapToGrid = (point: Point, gridSize: number = 20): Point => {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
};

export const getClosestPointOnLine = (p: Point, start: Point, end: Point): { point: Point, t: number } => {
  const l2 = Math.pow(distance(start, end), 2);
  if (l2 === 0) return { point: start, t: 0 };

  let t = ((p.x - start.x) * (end.x - start.x) + (p.y - start.y) * (end.y - start.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  return {
    point: {
      x: start.x + t * (end.x - start.x),
      y: start.y + t * (end.y - start.y)
    },
    t
  };
};

export const checkSnapToNodes = (cursor: Point, walls: Wall[], threshold: number = 15): { point: Point, type: 'endpoint' | 'midpoint' } | null => {
  // 1. Check Endpoints first (Higher priority)
  for (const wall of walls) {
    if (distance(cursor, wall.start) < threshold) return { point: wall.start, type: 'endpoint' };
    if (distance(cursor, wall.end) < threshold) return { point: wall.end, type: 'endpoint' };
  }

  // 2. Check Midpoints
  for (const wall of walls) {
    const midPoint: Point = {
      x: (wall.start.x + wall.end.x) / 2,
      y: (wall.start.y + wall.end.y) / 2
    };
    if (distance(cursor, midPoint) < threshold) return { point: midPoint, type: 'midpoint' };
  }

  return null;
};

export const getAlignmentGuides = (cursor: Point, walls: Wall[], threshold: number = 10): { point: Point, guides: SnapGuide[] } => {
  let newPoint = { ...cursor };
  const guides: SnapGuide[] = [];

  // Collect interesting points (start, end)
  const pointsOfInterest: Point[] = [];
  walls.forEach(w => {
    pointsOfInterest.push(w.start);
    pointsOfInterest.push(w.end);
  });

  // Check X alignment (Vertical guide line)
  let minDistX = threshold;
  let snappedX: SnapGuide | null = null;

  pointsOfInterest.forEach(p => {
    const dist = Math.abs(cursor.x - p.x);
    if (dist < minDistX) {
      minDistX = dist;
      snappedX = { orientation: 'vertical', position: p.x, refPoint: p };
    }
  });

  // Check Y alignment (Horizontal guide line)
  let minDistY = threshold;
  let snappedY: SnapGuide | null = null;

  pointsOfInterest.forEach(p => {
    const dist = Math.abs(cursor.y - p.y);
    if (dist < minDistY) {
      minDistY = dist;
      snappedY = { orientation: 'horizontal', position: p.y, refPoint: p };
    }
  });

  // Apply Snaps
  if (snappedX) {
    newPoint.x = snappedX.position;
    guides.push(snappedX);
  }
  if (snappedY) {
    newPoint.y = snappedY.position;
    guides.push(snappedY);
  }

  return { point: newPoint, guides };
}

export const getAngle = (p1: Point, p2: Point): number => {
  const dy = p2.y - p1.y;
  const dx = p2.x - p1.x;
  let theta = Math.atan2(dy, dx); // range (-PI, PI]
  theta *= 180 / Math.PI; // rads to degs
  if (theta < 0) theta = 360 + theta; // range [0, 360)
  return theta;
};

export const snapToAngle = (start: Point, current: Point, threshold: number = 15): { point: Point, snapped: boolean, angle: number } => {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  const targets = [0, 90, 180, 270, 360];

  for (const t of targets) {
    let diff = Math.abs(angle - t);
    if (diff > 300) diff = Math.abs(diff - 360);

    if (diff < threshold) {
      const snappedAngle = t === 360 ? 0 : t;

      // Explicit Coordinate Locking for Orthogonal Lines (Fixes floating point drift)
      let newX = start.x;
      let newY = start.y;

      if (snappedAngle === 0) {
        newX = start.x + dist;
        newY = start.y;
      } else if (snappedAngle === 90) {
        newX = start.x;
        newY = start.y + dist;
      } else if (snappedAngle === 180) {
        newX = start.x - dist;
        newY = start.y;
      } else if (snappedAngle === 270) {
        newX = start.x;
        newY = start.y - dist;
      } else {
        // Fallback
        const rads = snappedAngle * (Math.PI / 180);
        newX = start.x + dist * Math.cos(rads);
        newY = start.y + dist * Math.sin(rads);
      }

      return {
        point: { x: newX, y: newY },
        snapped: true,
        angle: snappedAngle
      };
    }
  }

  return { point: current, snapped: false, angle };
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const getLineIntersection = (p0: Point, p1: Point, p2: Point, p3: Point): Point | null => {
  const s1_x = p1.x - p0.x;
  const s1_y = p1.y - p0.y;
  const s2_x = p3.x - p2.x;
  const s2_y = p3.y - p2.y;

  const det = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(det) < 1e-6) return null; // Parallel lines

  const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / det;
  const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / det;

  if (s >= 0.001 && s <= 0.999 && t >= 0.001 && t <= 0.999) {
    return {
      x: p0.x + (t * s1_x),
      y: p0.y + (t * s1_y)
    };
  }

  return null;
};

export const isPointOnSegment = (p: Point, start: Point, end: Point, tolerance: number = 1): boolean => {
  const d = distance(start, end);
  if (d === 0) return false;
  const d1 = distance(p, start);
  const d2 = distance(p, end);

  // Check if length matches and point is effectively on the line
  return Math.abs((d1 + d2) - d) < tolerance;
};

/**
 * Detects and splits walls at all junction points (T-junctions and cross-intersections).
 * This ensures accurate block calculations regardless of drawing method.
 * 
 * @param walls - Array of walls to process
 * @returns Array of walls with junctions properly split
 */
export const detectAndSplitJunctions = (walls: Wall[]): Wall[] => {
  if (walls.length === 0) return walls;

  let processedWalls = [...walls];
  const splitThreshold = 15; // px tolerance for detecting junctions (relaxed for better detection)
  const endpointThreshold = 5; // px tolerance to avoid splitting near endpoints
  let hasSplits = true;
  let iterations = 0;
  const maxIterations = 10;

  console.log(`🔍 detectAndSplitJunctions: Starting with ${walls.length} walls`);

  while (hasSplits && iterations < maxIterations) {
    hasSplits = false;
    iterations++;
    const nextWalls: Wall[] = [];

    for (let i = 0; i < processedWalls.length; i++) {
      const wall = processedWalls[i];
      const splitPoints: { t: number; point: Point }[] = [];

      // Check for T-junctions: other walls' endpoints on this wall's segment
      for (let j = 0; j < processedWalls.length; j++) {
        if (i === j) continue;
        const otherWall = processedWalls[j];

        // Check if other wall's start point is on this wall
        const closestStart = getClosestPointOnLine(otherWall.start, wall.start, wall.end);
        const distToLineStart = distance(otherWall.start, closestStart.point);
        const distToWallStart = distance(closestStart.point, wall.start);
        const distToWallEnd = distance(closestStart.point, wall.end);

        if (
          distToLineStart < splitThreshold &&
          closestStart.t > 0.01 && closestStart.t < 0.99 &&
          distToWallStart > endpointThreshold &&
          distToWallEnd > endpointThreshold
        ) {
          console.log(`✂️ T-junction detected: Wall ${i} split by endpoint of wall ${j}, dist=${distToLineStart.toFixed(1)}px`);
          splitPoints.push({ t: closestStart.t, point: closestStart.point });
          hasSplits = true;
        }

        // Check if other wall's end point is on this wall
        const closestEnd = getClosestPointOnLine(otherWall.end, wall.start, wall.end);
        const distToLineEnd = distance(otherWall.end, closestEnd.point);
        const distToWallStartEnd = distance(closestEnd.point, wall.start);
        const distToWallEndEnd = distance(closestEnd.point, wall.end);

        if (
          distToLineEnd < splitThreshold &&
          closestEnd.t > 0.01 && closestEnd.t < 0.99 &&
          distToWallStartEnd > endpointThreshold &&
          distToWallEndEnd > endpointThreshold
        ) {
          console.log(`✂️ T-junction detected: Wall ${i} split by endpoint of wall ${j}, dist=${distToLineEnd.toFixed(1)}px`);
          splitPoints.push({ t: closestEnd.t, point: closestEnd.point });
          hasSplits = true;
        }
      }

      // Check for cross-intersections: this wall intersects with other walls
      for (let j = i + 1; j < processedWalls.length; j++) {
        const otherWall = processedWalls[j];
        const intersection = getLineIntersection(wall.start, wall.end, otherWall.start, otherWall.end);

        if (intersection) {
          const distToWallStartCross = distance(intersection, wall.start);
          const distToWallEndCross = distance(intersection, wall.end);

          if (distToWallStartCross > endpointThreshold && distToWallEndCross > endpointThreshold) {
            const wallLen = distance(wall.start, wall.end);
            const t = distToWallStartCross / wallLen;
            console.log(`✂️ Cross-intersection detected: Walls ${i} and ${j} intersect`);
            splitPoints.push({ t, point: intersection });
            hasSplits = true;
          }
        }
      }

      // Remove duplicate split points (same location)
      const uniqueSplitPoints = splitPoints.filter((sp, idx, arr) => {
        return arr.findIndex(other => distance(sp.point, other.point) < 2) === idx;
      });

      // Split the wall if there are split points
      if (uniqueSplitPoints.length > 0) {
        uniqueSplitPoints.sort((a, b) => a.t - b.t);

        let currentStart = wall.start;
        uniqueSplitPoints.forEach(sp => {
          nextWalls.push({
            ...wall,
            id: generateId(),
            start: currentStart,
            end: sp.point
          });
          currentStart = sp.point;
        });
        nextWalls.push({
          ...wall,
          id: generateId(),
          start: currentStart,
          end: wall.end
        });
        console.log(`  Wall ${i} split into ${uniqueSplitPoints.length + 1} segments`);
      } else {
        nextWalls.push(wall);
      }
    }

    processedWalls = nextWalls;
  }
  console.log(`✅ detectAndSplitJunctions: Completed after ${iterations} iterations, ${processedWalls.length} walls`);
  return processedWalls;
};

// --- Spatial Hashing (Section 2.3 Methodology) ---
class SpatialGrid {
  private grid: Map<string, GraphNode[]>;
  private cellSize: number;

  constructor(cellSize: number = 20) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private getKey(p: Point): string {
    const gx = Math.floor(p.x / this.cellSize);
    const gy = Math.floor(p.y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(node: GraphNode) {
    const key = this.getKey(node.point);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key)!.push(node);
  }

  findClose(p: Point, threshold: number): GraphNode | null {
    const gx = Math.floor(p.x / this.cellSize);
    const gy = Math.floor(p.y / this.cellSize);

    for (let x = gx - 1; x <= gx + 1; x++) {
      for (let y = gy - 1; y <= gy + 1; y++) {
        const key = `${x},${y}`;
        const bucket = this.grid.get(key);
        if (bucket) {
          for (const node of bucket) {
            if (distance(node.point, p) < threshold) {
              return node;
            }
          }
        }
      }
    }
    return null;
  }
}

interface GraphNode {
  id: string;
  point: Point;
  edges: Wall[];
}

export const buildGraph = (walls: Wall[]): { nodes: GraphNode[], adjacency: Map<string, string[]> } => {
  const nodes: GraphNode[] = [];
  const adjacency = new Map<string, string[]>();
  const spatialIndex = new SpatialGrid(20);
  const fuseThreshold = 5;

  const getOrCreateNode = (p: Point): GraphNode => {
    const existing = spatialIndex.findClose(p, fuseThreshold);
    if (existing) return existing;
    const newNode: GraphNode = { id: generateId(), point: p, edges: [] };
    nodes.push(newNode);
    spatialIndex.insert(newNode);
    return newNode;
  };

  walls.forEach(wall => {
    let startNode = getOrCreateNode(wall.start);
    let endNode = getOrCreateNode(wall.end);

    if (startNode.id === endNode.id) return;

    // Add wall to node edges
    startNode.edges.push(wall);
    endNode.edges.push(wall);

    // Add edges (undirected)
    if (!adjacency.has(startNode.id)) adjacency.set(startNode.id, []);
    if (!adjacency.has(endNode.id)) adjacency.set(endNode.id, []);

    if (!adjacency.get(startNode.id)!.includes(endNode.id)) adjacency.get(startNode.id)!.push(endNode.id);
    if (!adjacency.get(endNode.id)!.includes(startNode.id)) adjacency.get(endNode.id)!.push(startNode.id);
  });

  return { nodes, adjacency };
};

/**
 * Calculates the total enclosed floor area from a set of walls.
 * (Simplified placeholder to restore file validity - Logic pending full restoration if robust area needed)
 */
export const calculateFloorArea = (walls: Wall[], scale: number = 1): number => {
  // TODO: Restore robust cycle finding logic if needed for Room Area
  return 0;
};

export const calculatePolygonArea = (points: Point[]): number => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
};

// --- CSG Geometric Processing (Section 2.4) ---


// Type definitions for Martinez (GeoJSON format)
export type Position = [number, number];
export type Polygon = Position[][]; // [OuterRing, Hole1, Hole2...]
export type MultiPolygon = Polygon[];
export type Geometry = Polygon | MultiPolygon;

const SCALE = 0.05; // 1px = 20mm

const ensureMultiPolygon = (geo: Geometry): MultiPolygon => {
  if (!geo || geo.length === 0) return [];
  // Check depth to distinguish Polygon vs MultiPolygon
  // Polygon is Position[][] (Depth 2 array of positions? No, Ring is Position[], Ring[] is Polygon)
  // Position is [number, number]
  // Polygon: [ [[x,y],[x,y]], [[x,y]...] ]
  // MultiPolygon: [ [ [[x,y]..] ], ... ]

  // If geo[0][0][0] is number, it is a Polygon
  const first = geo[0];
  if (Array.isArray(first) && Array.isArray(first[0]) && typeof first[0][0] === 'number') {
    return [geo as Polygon];
  }
  return geo as MultiPolygon;
};

/**
 * Converts a Wall (Line Segment) into a physical footprint Polygon.
 * Applies width/2 offset perpendicular to the wall centerline.
 * @param wall 
 * @returns Polygon (in mm coordinates)
 */
export const wallToPolygon = (wall: Wall): Polygon => {
  const x1 = wall.start.x / SCALE;
  const y1 = wall.start.y / SCALE;
  const x2 = wall.end.x / SCALE;
  const y2 = wall.end.y / SCALE;
  const w = wall.thickness; // Already in mm

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return [[[x1, y1]]];

  const ux = (dx / len) * (w / 2);
  const uy = (dy / len) * (w / 2);

  // Perpendicular vector (-uy, ux)
  const px = -uy;
  const py = ux;

  // 4 Corners
  const c1: Position = [x1 + px, y1 + py];
  const c2: Position = [x2 + px, y2 + py];
  const c3: Position = [x2 - px, y2 - py];
  const c4: Position = [x1 - px, y1 - py];

  // Close the loop
  return [[c1, c2, c3, c4, c1]];
};

/**
 * Computes the Geometric Union of a set of polygons.
 * Resolves L, T, and Cross junctions mathematically.
 */
export const computeUnion = (polygons: Polygon[]): MultiPolygon => {
  if (polygons.length === 0) return [];
  if (polygons.length === 1) return [polygons[0]];

  let result: MultiPolygon = [polygons[0]];

  for (let i = 1; i < polygons.length; i++) {
    const unionResult = martinez.union(result, polygons[i]);
    result = ensureMultiPolygon(unionResult);
  }

  return result;
};

/**
 * Computes Geometric Difference (Subject - Clipper).
 * Used to trim partition walls against structural walls.
 */
/**
 * Computes Geometric Difference (Subject - Clipper).
 * Used to trim partition walls against structural walls.
 */
export const computeDifference = (subject: MultiPolygon, clipper: MultiPolygon): MultiPolygon => {
  if (!subject || subject.length === 0) return [];
  if (!clipper || clipper.length === 0) return subject;

  // Martinez might crash on empty or malformed inputs?
  // ensure types
  try {
    const diffResult = martinez.diff(subject, clipper);
    return ensureMultiPolygon(diffResult);
  } catch (e) {
    console.warn("CSG Difference failed:", e);
    return subject; // Fallback
  }
};

/**
 * Calculates the total area of a MultiPolygon in square meters.
 */
export const calculateMultiPolygonArea = (multipoly: MultiPolygon): number => {
  let totalAreaMm = 0;

  multipoly.forEach(poly => {
    // Outer ring (+), Holes (-)
    poly.forEach((ring, index) => {
      let area = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i + 1][1];
        area -= ring[i + 1][0] * ring[i][1];
      }
      area = Math.abs(area / 2);

      if (index === 0) totalAreaMm += area;
      else totalAreaMm -= area;
    });
  });

  return totalAreaMm / 1_000_000; // mm^2 -> m^2
};
