
import { Point, Wall, SnapGuide } from '../types';

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

export const snapToAngle = (start: Point, current: Point, threshold: number = 10): { point: Point, snapped: boolean, angle: number } => {
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

// --- Graph & Polygon Logic for Accuracy ---

interface GraphNode {
  id: string;
  point: Point;
  edges: Wall[]; // Connected walls (for degree calculation)
}

export const buildGraph = (walls: Wall[]): { nodes: GraphNode[], adjacency: Map<string, string[]> } => {
  const nodes: GraphNode[] = [];
  const adjacency = new Map<string, string[]>(); // NodeID -> NodeIDs

  // 1. Identify Unique Nodes (Endpoints)
  const threshold = 20; // Pixel threshold for merging
  const findNode = (p: Point) => nodes.find(n => distance(n.point, p) < threshold);

  walls.forEach(wall => {
    let startNode = findNode(wall.start);
    if (!startNode) {
      startNode = { id: generateId(), point: wall.start, edges: [] };
      nodes.push(startNode);
    }

    let endNode = findNode(wall.end);
    if (!endNode) {
      endNode = { id: generateId(), point: wall.end, edges: [] };
      nodes.push(endNode);
    }

    // ✅ FIX: Add wall to node edges (for degree calculation)
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

// --- Robust Floor Area Calculation ---

/**
 * Calculates the total enclosed floor area from a set of walls.
 * Includes robust topology cleaning:
 * 1. Splits intersecting walls (Hashtag support)
 * 2. Merges close endpoints (Gap closing)
 * 3. Removes duplicates
 * 4. Uses Planar Face Traversal to find internal faces
 */
export const calculateFloorArea = (walls: Wall[], scale: number = 1): number => {
  // --- Step 1: Topology Cleanup ---

  // A. Split Intersecting Walls
  let currentWalls = [...walls];
  let hasSplits = true;
  let iterations = 0;

  while (hasSplits && iterations < 10) {
    hasSplits = false;
    iterations++;
    const nextWalls: Wall[] = [];
    const processedIndices = new Set<number>();

    for (let i = 0; i < currentWalls.length; i++) {
      if (processedIndices.has(i)) continue;

      let w1 = currentWalls[i];
      let splitPoints: { t: number, point: Point }[] = [];

      for (let j = 0; j < currentWalls.length; j++) {
        if (i === j) continue;
        const w2 = currentWalls[j];

        const intersection = getLineIntersection(w1.start, w1.end, w2.start, w2.end);
        if (intersection) {
          const dStart = distance(intersection, w1.start);
          const dEnd = distance(intersection, w1.end);
          const len = distance(w1.start, w1.end);

          if (dStart > 1 && dEnd > 1) {
            const t = dStart / len;
            splitPoints.push({ t, point: intersection });
            hasSplits = true;
          }
        }
      }

      if (splitPoints.length > 0) {
        splitPoints.sort((a, b) => a.t - b.t);
        let currStart = w1.start;
        splitPoints.forEach(sp => {
          nextWalls.push({ ...w1, id: generateId(), start: currStart, end: sp.point });
          currStart = sp.point;
        });
        nextWalls.push({ ...w1, id: generateId(), start: currStart, end: w1.end });
      } else {
        nextWalls.push(w1);
      }
    }
    currentWalls = nextWalls;
  }

  // B. Cluster Endpoints (Merge Gaps)
  const threshold = 20; // 20px merge radius
  const points: Point[] = [];
  currentWalls.forEach(w => { points.push(w.start); points.push(w.end); });

  const mergedPoints: Point[] = [];
  const pointMap = new Map<number, number>();

  points.forEach((p, i) => {
    let found = -1;
    for (let j = 0; j < mergedPoints.length; j++) {
      if (distance(p, mergedPoints[j]) < threshold) {
        found = j;
        break;
      }
    }
    if (found !== -1) {
      pointMap.set(i, found);
    } else {
      mergedPoints.push(p);
      pointMap.set(i, mergedPoints.length - 1);
    }
  });

  // C. Reconstruct & Dedupe
  const uniqueWalls: Wall[] = [];
  const seen = new Set<string>();

  currentWalls.forEach((w, i) => {
    const startIndex = pointMap.get(i * 2)!;
    const endIndex = pointMap.get(i * 2 + 1)!;

    if (startIndex !== endIndex) {
      const p1 = mergedPoints[startIndex];
      const p2 = mergedPoints[endIndex];

      // Canonical key
      const key = p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)
        ? `${p1.x},${p1.y}-${p2.x},${p2.y}`
        : `${p2.x},${p2.y}-${p1.x},${p1.y}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueWalls.push({ ...w, start: p1, end: p2 });
      }
    }
  });

  // --- Step 2: Build Graph ---

  interface GraphNode { id: string; point: Point; }
  interface DirectedEdge {
    from: string; to: string; angle: number; visited: boolean;
  }

  const nodes: GraphNode[] = mergedPoints.map((p, i) => ({ id: i.toString(), point: p }));
  const edges: DirectedEdge[] = [];

  uniqueWalls.forEach(w => {
    // Find node indices by coordinate match (exact match now since we merged)
    // Optimization: We could have tracked indices better, but coordinate match is safe here
    const startNode = nodes.find(n => n.point.x === w.start.x && n.point.y === w.start.y);
    const endNode = nodes.find(n => n.point.x === w.end.x && n.point.y === w.end.y);

    if (startNode && endNode) {
      edges.push({
        from: startNode.id, to: endNode.id,
        angle: Math.atan2(endNode.point.y - startNode.point.y, endNode.point.x - startNode.point.x),
        visited: false
      });
      edges.push({
        from: endNode.id, to: startNode.id,
        angle: Math.atan2(startNode.point.y - endNode.point.y, startNode.point.x - endNode.point.x),
        visited: false
      });
    }
  });

  const outgoingEdges = new Map<string, DirectedEdge[]>();
  edges.forEach(e => {
    if (!outgoingEdges.has(e.from)) outgoingEdges.set(e.from, []);
    outgoingEdges.get(e.from)!.push(e);
  });

  outgoingEdges.forEach(list => list.sort((a, b) => a.angle - b.angle));

  // --- Step 3: Face Traversal ---
  let totalArea = 0;

  for (const startEdge of edges) {
    if (startEdge.visited) continue;

    const cycle: DirectedEdge[] = [];
    let currentEdge = startEdge;

    while (!currentEdge.visited) {
      currentEdge.visited = true;
      cycle.push(currentEdge);

      const candidates = outgoingEdges.get(currentEdge.to);
      if (!candidates || candidates.length === 0) break;

      // Find sharpest left turn
      const incomingAngle = currentEdge.angle + Math.PI;
      const refAngle = Math.atan2(Math.sin(incomingAngle), Math.cos(incomingAngle));

      let bestNext: DirectedEdge | null = null;
      let minAngleDiff = Infinity;

      for (const cand of candidates) {
        let diff = cand.angle - refAngle;
        if (diff <= 1e-5) diff += 2 * Math.PI; // Treat 0 diff as 360 (full circle) if needed, but usually we want > 0
        // Actually, we want the smallest positive angle difference CCW.
        // If diff is 0, it means we are going back the way we came (180 turn relative to node? No).
        // refAngle is pointing BACK. cand.angle is pointing OUT.
        // If cand.angle == refAngle, it means we are going back exactly the way we came.

        if (diff < minAngleDiff) {
          minAngleDiff = diff;
          bestNext = cand;
        }
      }

      if (bestNext) currentEdge = bestNext;
      else break;

      if (currentEdge === startEdge) break;
    }

    if (cycle.length > 2 && currentEdge === startEdge) {
      let area = 0;
      for (const edge of cycle) {
        const n1 = nodes.find(n => n.id === edge.from)!;
        const n2 = nodes.find(n => n.id === edge.to)!;
        area += (n1.point.x * n2.point.y - n2.point.x * n1.point.y);
      }
      area /= 2;

      if (area > 0) totalArea += area;
    }
  }

  return totalArea * (scale * scale);
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
