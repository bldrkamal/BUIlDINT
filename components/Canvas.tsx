import React, { useRef, useState, MouseEvent, useEffect, KeyboardEvent as ReactKeyboardEvent, TouchEvent } from 'react';
import { Wall, Point, Opening, ToolMode, ProjectSettings, ToolSettings, ViewportTransform, SnapGuide, SnapType, ProjectLabel, Column, SectionLine, CalculationResult, Beam, Slab } from '../types';
import { distance, snapToGrid, checkSnapToNodes, getClosestPointOnLine, generateId, getAngle, snapToAngle, getAlignmentGuides, roundPoint, getLineIntersection } from '../utils/geometry';
import { calculateTributaryAreas } from '../utils/structuralAnalysis';
import { Move, ZoomIn, ZoomOut, Keyboard, MousePointer2 } from 'lucide-react';
import PropertiesPanel from './PropertiesPanel';
import DPad from './DPad';
import ManualInput from './ManualInput';
import Magnifier from './Magnifier';

interface CanvasProps {
    tool: ToolMode;
    setTool: (t: ToolMode) => void;
    walls: Wall[];
    openings: Opening[];
    columns: Column[];
    beams: Beam[];
    slabs: Slab[];
    labels: ProjectLabel[];
    setWalls: React.Dispatch<React.SetStateAction<Wall[]>>;
    setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
    setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
    setBeams: React.Dispatch<React.SetStateAction<Beam[]>>;
    setSlabs: React.Dispatch<React.SetStateAction<Slab[]>>;
    setLabels: React.Dispatch<React.SetStateAction<ProjectLabel[]>>;
    settings: ProjectSettings;
    toolSettings: ToolSettings;
    snapEnabled: boolean;
    showDimensions: boolean;
    selectedId: string | null;
    setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
    onUpdateSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    results?: CalculationResult;
    sketchOverlay?: { image: string, width: number, height: number } | null;
}

// Convert MM to Pixels for display (Scale factor)
const SCALE = 0.05; // 1mm = 0.05px (e.g. 1000mm wall = 50px)
const GRID_SIZE = 20;

const Canvas: React.FC<CanvasProps> = ({
    tool,
    setTool,
    walls,
    openings,
    columns,
    beams,
    slabs,
    labels,
    setWalls,
    setOpenings,
    setColumns,
    setBeams,
    setSlabs,
    setLabels,
    settings,
    toolSettings,
    snapEnabled,
    showDimensions,
    selectedId,
    setSelectedId,
    onUpdateSettings,
    results,
    sketchOverlay
}) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [points, setPoints] = useState<Point[]>([]);
    const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
    const [inputVisible, setInputVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isShiftHeld, setIsShiftHeld] = useState(false);

    // Section Tool State
    const [sectionStart, setSectionStart] = useState<Point | null>(null);

    // Selection & Dragging
    // NOTE: selectedId is now a prop controlled by App
    const [dragStart, setDragStart] = useState<Point | null>(null);

    // We store the ORIGINAL state of the object being dragged to avoid incremental drift
    const [dragOriginalWall, setDragOriginalWall] = useState<Wall | null>(null);
    const [dragOriginalLabel, setDragOriginalLabel] = useState<ProjectLabel | null>(null);
    const [dragOriginalColumn, setDragOriginalColumn] = useState<Column | null>(null);
    const [dragOriginalBeam, setDragOriginalBeam] = useState<Beam | null>(null);
    const [dragOriginalSlab, setDragOriginalSlab] = useState<Slab | null>(null);

    // Snapping State
    const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
    const [snapType, setSnapType] = useState<SnapType>('none');
    const [wallSnap, setWallSnap] = useState<{
        wall: Wall;
        point: Point;
        distFromStart: number;
    } | null>(null);



    // Opening Preview State
    const [previewOpening, setPreviewOpening] = useState<{
        wall: Wall;
        point: Point;
        distFromStart: number;
    } | null>(null);

    // Precision Mode State
    const [precisionMode, setPrecisionMode] = useState(false);
    const [virtualCursor, setVirtualCursor] = useState<Point | null>(null); // For D-Pad control

    // Touch State
    const lastTouchRef = useRef<{ dist: number; center: Point } | null>(null);
    const TOUCH_OFFSET = 60; // px above finger

    // Manual Input State
    const [manualInputVisible, setManualInputVisible] = useState(false);
    const [manualInputStart, setManualInputStart] = useState<Point | null>(null);

    // Magnifier State
    const [showMagnifier, setShowMagnifier] = useState(false);
    const [screenCursor, setScreenCursor] = useState<Point>({ x: 0, y: 0 });

    const handleManualInputCommit = (length: number, angle: number) => {
        const start = manualInputStart || (points.length > 0 ? points[points.length - 1] : cursor);

        // Convert angle to radians (0 degrees is Right/East)
        const rad = (angle * Math.PI) / 180;
        const dx = length * Math.cos(rad);
        const dy = length * Math.sin(rad);

        // Calculate end point (Scale is handled by the input being in mm, so we convert to pixels)
        // Wait, input is in mm. Our coordinate system is pixels.
        // We need to convert mm to pixels.
        const lengthPx = length * SCALE;

        const endPoint = {
            x: start.x + Math.cos(rad) * lengthPx,
            y: start.y + Math.sin(rad) * lengthPx
        };

        if (tool === 'wall' || tool === 'beam' || tool === 'slab') {
            if (isDrawing) {
                setPoints(prev => [...prev, endPoint]);
            } else {
                setPoints([start, endPoint]);
                setIsDrawing(true);
            }
        }

        setManualInputVisible(false);
        setManualInputStart(null);
    };

    const toggleManualInput = () => {
        if (manualInputVisible) {
            setManualInputVisible(false);
            setManualInputStart(null);
        } else {
            // Set start point
            if (points.length > 0) {
                setManualInputStart(points[points.length - 1]);
            } else {
                setManualInputStart(cursor);
            }
            setManualInputVisible(true);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    // --- Keyboard Listeners for Modifier Keys ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftHeld(true);

            // Delete Key for Selection
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Only delete if not typing in an input box
                if (!inputVisible && selectedId) {
                    setWalls(prev => prev.filter(w => w.id !== selectedId));
                    setOpenings(prev => prev.filter(o => o.id !== selectedId && o.wallId !== selectedId));
                    setLabels(prev => prev.filter(l => l.id !== selectedId));
                    setSelectedId(null);
                }
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftHeld(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedId, inputVisible]);



    // --- Coordinates ---
    const screenToWorld = (sx: number, sy: number): Point => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (sx - rect.left - viewport.x) / viewport.scale,
            y: (sy - rect.top - viewport.y) / viewport.scale
        };
    };

    // --- Mouse Handlers ---
    const handleMouseDown = (e: React.MouseEvent | TouchEvent, explicitType?: string, explicitId?: string) => {
        // Handle Mouse vs Touch
        let clientX, clientY;
        let button = 0;
        let shiftKey = isShiftHeld;
        let isTouch = false;

        if ('touches' in e) {
            isTouch = true;
            // Multi-touch for gestures, ignore here or handle?
            // If 2 fingers, we don't want to draw/select, we want to gesture.
            if (e.touches.length > 1) return;

            setShowMagnifier(true);
            setScreenCursor({ x: e.touches[0].clientX, y: e.touches[0].clientY });

            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY - TOUCH_OFFSET; // Apply Offset
        } else {
            setShowMagnifier(false);
            const mouseEvent = e as React.MouseEvent;
            clientX = mouseEvent.clientX;
            clientY = mouseEvent.clientY;
            button = mouseEvent.button;
            shiftKey = mouseEvent.shiftKey;
        }

        // Right Click -> Cancel or Stop
        if (button === 2) {
            if (isDrawing) {
                setIsDrawing(false);
                setPoints([]);
                setActiveGuides([]);
                setSnapType('none');
            } else {
                // Deselect on right click if not drawing
                setSelectedId(null);
            }
            return;
        }

        if (button !== 0 && button !== 1) return; // Ignore other buttons

        if (button !== 0 && button !== 1) return; // Ignore other buttons



        let worldPos = screenToWorld(clientX, clientY);

        // Precision Mode Override
        if (precisionMode) {
            // If we have a virtual cursor, use it. 
            // BUT if the user taps, we might want to move the virtual cursor to the tap location first?
            // Strategy: Tap moves the cursor to that location AND triggers the action.
            // OR: Tap just moves the cursor? 
            // Let's go with: Tap sets the virtual cursor to that point, and we use that point.
            setVirtualCursor(worldPos);
        } else {
            setVirtualCursor(null);
        }

        // If we are in precision mode and already have a virtual cursor, maybe we use that?
        // Actually, let's keep it simple: Tap always updates position.

        // Space bar pan or middle click
        if (tool === 'pan' || button === 1) {
            setIsPanning(true);
            setPanStart({ x: clientX, y: clientY });
            return;
        }

        // --- Tool: Select / Edit ---
        if (tool === 'select') {
            // 0. Explicit Selection (passed from element)
            if (explicitType === 'column' && explicitId) {
                const col = columns.find(c => c.id === explicitId);
                if (col) {
                    setSelectedId(explicitId);
                    setDragStart(worldPos);
                    setDragOriginalColumn({ ...col });
                    setDragOriginalLabel(null);
                    setDragOriginalWall(null);
                    return;
                }
            }

            // 1. Check Labels
            const hitLabel = labels.find(l => distance(worldPos, { x: l.x, y: l.y }) < 20);
            if (hitLabel) {
                setSelectedId(hitLabel.id);
                setDragStart(worldPos);
                setDragOriginalLabel({ ...hitLabel }); // Deep copy state at start of drag
                setDragOriginalWall(null);
                return;
            }

            // 2. Check Openings
            const hitOpening = openings.find(o => {
                const w = walls.find(wall => wall.id === o.wallId);
                if (!w) return false;
                const wallLen = distance(w.start, w.end);
                const dx = (w.end.x - w.start.x) / wallLen;
                const dy = (w.end.y - w.start.y) / wallLen;
                const ox = w.start.x + dx * o.distanceFromStart;
                const oy = w.start.y + dy * o.distanceFromStart;
                const visualWidth = o.width * SCALE;
                return distance(worldPos, { x: ox, y: oy }) < (visualWidth / 2);
            });

            if (hitOpening) {
                setSelectedId(hitOpening.id);
                // Dragging openings is complex (slide along wall), simplifying to just select for now
                return;
            }

            // 3. Check Columns
            const hitColumn = columns.find(c => {
                const w = (c.width || 225) * SCALE;
                const h = (c.height || 225) * SCALE;
                // Simple bounding box check (rotation ignored for selection hit test for simplicity, or could improve)
                return (
                    worldPos.x >= c.x - w / 2 &&
                    worldPos.x <= c.x + w / 2 &&
                    worldPos.y >= c.y - h / 2 &&
                    worldPos.y <= c.y + h / 2
                );
            });

            if (hitColumn) {
                setSelectedId(hitColumn.id);
                setDragStart(worldPos);
                setDragOriginalColumn({ ...hitColumn });
                setDragOriginalLabel(null);
                setDragOriginalWall(null);
                return;
            }

            // 4. Check Walls
            const hitWall = walls.find(w => {
                const { point } = getClosestPointOnLine(worldPos, w.start, w.end);
                return distance(worldPos, point) < 10;
            });

            if (hitWall) {
                setSelectedId(hitWall.id);
                setDragStart(worldPos);
                setDragOriginalWall({ ...hitWall }); // Deep copy state at start of drag
                setDragOriginalLabel(null);
                setDragOriginalColumn(null);
                setDragOriginalBeam(null);
                setDragOriginalSlab(null);
            } else {
                // 5. Check Beams
                const hitBeam = beams.find(b => {
                    const { point } = getClosestPointOnLine(worldPos, b.start, b.end);
                    return distance(worldPos, point) < (b.width / 2 * SCALE);
                });

                if (hitBeam) {
                    setSelectedId(hitBeam.id);
                    setDragStart(worldPos);
                    setDragOriginalBeam({ ...hitBeam });
                    setDragOriginalWall(null);
                    setDragOriginalLabel(null);
                    setDragOriginalColumn(null);
                    setDragOriginalSlab(null);
                    return;
                }

                // 6. Check Slabs
                const hitSlab = slabs.find(s => {
                    let inside = false;
                    for (let i = 0, j = s.points.length - 1; i < s.points.length; j = i++) {
                        const xi = s.points[i].x, yi = s.points[i].y;
                        const xj = s.points[j].x, yj = s.points[j].y;
                        const intersect = ((yi > worldPos.y) !== (yj > worldPos.y))
                            && (worldPos.x < (xj - xi) * (worldPos.y - yi) / (yj - yi) + xi);
                        if (intersect) inside = !inside;
                    }
                    return inside;
                });

                if (hitSlab) {
                    setSelectedId(hitSlab.id);
                    setDragStart(worldPos);
                    setDragOriginalSlab({ ...hitSlab });
                    setDragOriginalBeam(null);
                    setDragOriginalWall(null);
                    setDragOriginalLabel(null);
                    setDragOriginalColumn(null);
                    return;
                }

                // Clicked on empty space -> Deselect
                setSelectedId(null);
            }
            return;
        }

        // --- Tool: Wall Drawing ---
        if (tool === 'wall') {
            setSelectedId(null); // Deselect when drawing
            // Calculate Snap (Reuse handleMouseMove logic by calling it? No, local recalc)
            // NOTE: Using the cursor state (which is already snapped from MouseMove) is better, 
            // but we need to verify it's up to date. 
            // Let's do a quick recalc to be safe, or rely on 'cursor' if we trust it.
            // Relying on `cursor` state is risky if `mousemove` didn't fire perfectly before `mousedown`.
            // Let's re-run the core snap logic briefly.

            // ... Actually, for robustness, let's duplicate the critical snap logic or just use 'worldPos' passed through the filter.
            // But 'cursor' state contains the visual snap point. Let's use 'cursor' as it respects the visual feedback the user saw.
            let finalPoint = cursor;

            // Just double check if we haven't moved mouse at all (cursor might be 0,0 init)
            if (cursor.x === 0 && cursor.y === 0 && points.length === 0) finalPoint = roundPoint(snapToGrid(worldPos));

            if (!isDrawing) {
                setIsDrawing(true);
                setPoints([finalPoint]);
                // Precision Mode: Don't auto-drag, just set start point.
            } else {
                const start = points[0];
                const end = finalPoint;

                if (start.x !== end.x || start.y !== end.y) {
                    const newWall: Wall = {
                        id: generateId(),
                        start,
                        end,
                        thickness: toolSettings.wallType === 'partition' ? 150 : 225,
                        height: settings.wallHeightDefault,
                    };
                    setWalls([...walls, newWall]);
                    setPoints([end]); // Polyline - Continue drawing from end

                    // Precision Mode: Stop drawing after one segment if preferred? 
                    // No, Polyline is good. But we need to handle "Move" without "Drag".
                }
            }

        } else if (tool === 'beam') {
            // STRICT CONSTRAINT: Beams must start/end on Columns
            const hitColumn = columns.find(c => distance(worldPos, { x: c.x, y: c.y }) < 20);

            if (!hitColumn) {
                // Optional: Show feedback that placement is invalid
                return;
            }

            // If we are starting, just set the point
            if (points.length === 0) {
                setIsDrawing(true);
                setPoints([{ x: hitColumn.x, y: hitColumn.y }]);
            } else {
                // If ending, ensure it's a different column
                const start = points[0];
                const end = { x: hitColumn.x, y: hitColumn.y };

                if (start.x !== end.x || start.y !== end.y) {
                    const newBeam: Beam = {
                        id: generateId(),
                        start,
                        end,
                        width: 225,
                        depth: 450,
                        label: `B${beams.length + 1}`
                    };
                    setBeams([...beams, newBeam]);
                    // Reset for next beam (Polyline? Or Click-Click?)
                    // User guide says "Click start and end". Let's reset.
                    setPoints([]);
                    setIsDrawing(false);
                }
            }
        } else if (tool === 'slab') {
            // STRICT CONSTRAINT: Slab vertices must lie on Beams
            let isValidPlacement = false;
            let finalPoint = worldPos;

            // Check snap to beams
            // 1. Check endpoints
            for (const beam of beams) {
                if (distance(worldPos, beam.start) < 20) { isValidPlacement = true; finalPoint = beam.start; break; }
                if (distance(worldPos, beam.end) < 20) { isValidPlacement = true; finalPoint = beam.end; break; }
            }
            // 2. Check along beam
            if (!isValidPlacement) {
                for (const beam of beams) {
                    const { point } = getClosestPointOnLine(worldPos, beam.start, beam.end);
                    if (distance(worldPos, point) < 20) {
                        isValidPlacement = true;
                        finalPoint = point;
                        break;
                    }
                }
            }

            // Exception: Closing the loop
            if (points.length > 2 && distance(worldPos, points[0]) < 20) {
                isValidPlacement = true;
                finalPoint = points[0];
            }

            if (!isValidPlacement) {
                return; // Invalid placement
            }

            if (!isDrawing) {
                setIsDrawing(true);
                setPoints([finalPoint]);
            } else {
                // Check if closing the loop (click near start)
                const start = points[0];
                if (points.length > 2 && distance(finalPoint, start) < 20) {
                    // Close loop
                    const newSlab: Slab = {
                        id: generateId(),
                        points: [...points],
                        thickness: 150,
                        label: `S${slabs.length + 1} `
                    };
                    setSlabs([...slabs, newSlab]);
                    setPoints([]);
                    setIsDrawing(false);
                } else {
                    setPoints([...points, finalPoint]);
                }
            }

        } else if (tool === 'door' || tool === 'window') {
            if (previewOpening) {
                const width = tool === 'door' ? toolSettings.doorWidth : toolSettings.windowWidth;
                const height = tool === 'door' ? toolSettings.doorHeight : toolSettings.windowHeight;

                setOpenings([...openings, {
                    id: generateId(),
                    wallId: previewOpening.wall.id,
                    type: tool,
                    distanceFromStart: previewOpening.distFromStart,
                    width,
                    height
                }]);
            }
        } else if (tool === 'text') {
            // NEW: Immediate placement instead of prompt
            const newLabel = {
                id: generateId(),
                text: "Room", // Default Text
                x: worldPos.x,
                y: worldPos.y
            };
            setLabels([...labels, newLabel]);
            setTool('select'); // Auto switch to select after placing
            setSelectedId(newLabel.id); // Auto select so sidebar opens

        } else if (tool === 'column') {
            // Place Column
            // Check for rotation from snap
            let rotation = 0;
            if (wallSnap) {
                // Calculate angle of the wall
                rotation = getAngle(wallSnap.wall.start, wallSnap.wall.end);
            }

            const newColumn: Column = {
                id: generateId(),
                x: cursor.x,
                y: cursor.y,
                width: toolSettings.columnWidth || 225,
                height: toolSettings.columnHeight || 225,
                rotation: rotation
            };
            setColumns([...columns, newColumn]);
            // Optional: Auto-select or stay in tool? 
            // Stay in tool for rapid placement
            // Also select it to allow immediate editing?
            // setSelectedId(newColumn.id); 
            // setTool('select'); // Switch to select if we want one-off placement
            // setSelectedId(newColumn.id); 
            // setTool('select'); // Switch to select if we want one-off placement
        } else if (tool === 'section') {
            setSectionStart(worldPos);
            setIsDrawing(true);
        } else if (tool === 'eraser') {
            const openingToRemove = openings.find(o => {
                const w = walls.find(wall => wall.id === o.wallId);
                if (!w) return false;

                const wallLen = distance(w.start, w.end);
                if (wallLen === 0) return false;

                const dx = (w.end.x - w.start.x) / wallLen;
                const dy = (w.end.y - w.start.y) / wallLen;

                const ox = w.start.x + dx * o.distanceFromStart;
                const oy = w.start.y + dy * o.distanceFromStart;

                const visualWidth = o.width * SCALE;
                const dist = distance(worldPos, { x: ox, y: oy });
                return dist < (visualWidth / 2);
            });

            if (openingToRemove) {
                setOpenings(openings.filter(o => o.id !== openingToRemove.id));
                return;
            }

            const labelToRemove = labels.find(l => distance(worldPos, { x: l.x, y: l.y }) < 30);
            if (labelToRemove) {
                setLabels(labels.filter(l => l.id !== labelToRemove.id));
                return;
            }

            const columnToRemove = columns.find(c => {
                const w = (c.width || 225) * SCALE;
                const h = (c.height || 225) * SCALE;
                // Simple bounding box check
                return (
                    worldPos.x >= c.x - w / 2 &&
                    worldPos.x <= c.x + w / 2 &&
                    worldPos.y >= c.y - h / 2 &&
                    worldPos.y <= c.y + h / 2
                );
            });

            if (columnToRemove) {
                setColumns(columns.filter(c => c.id !== columnToRemove.id));
                return;
            }

            const wallToRemove = walls.find(w => {
                const { point } = getClosestPointOnLine(worldPos, w.start, w.end);
                return distance(worldPos, point) < 10;
            });

            if (wallToRemove) {
                setWalls(walls.filter(w => w.id !== wallToRemove.id));
                setOpenings(openings.filter(o => o.wallId !== wallToRemove.id));
                return;
            }

            // Remove Section Lines
            if (settings.sections) {
                const sectionToRemove = settings.sections.find(s => {
                    const { point } = getClosestPointOnLine(worldPos, s.start, s.end);
                    return distance(worldPos, point) < 10;
                });
                if (sectionToRemove) {
                    onUpdateSettings(prev => ({
                        ...prev,
                        sections: prev.sections?.filter(s => s.id !== sectionToRemove.id)
                    }));
                    return;
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent | TouchEvent) => {
        let clientX, clientY;
        let shiftKey = isShiftHeld;
        let isTouch = false;

        if ('touches' in e) {
            isTouch = true;
            // Handle Gestures (Pinch / Pan)
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];

                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const center = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };
                if (lastTouchRef.current) {
                    // 1. Pan
                    const dx = center.x - lastTouchRef.current.center.x;
                    const dy = center.y - lastTouchRef.current.center.y;

                    // 2. Zoom
                    const zoomDelta = dist - lastTouchRef.current.dist;
                    const zoomSensitivity = 0.005;
                    const oldScale = viewport.scale;
                    const newScale = Math.max(0.1, Math.min(5, oldScale + zoomDelta * zoomSensitivity));

                    // Apply Pan
                    let newVx = viewport.x + dx;
                    let newVy = viewport.y + dy;

                    // Apply Zoom (centered on pinch center)
                    // We need to adjust viewport x/y to keep the center point stable relative to the screen
                    // Logic: World point at center should remain at screen center
                    // Simple approximation: Zoom then Pan or just use the center diff

                    // Refined Zoom Logic:
                    if (Math.abs(zoomDelta) > 1) { // Threshold
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) {
                            const mouseX = center.x - rect.left;
                            const mouseY = center.y - rect.top;

                            const scaleRatio = newScale / oldScale;
                            newVx = mouseX - (mouseX - newVx) * scaleRatio;
                            newVy = mouseY - (mouseY - newVy) * scaleRatio;
                        }
                    }

                    setViewport(prev => ({
                        x: newVx,
                        y: newVy,
                        scale: newScale // Update scale
                    }));
                }

                lastTouchRef.current = { dist, center };
                return; // Stop processing as mouse move
            } else if (e.touches.length === 1) {
                lastTouchRef.current = null; // Reset gesture
                setScreenCursor({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY - TOUCH_OFFSET; // Apply Offset
            } else {
                return;
            }
        } else {
            const mouseEvent = e as React.MouseEvent;
            clientX = mouseEvent.clientX;
            clientY = mouseEvent.clientY;
            shiftKey = mouseEvent.shiftKey;
        }

        let worldPos = screenToWorld(clientX, clientY);

        // Precision Mode: If using D-Pad, we might ignore mouse move?
        // No, mouse/touch should still work.
        if (precisionMode && virtualCursor) {
            // If user touches screen, update virtual cursor?
            // Yes, allow coarse positioning with touch, fine with D-Pad.
            setVirtualCursor(worldPos);
        }
        if (isPanning) {
            const dx = clientX - panStart.x;
            const dy = clientY - panStart.y;
            setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setPanStart({ x: clientX, y: clientY });
            return;
        }



        // worldPos is already declared above
        // const worldPos = screenToWorld(clientX, clientY);

        // --- Dragging Logic (Select Mode) ---
        if (tool === 'select' && dragStart && selectedId) {
            const dx = worldPos.x - dragStart.x;
            const dy = worldPos.y - dragStart.y;

            // Drag Label
            if (dragOriginalLabel) {
                let finalX = dragOriginalLabel.x + dx;
                let finalY = dragOriginalLabel.y + dy;

                if (snapEnabled) {
                    const snapped = snapToGrid({ x: finalX, y: finalY });
                    finalX = snapped.x;
                    finalY = snapped.y;
                }
                setLabels(prev => prev.map(l => l.id === selectedId ? { ...l, x: finalX, y: finalY } : l));
                setLabels(prev => prev.map(l => l.id === selectedId ? { ...l, x: finalX, y: finalY } : l));
                return;
            }

            // Drag Column
            if (dragOriginalColumn) {
                let finalX = dragOriginalColumn.x + dx;
                let finalY = dragOriginalColumn.y + dy;
                let rotation = dragOriginalColumn.rotation || 0;

                if (snapEnabled) {
                    // Snap to Grid
                    const snapped = snapToGrid({ x: finalX, y: finalY });
                    finalX = snapped.x;
                    finalY = snapped.y;

                    // Snap to Wall (Edge Snap) for rotation and position
                    let closestEdgeDist = Infinity;
                    let edgePoint: Point | null = null;
                    let snappedWall: Wall | null = null;

                    walls.forEach(w => {
                        const { point } = getClosestPointOnLine({ x: finalX, y: finalY }, w.start, w.end);
                        const d = distance({ x: finalX, y: finalY }, point);
                        if (d < 15 && d < closestEdgeDist) {
                            closestEdgeDist = d;
                            edgePoint = point;
                            snappedWall = w;
                        }
                    });

                    if (edgePoint && snappedWall) {
                        finalX = edgePoint.x;
                        finalY = edgePoint.y;
                        rotation = getAngle(snappedWall.start, snappedWall.end);
                    }
                }

                setColumns(prev => prev.map(c => c.id === selectedId ? { ...c, x: finalX, y: finalY, rotation } : c));
                return;
            }

            // Drag Wall
            if (dragOriginalWall) {
                // Calculate tentative new positions based on ORIGINAL + DELTA
                const tentativeStart = { x: dragOriginalWall.start.x + dx, y: dragOriginalWall.start.y + dy };
                const tentativeEnd = { x: dragOriginalWall.end.x + dx, y: dragOriginalWall.end.y + dy };

                let finalDx = dx;
                let finalDy = dy;
                let currentSnapType: SnapType = 'none';
                let guides: SnapGuide[] = [];
                let snapped = false;

                if (snapEnabled) {
                    const otherWalls = walls.filter(w => w.id !== selectedId);

                    // 1. Check Start Point Snap
                    const startSnap = checkSnapToNodes(tentativeStart, otherWalls);
                    if (startSnap) {
                        finalDx = startSnap.point.x - dragOriginalWall.start.x;
                        finalDy = startSnap.point.y - dragOriginalWall.start.y;
                        currentSnapType = startSnap.type;
                        setCursor(startSnap.point); // Visual feedback
                        snapped = true;
                    }

                    // 2. Check End Point Snap (if Start didn't snap)
                    if (!snapped) {
                        const endSnap = checkSnapToNodes(tentativeEnd, otherWalls);
                        if (endSnap) {
                            finalDx = endSnap.point.x - dragOriginalWall.end.x;
                            finalDy = endSnap.point.y - dragOriginalWall.end.y;
                            currentSnapType = endSnap.type;
                            setCursor(endSnap.point); // Visual feedback
                            snapped = true;
                        }
                    }

                    // 3. Alignment Guides (if no node snap)
                    if (!snapped) {
                        const alignStart = getAlignmentGuides(tentativeStart, otherWalls);
                        if (alignStart.guides.length > 0) {
                            const snappedPt = alignStart.point;
                            finalDx = snappedPt.x - dragOriginalWall.start.x;
                            finalDy = snappedPt.y - dragOriginalWall.start.y;
                            guides = alignStart.guides;
                            currentSnapType = 'alignment';
                            snapped = true;
                        }
                    }
                }

                // Round geometry for hygiene
                const newStart = roundPoint({ x: dragOriginalWall.start.x + finalDx, y: dragOriginalWall.start.y + finalDy });
                const newEnd = roundPoint({ x: dragOriginalWall.end.x + finalDx, y: dragOriginalWall.end.y + finalDy });

                setWalls(prev => prev.map(w => w.id === selectedId ? {
                    ...w,
                    start: newStart,
                    end: newEnd
                } : w));

                setSnapType(currentSnapType);
                setActiveGuides(guides);
            }

            // Drag Beam
            if (dragOriginalBeam) {
                let finalStart = { x: dragOriginalBeam.start.x + dx, y: dragOriginalBeam.start.y + dy };
                let finalEnd = { x: dragOriginalBeam.end.x + dx, y: dragOriginalBeam.end.y + dy };

                if (snapEnabled) {
                    finalStart = snapToGrid(finalStart);
                    finalEnd = snapToGrid(finalEnd);
                }

                setBeams(prev => prev.map(b => b.id === selectedId ? { ...b, start: finalStart, end: finalEnd } : b));
                return;
            }

            // Drag Slab
            if (dragOriginalSlab) {
                const newPoints = dragOriginalSlab.points.map(p => ({
                    x: p.x + dx,
                    y: p.y + dy
                }));
                // Note: Not snapping individual points to avoid distortion during drag
                setSlabs(prev => prev.map(s => s.id === selectedId ? { ...s, points: newPoints } : s));
                return;
            }
            return;
        }

        // --- Logic Separation by Tool ---

        if (tool === 'wall') {
            let finalPoint = worldPos;
            let currentSnapType: SnapType = 'none';
            let guides: SnapGuide[] = [];
            let newWallSnap = null;

            if (snapEnabled) {
                finalPoint = snapToGrid(worldPos);
                currentSnapType = 'grid';

                // 1. Shift Ortho Constraint + Ray Casting (Smart Intersection)
                if (isDrawing && points.length > 0 && shiftKey) {
                    const start = points[0];
                    const dx = Math.abs(worldPos.x - start.x);
                    const dy = Math.abs(worldPos.y - start.y);

                    // Define Constraints
                    let constrainedX = worldPos.x;
                    let constrainedY = worldPos.y;
                    let isVertical = false;

                    if (dx > dy) {
                        constrainedY = start.y; // Horizontal Line
                    } else {
                        constrainedX = start.x; // Vertical Line
                        isVertical = true;
                    }

                    // Check for Intersection with existing walls along this Ray
                    let intersectionSnap = false;

                    // We define a ray from Start to essentially infinity (or canvas bounds) in the constrained direction
                    // For simplicity, we create a long segment matching the user's direction
                    const rayEnd = {
                        x: isVertical ? constrainedX : (worldPos.x > start.x ? 50000 : -50000),
                        y: isVertical ? (worldPos.y > start.y ? 50000 : -50000) : constrainedY
                    };

                    // Check intersections
                    let closestIntDist = Infinity;
                    let closestIntPoint: Point | null = null;
                    let closestIntWall: Wall | null = null;

                    walls.forEach(w => {
                        const int = getLineIntersection(start, rayEnd, w.start, w.end);
                        if (int) {
                            const d = distance(start, int);
                            if (d < closestIntDist) {
                                closestIntDist = d;
                                closestIntPoint = int;
                                closestIntWall = w;
                            }
                        }
                    });

                    if (closestIntPoint && closestIntWall) {
                        // Found a wall in our Ortho path! Snap to it.
                        finalPoint = closestIntPoint;
                        currentSnapType = 'intersection'; // Special marker
                        intersectionSnap = true;

                        // Add Edge Snap Context
                        const distStart = distance((closestIntWall as Wall).start, closestIntPoint);
                        newWallSnap = { wall: closestIntWall, point: closestIntPoint, distFromStart: distStart };
                    } else {
                        // No intersection, just standard ortho constraint
                        finalPoint = { x: constrainedX, y: constrainedY };
                        currentSnapType = 'none';
                    }

                    guides = []; // Clear guides in Shift mode as we are strictly constrained

                } else {
                    // 2. Alignment & Node Snaps (Normal Mode)
                    const alignment = getAlignmentGuides(worldPos, walls);
                    if (alignment.guides.length > 0) {
                        finalPoint = alignment.point;
                        guides = alignment.guides;
                        currentSnapType = 'alignment';
                    }

                    if (isDrawing && points.length > 0 && guides.length === 0) {
                        const snapped = snapToAngle(points[0], worldPos);
                        if (snapped.snapped) {
                            finalPoint = snapped.point;
                        }
                    }

                    const nodeSnap = checkSnapToNodes(worldPos, walls);
                    if (nodeSnap) {
                        finalPoint = nodeSnap.point;
                        currentSnapType = nodeSnap.type;
                        guides = [];
                    } else {
                        // 3. Edge Snap (If no Node Snap)
                        let closestEdgeDist = Infinity;
                        let edgePoint: Point | null = null;
                        let snappedWall: Wall | null = null;

                        walls.forEach(w => {
                            const { point } = getClosestPointOnLine(worldPos, w.start, w.end);
                            const d = distance(worldPos, point);
                            if (d < 15 && d < closestEdgeDist) { // 15px threshold matches node snap roughly
                                closestEdgeDist = d;
                                edgePoint = point;
                                snappedWall = w;
                            }
                        });

                        if (edgePoint && snappedWall && !alignment.guides.length) {
                            finalPoint = edgePoint;
                            currentSnapType = 'edge';
                            const distStart = distance(snappedWall.start, edgePoint);
                            newWallSnap = { wall: snappedWall, point: edgePoint, distFromStart: distStart };
                        }
                    }
                }
            }

            // Data Hygiene: Round
            finalPoint = roundPoint(finalPoint);

            setCursor(finalPoint);
            setActiveGuides(guides);
            setSnapType(currentSnapType);
            setWallSnap(newWallSnap);
            setPreviewOpening(null);

        } else if (tool === 'beam') {
            // STRICT SNAP: Only snap to Columns
            let finalPoint = worldPos;
            let currentSnapType: SnapType = 'none';

            const hitColumn = columns.find(c => distance(worldPos, { x: c.x, y: c.y }) < 25);
            if (hitColumn) {
                finalPoint = { x: hitColumn.x, y: hitColumn.y };
                currentSnapType = 'endpoint'; // Reuse endpoint visual or create new 'node' type
            }

            setCursor(finalPoint); // Don't round if not snapped? Or round to grid? 
            // If strict, we only care if it matches a column.
            // But for visual feedback, let's just follow mouse if not snapped.
            setSnapType(currentSnapType);
            setActiveGuides([]);
            setPreviewOpening(null);
            setWallSnap(null);

        } else if (tool === 'slab') {
            // STRICT SNAP: Snap to Beams (Endpoints or Edge)
            let finalPoint = worldPos;
            let currentSnapType: SnapType = 'none';
            let snapped = false;

            // 1. Check Beam Endpoints (High Priority)
            for (const beam of beams) {
                if (distance(worldPos, beam.start) < 20) {
                    finalPoint = beam.start;
                    currentSnapType = 'endpoint';
                    snapped = true;
                    break;
                }
                if (distance(worldPos, beam.end) < 20) {
                    finalPoint = beam.end;
                    currentSnapType = 'endpoint';
                    snapped = true;
                    break;
                }
            }

            // 2. Check Beam Edges
            if (!snapped) {
                for (const beam of beams) {
                    const { point } = getClosestPointOnLine(worldPos, beam.start, beam.end);
                    if (distance(worldPos, point) < 20) {
                        finalPoint = point;
                        currentSnapType = 'edge';
                        snapped = true;
                        break;
                    }
                }
            }

            // 3. Check Start Point (for closing loop)
            if (points.length > 0 && distance(worldPos, points[0]) < 20) {
                finalPoint = points[0];
                currentSnapType = 'endpoint';
                snapped = true;
            }

            setCursor(finalPoint);
            setSnapType(currentSnapType);
            setActiveGuides([]);
            setPreviewOpening(null);
            setWallSnap(null);

        } else if (tool === 'door' || tool === 'window') {
            // Opening Preview Logic
            const SNAP_THRESHOLD = 500; // World units
            let closestWall: Wall | null = null;
            let minDesc = Infinity;
            let projection: Point = { x: 0, y: 0 };
            let distStart = 0;

            walls.forEach(w => {
                const { point } = getClosestPointOnLine(worldPos, w.start, w.end);
                const d = distance(worldPos, point);

                if (d < minDesc && d < SNAP_THRESHOLD) {
                    minDesc = d;
                    closestWall = w;
                    projection = point;
                    distStart = distance(w.start, point);
                }
            });

            if (closestWall) {
                setPreviewOpening({
                    wall: closestWall,
                    point: projection,
                    distFromStart: distStart
                });
                setCursor(projection);
            } else {
                setPreviewOpening(null);
                setCursor(worldPos);
            }
            setActiveGuides([]);
            setSnapType('none');
            setWallSnap(null);

            setWallSnap(null);

        } else if (tool === 'column') {
            let finalPoint = worldPos;
            let currentSnapType: SnapType = 'none';
            let guides: SnapGuide[] = [];
            let newWallSnap = null;

            if (snapEnabled) {
                // Sticky Snap Logic: Check Wall Snap FIRST with a generous threshold
                let closestEdgeDist = Infinity;
                let edgePoint: Point | null = null;
                let snappedWall: Wall | null = null;

                walls.forEach(w => {
                    const { point } = getClosestPointOnLine(worldPos, w.start, w.end);
                    const d = distance(worldPos, point);
                    // Increased threshold for "Sticky" feel (25px)
                    if (d < 25 && d < closestEdgeDist) {
                        closestEdgeDist = d;
                        edgePoint = point;
                        snappedWall = w;
                    }
                });

                if (edgePoint && snappedWall) {
                    // STICKY SNAP: We are on a wall.
                    // CHECK ALIGNMENT ON WALL: Can we slide along the wall to align with another column?
                    finalPoint = edgePoint;
                    currentSnapType = 'edge';

                    const ALIGN_THRESHOLD = 20;
                    let alignX: number | null = null;
                    let alignY: number | null = null;

                    // Check for intersections between the Wall Line and Alignment Lines
                    columns.forEach(col => {
                        // Vertical Alignment Line (x = col.x)
                        if (Math.abs(edgePoint!.x - col.x) < ALIGN_THRESHOLD) {
                            // Project onto wall? No, find intersection of Wall and X=col.x
                            // If wall is vertical, it's either all aligned or none.
                            // If wall is not vertical, there is a unique point on the wall with x = col.x
                            // Check if that point is on the segment?
                            // Simplified: Just check if current edgePoint.x is close to col.x
                            // But we want to SNAP to col.x IF it lies on the wall.

                            // Solve for Y on wall given X = col.x
                            if (Math.abs(snappedWall!.start.x - snappedWall!.end.x) > 1) { // Not vertical wall
                                const m = (snappedWall!.end.y - snappedWall!.start.y) / (snappedWall!.end.x - snappedWall!.start.x);
                                const c = snappedWall!.start.y - m * snappedWall!.start.x;
                                const targetY = m * col.x + c;

                                // Check if this point (col.x, targetY) is on the segment
                                const minX = Math.min(snappedWall!.start.x, snappedWall!.end.x);
                                const maxX = Math.max(snappedWall!.start.x, snappedWall!.end.x);
                                if (col.x >= minX - 1 && col.x <= maxX + 1) {
                                    // Check distance to cursor
                                    if (distance(worldPos, { x: col.x, y: targetY }) < ALIGN_THRESHOLD) {
                                        finalPoint = { x: col.x, y: targetY };
                                        guides.push({ type: 'alignment', orientation: 'vertical', position: col.x, refPoint: { x: col.x, y: col.y } });
                                        currentSnapType = 'intersection';
                                    }
                                }
                            } else {
                                // Vertical wall: x is constant. If col.x matches, whole wall aligns.
                                if (Math.abs(snappedWall!.start.x - col.x) < 5) {
                                    guides.push({ type: 'alignment', orientation: 'vertical', position: col.x, refPoint: { x: col.x, y: col.y } });
                                }
                            }
                        }

                        // Horizontal Alignment Line (y = col.y)
                        if (Math.abs(edgePoint!.y - col.y) < ALIGN_THRESHOLD) {
                            if (Math.abs(snappedWall!.start.y - snappedWall!.end.y) > 1) { // Not horizontal wall
                                // Check if Vertical Wall (dx ~ 0)
                                if (Math.abs(snappedWall!.start.x - snappedWall!.end.x) < 1) {
                                    // Vertical Wall: X is constant.
                                    const targetX = snappedWall!.start.x;
                                    const minY = Math.min(snappedWall!.start.y, snappedWall!.end.y);
                                    const maxY = Math.max(snappedWall!.start.y, snappedWall!.end.y);

                                    if (col.y >= minY - 1 && col.y <= maxY + 1) {
                                        if (distance(worldPos, { x: targetX, y: col.y }) < ALIGN_THRESHOLD) {
                                            finalPoint = { x: targetX, y: col.y };
                                            guides.push({ type: 'alignment', orientation: 'horizontal', position: col.y, refPoint: { x: col.x, y: col.y } });
                                            currentSnapType = 'intersection';
                                        }
                                    }
                                } else {
                                    // Diagonal Wall
                                    // Solve for X on wall given Y = col.y
                                    // x = (y - c) / m
                                    const m = (snappedWall!.end.y - snappedWall!.start.y) / (snappedWall!.end.x - snappedWall!.start.x);
                                    const c = snappedWall!.start.y - m * snappedWall!.start.x;
                                    const targetX = (col.y - c) / m;

                                    const minY = Math.min(snappedWall!.start.y, snappedWall!.end.y);
                                    const maxY = Math.max(snappedWall!.start.y, snappedWall!.end.y);

                                    if (col.y >= minY - 1 && col.y <= maxY + 1) {
                                        if (distance(worldPos, { x: targetX, y: col.y }) < ALIGN_THRESHOLD) {
                                            finalPoint = { x: targetX, y: col.y };
                                            guides.push({ type: 'alignment', orientation: 'horizontal', position: col.y, refPoint: { x: col.x, y: col.y } });
                                            currentSnapType = 'intersection';
                                        }
                                    }
                                }
                            } else {
                                // Horizontal wall
                                if (Math.abs(snappedWall!.start.y - col.y) < 5) {
                                    guides.push({ type: 'alignment', orientation: 'horizontal', position: col.y, refPoint: { x: col.x, y: col.y } });
                                }
                            }
                        }
                    });

                    const distStart = distance(snappedWall.start, finalPoint);
                    newWallSnap = { wall: snappedWall, point: finalPoint, distFromStart: distStart };
                } else {
                    // 1. Global Column Alignment (Infinite Guides)
                    const ALIGN_THRESHOLD = 20; // Snap distance
                    let alignX: number | null = null;
                    let alignY: number | null = null;

                    columns.forEach(col => {
                        // Don't snap to self if moving (though here we are placing new, so ok)
                        if (Math.abs(worldPos.x - col.x) < ALIGN_THRESHOLD) {
                            alignX = col.x;
                            guides.push({
                                type: 'alignment',
                                orientation: 'vertical',
                                position: col.x,
                                refPoint: { x: col.x, y: col.y }
                            });
                        }
                        if (Math.abs(worldPos.y - col.y) < ALIGN_THRESHOLD) {
                            alignY = col.y;
                            guides.push({
                                type: 'alignment',
                                orientation: 'horizontal',
                                position: col.y,
                                refPoint: { x: col.x, y: col.y }
                            });
                        }
                    });

                    // Apply Alignment
                    if (alignX !== null) finalPoint.x = alignX;
                    if (alignY !== null) finalPoint.y = alignY;

                    if (alignX !== null || alignY !== null) {
                        currentSnapType = 'alignment';
                    } else {
                        // 2. Grid Snap (Fallback)
                        finalPoint = snapToGrid(worldPos);
                        currentSnapType = 'grid';
                    }

                    // 3. Node Snap (Wall Ends) - Check this AFTER grid/alignment to refine?
                    const nodeSnap = checkSnapToNodes(worldPos, walls);
                    if (nodeSnap) {
                        finalPoint = nodeSnap.point;
                        currentSnapType = nodeSnap.type;
                        // Clear alignment guides if we snap to a node (usually preferred)
                        // Or keep them? Let's clear to avoid clutter if node snap takes precedence
                        guides = [];
                    }
                }
            }

            setCursor(roundPoint(finalPoint));
            setSnapType(currentSnapType);
            setActiveGuides(guides);
            setPreviewOpening(null);
            setWallSnap(newWallSnap); // Store wall snap for rotation logic in MouseDown

            setWallSnap(null);
        } else if (tool === 'section') {
            // Snap to Grid for Section Lines
            let finalPoint = worldPos;
            if (snapEnabled) {
                finalPoint = snapToGrid(worldPos);
            }
            setCursor(finalPoint);
        } else {
            setCursor(worldPos);
            setActiveGuides([]);
            setSnapType('none');
            setPreviewOpening(null);
            setWallSnap(null);
        }
    };

    const handleMouseUp = () => {
        setShowMagnifier(false);
        // Only stop drawing if NOT in wall/beam/slab mode (polyline/polygon)
        if (tool !== 'wall' && tool !== 'beam' && tool !== 'slab') {
            setIsDrawing(false);
        }

        // Precision Mode: In "Click-Click" mode, MouseUp doesn't necessarily mean "Stop Dragging" 
        // because we aren't dragging. We are just clicking.
        // So standard logic applies: We finished the "Action" of the click.

        setDragStart(null);
        setDragOriginalWall(null);
        setDragOriginalLabel(null);
        setDragOriginalColumn(null);
        setIsPanning(false);
        lastTouchRef.current = null; // Reset gesture state

        // Finalize Wall
        if (tool === 'wall' && points.length > 0) {
            // If we just finished a segment, we stay in drawing mode for polyline
            // But if we want to stop? Usually double click or Esc.
            // For mobile, maybe a "Done" button or just keep drawing.
        }
        // Reset snap state on mouse up
        setSnapType('none');
        setActiveGuides([]);


        if (tool === 'section' && sectionStart) {
            const endPoint = cursor; // Use snapped cursor
            if (distance(sectionStart, endPoint) > 10) {
                const newSection: SectionLine = {
                    id: generateId(),
                    start: sectionStart,
                    end: endPoint,
                    label: `Section ${String.fromCharCode(65 + (settings.sections?.length || 0))} ` // A, B, C...
                };
                onUpdateSettings(prev => ({
                    ...prev,
                    sections: [...(prev.sections || []), newSection]
                }));
            }
            setSectionStart(null);
            setIsDrawing(false);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const oldScale = viewport.scale;
        const newScale = Math.max(0.1, Math.min(5, oldScale + delta));

        const newX = mouseX - (mouseX - viewport.x) * (newScale / oldScale);
        const newY = mouseY - (mouseY - viewport.y) * (newScale / oldScale);

        setViewport({ x: newX, y: newY, scale: newScale });
    };

    const handleZoomBtn = (direction: 1 | -1) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const oldScale = viewport.scale;
        const newScale = Math.max(0.1, Math.min(5, oldScale + (direction * 0.2)));

        const newX = centerX - (centerX - viewport.x) * (newScale / oldScale);
        const newY = centerY - (centerY - viewport.y) * (newScale / oldScale);

        setViewport({ x: newX, y: newY, scale: newScale });
    }

    const updateSelectedColumnProperty = (id: string, updates: { width?: number, height?: number, rotation?: number, padWidth?: number, padLength?: number }) => {
        setColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }

    const updateSelectedWallProperty = (id: string, updates: { length?: number, angle?: number }) => {
        const wall = walls.find(w => w.id === id);
        if (wall && updates.length !== undefined && updates.angle !== undefined) {
            const start = wall.start;
            const rads = updates.angle * (Math.PI / 180);
            const lengthPx = updates.length * SCALE;

            const newEnd = {
                x: start.x + Math.cos(rads) * lengthPx,
                y: start.y + Math.sin(rads) * lengthPx
            };

            setWalls(prev => prev.map(w => w.id === id ? { ...w, end: roundPoint(newEnd) } : w));
        }
    }

    // --- Keyboard Input (Dynamic Boxes) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isPlacingOpening = (tool === 'door' || tool === 'window') && previewOpening;
            const isDrawingWall = tool === 'wall' && isDrawing;
            // If selecting, and pressing numbers, maybe allow changing length? 
            // For now let's keep it simple to just drawing actions

            if (isDrawingWall || isPlacingOpening) {
                if (/^[0-9]$/.test(e.key)) {
                    setInputVisible(true);
                    setInputValue(prev => prev + e.key);
                } else if (e.key === 'Backspace') {
                    setInputValue(prev => prev.slice(0, -1));
                } else if (e.key === 'Enter' && inputVisible) {
                    const value = parseInt(inputValue);
                    if (isNaN(value)) return;

                    if (isDrawingWall && points.length > 0) {
                        const start = points[0];
                        const dx = cursor.x - start.x;
                        const dy = cursor.y - start.y;
                        const angle = Math.atan2(dy, dx);

                        const lenPx = value * SCALE;
                        const end = {
                            x: start.x + Math.cos(angle) * lenPx,
                            y: start.y + Math.sin(angle) * lenPx
                        };

                        const endRounded = roundPoint(end); // Round

                        const newWall: Wall = {
                            id: generateId(),
                            start,
                            end: endRounded,
                            thickness: toolSettings.wallType === 'partition' ? 150 : 225,
                            height: settings.wallHeightDefault,
                        };
                        setWalls([...walls, newWall]);
                        setPoints([endRounded]);
                    } else if (isPlacingOpening && previewOpening) {
                        const { wall, distFromStart } = previewOpening;
                        const wallLen = distance(wall.start, wall.end) / SCALE;
                        const distFromEnd = wallLen - (distFromStart / SCALE);

                        let newDistFromStartPx = 0;
                        if (distFromStart < (wallLen * SCALE) / 2) {
                            newDistFromStartPx = value * SCALE;
                        } else {
                            newDistFromStartPx = (wallLen * SCALE) - (value * SCALE);
                        }

                        const wallLenPx = wallLen * SCALE;
                        newDistFromStartPx = Math.max(0, Math.min(wallLenPx, newDistFromStartPx));

                        const width = tool === 'door' ? toolSettings.doorWidth : toolSettings.windowWidth;
                        const height = tool === 'door' ? toolSettings.doorHeight : toolSettings.windowHeight;

                        setOpenings([...openings, {
                            id: generateId(),
                            wallId: wall.id,
                            type: tool as 'door' | 'window',
                            distanceFromStart: newDistFromStartPx,
                            width,
                            height
                        }]);
                    }

                    setInputValue('');
                    setInputVisible(false);

                } else if (e.key === 'Escape') {
                    setIsDrawing(false);
                    setPoints([]);
                    setInputVisible(false);
                    setInputValue('');
                    setActiveGuides([]);
                    setSnapType('none');
                    setSelectedId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDrawing, inputValue, cursor, walls, points, tool, previewOpening, openings, settings, toolSettings]);

    // --- Render Helpers ---

    const renderArchitecturalDimension = (start: Point, end: Point, text?: string, offset: number = 40, color: string = "#94a3b8", highlight: boolean = false, fontSizeOverride?: number) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);

        const p1 = { x: start.x + nx * offset, y: start.y + ny * offset };
        const p2 = { x: end.x + nx * offset, y: end.y + ny * offset };

        const gap = 10;
        const ext1Start = { x: start.x + nx * gap, y: start.y + ny * gap };
        const ext2Start = { x: end.x + nx * gap, y: end.y + ny * gap };

        const ext1End = { x: p1.x + nx * 5, y: p1.y + ny * 5 };
        const ext2End = { x: p2.x + nx * 5, y: p2.y + ny * 5 };

        let textRotation = angle * (180 / Math.PI);

        if (textRotation > 90) textRotation -= 180;
        if (textRotation <= -90) textRotation += 180;

        const displayValue = text || Math.round(length / SCALE).toString();

        const fontSize = fontSizeOverride || 16; // Use override or default
        const textWidth = (displayValue.length * 10) + 10;
        const textOffset = -10;

        return (
            <g>
                {/* Main Line */}
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={1.5} />

                {/* Extension Lines */}
                <line x1={ext1Start.x} y1={ext1Start.y} x2={ext1End.x} y2={ext1End.y} stroke={color} strokeWidth={1} />
                <line x1={ext2Start.x} y1={ext2Start.y} x2={ext2End.x} y2={ext2End.y} stroke={color} strokeWidth={1} />

                {/* Ticks (using transforms) */}
                <g transform={`translate(${p1.x}, ${p1.y}) rotate(${angle * (180 / Math.PI)})`}>
                    <line x1={-4} y1={4} x2={4} y2={-4} stroke={color} strokeWidth={1.5} />
                </g>
                <g transform={`translate(${p2.x}, ${p2.y}) rotate(${angle * (180 / Math.PI)})`}>
                    <line x1={-4} y1={4} x2={4} y2={-4} stroke={color} strokeWidth={1.5} />
                </g>

                {/* Text Label */}
                <g transform={`translate(${(p1.x + p2.x) / 2}, ${(p1.y + p2.y) / 2}) rotate(${textRotation})`}>
                    {/* Background Box for Readability */}
                    <rect x={-(textWidth / 2) - 6} y={textOffset - fontSize - 2} width={textWidth + 12} height={fontSize + 6} fill="rgba(15, 23, 42, 0.95)" rx={4} stroke={color} strokeWidth={1} />
                    <text
                        x={0}
                        y={textOffset}
                        textAnchor="middle"
                        fill={highlight ? "#facc15" : "#e2e8f0"} // Brighter text
                        fontSize={fontSize}
                        fontFamily="monospace"
                        fontWeight="bold"
                    >
                        {displayValue} mm
                    </text>
                </g>
            </g>
        );
    }

    const renderOpening = (wall: Wall, opening: Opening, isSelected: boolean = false) => {
        const wallLen = distance(wall.start, wall.end);
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        const widthPx = opening.width * SCALE;
        const heightPx = wall.thickness * SCALE;

        const ux = dx / wallLen;
        const uy = dy / wallLen;

        const cx = wall.start.x + ux * opening.distanceFromStart;
        const cy = wall.start.y + uy * opening.distanceFromStart;

        const fontSize = Math.max(10, settings.dimensionFontSize ? settings.dimensionFontSize - 2 : 10);
        const label = `${Math.round(opening.width)} mm`;
        const labelWidth = label.length * (fontSize * 0.6);

        // Correct Text Orientation
        let textRot = angle;
        if (textRot > 90) textRot -= 180;
        if (textRot <= -90) textRot += 180;

        const isDoor = opening.type === 'door';
        const doorColor = isSelected ? '#f97316' : '#a855f7';
        const windowColor = isSelected ? '#f97316' : '#3b82f6';

        return (
            <g key={opening.id} transform={`translate(${cx}, ${cy})`}>
                <g transform={`rotate(${angle})`}>
                    {/* Selection Highlight */}
                    {isSelected && (
                        <rect x={-widthPx / 2 - 4} y={-heightPx / 2 - 4} width={widthPx + 8} height={heightPx + 8} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="4,2" />
                    )}

                    {/* Opening Background - clear the wall */}
                    <rect
                        x={-widthPx / 2}
                        y={-heightPx / 2}
                        width={widthPx}
                        height={heightPx}
                        fill="#1e293b"
                    />

                    {isDoor ? (
                        /* ===== REALISTIC DOOR ===== */
                        <>
                            {/* Door Jambs (wall edges) */}
                            <line x1={-widthPx / 2} y1={-heightPx / 2} x2={-widthPx / 2} y2={heightPx / 2} stroke={doorColor} strokeWidth={3} />
                            <line x1={widthPx / 2} y1={-heightPx / 2} x2={widthPx / 2} y2={heightPx / 2} stroke={doorColor} strokeWidth={3} />

                            {/* Door Leaf (the actual door panel) - thick line */}
                            <line
                                x1={-widthPx / 2}
                                y1={heightPx / 2}
                                x2={-widthPx / 2 + widthPx * 0.95}
                                y2={heightPx / 2}
                                stroke={doorColor}
                                strokeWidth={4}
                            />

                            {/* Door Swing Arc (90 degree arc) */}
                            <path
                                d={`M ${-widthPx / 2 + widthPx * 0.95} ${heightPx / 2} 
                                    A ${widthPx * 0.95} ${widthPx * 0.95} 0 0 0 ${-widthPx / 2} ${heightPx / 2 + widthPx * 0.95}`}
                                fill="none"
                                stroke={doorColor}
                                strokeWidth={1.5}
                                strokeDasharray="6 4"
                                opacity={0.7}
                            />

                            {/* Door Direction Triangle */}
                            <polygon
                                points={`${-widthPx / 2 + 8},${heightPx / 2 + 6} ${-widthPx / 2 + 16},${heightPx / 2 + 12} ${-widthPx / 2 + 8},${heightPx / 2 + 18}`}
                                fill={doorColor}
                                opacity={0.6}
                            />

                            {/* Door Handle indicator */}
                            <circle cx={-widthPx / 2 + widthPx * 0.85} cy={heightPx / 2} r={2.5} fill={doorColor} />
                        </>
                    ) : (
                        /* ===== REALISTIC WINDOW ===== */
                        <>
                            {/* Window Frame */}
                            <rect
                                x={-widthPx / 2}
                                y={-heightPx / 2}
                                width={widthPx}
                                height={heightPx}
                                fill="none"
                                stroke={windowColor}
                                strokeWidth={2}
                            />

                            {/* Window Cross (mullions) */}
                            <line x1={0} y1={-heightPx / 2} x2={0} y2={heightPx / 2} stroke={windowColor} strokeWidth={1.5} />
                            <line x1={-widthPx / 2} y1={0} x2={widthPx / 2} y2={0} stroke={windowColor} strokeWidth={1.5} />

                            {/* Window Glass indication - subtle fill */}
                            <rect
                                x={-widthPx / 2 + 2}
                                y={-heightPx / 2 + 2}
                                width={widthPx / 2 - 3}
                                height={heightPx - 4}
                                fill="#3b82f6"
                                opacity={0.15}
                            />
                            <rect
                                x={1}
                                y={-heightPx / 2 + 2}
                                width={widthPx / 2 - 3}
                                height={heightPx - 4}
                                fill="#3b82f6"
                                opacity={0.15}
                            />
                        </>
                    )}
                </g>

                {/* Permanent Opening Dimension */}
                {showDimensions && (
                    <g transform={`rotate(${textRot})`}>
                        <rect x={-(labelWidth / 2) - 2} y={-heightPx / 2 - fontSize - 6} width={labelWidth + 4} height={fontSize + 2} fill="rgba(15,23,42,0.8)" rx={2} />
                        <text
                            x={0}
                            y={-heightPx / 2 - 4}
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize={fontSize}
                            className="pointer-events-none select-none"
                        >
                            {label}
                        </text>
                    </g>
                )}
            </g>
        );
    };

    const renderDimensions = (wall: Wall) => {
        if (!showDimensions) return null;
        // Use Wall-specific offset if available, else Global Setting, else Default
        const baseOffset = (wall.dimensionOffset !== undefined) ? wall.dimensionOffset : (settings.dimensionOffset || 50);

        // Use Wall-specific font size if available, else Global Setting, else Default (undefined -> handled in renderArchitecturalDimension)
        const fontSize = (wall.dimensionFontSize !== undefined) ? wall.dimensionFontSize : settings.dimensionFontSize;

        // Stack the main dimension further out if we assume openings might take the inner space
        // We add a bit of padding (e.g., 40px) to stack it outside the "split" dimensions
        return renderArchitecturalDimension(wall.start, wall.end, undefined, baseOffset + 40, "#94a3b8", false, fontSize);
    }

    const renderLabels = () => {
        return labels.map(l => {
            const isSelected = selectedId === l.id;
            const width = (l.text.length * 10) + 20;
            return (
                <g key={l.id} transform={`translate(${l.x}, ${l.y})`}>
                    {/* Background Box */}
                    <rect
                        x={-(width / 2)}
                        y={-15}
                        width={width}
                        height={30}
                        fill="rgba(15, 23, 42, 0.8)"
                        rx={4}
                        stroke={isSelected ? "#f97316" : "rgba(251, 191, 36, 0.5)"}
                        strokeWidth={isSelected ? 2 : 1}
                    />
                    <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSelected ? "#f97316" : "#fbbf24"}
                        fontSize={18}
                        fontWeight="bold"
                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,1)' }}
                    >
                        {l.text}
                    </text>
                </g>
            );
        });
    };
    const renderWallSplitDimensions = (wall: Wall, point: Point, distFromStart: number) => {
        const wallLen = distance(wall.start, wall.end);
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / length;
        const uy = dy / length;
        const isStartCloser = distFromStart < (wallLen / 2);
        const projX = wall.start.x + ux * distFromStart;
        const projY = wall.start.y + uy * distFromStart;
        const pProj = { x: projX, y: projY };

        const baseOffset = settings.dimensionOffset || 50;

        return (
            <g className="pointer-events-none">
                {renderArchitecturalDimension(wall.start, pProj, undefined, baseOffset, "#64748b", isStartCloser)}
                {renderArchitecturalDimension(pProj, wall.end, undefined, baseOffset, "#64748b", !isStartCloser)}
            </g>
        )
    }

    const renderPreviewDimensions = () => {
        if (!previewOpening) return null;
        return renderWallSplitDimensions(previewOpening.wall, previewOpening.point, previewOpening.distFromStart);
    }

    const renderWallSnapDimensions = () => {
        if (!wallSnap) return null;
        return renderWallSplitDimensions(wallSnap.wall, wallSnap.point, wallSnap.distFromStart);
    }

    const renderTooltip = () => {
        if (!isDrawing || points.length === 0) return null;
        const start = points[0];
        const current = cursor;
        const len = Math.round(distance(start, current) / SCALE);
        const ang = Math.round(getAngle(start, current));
        const midX = (start.x + current.x) / 2;
        const midY = (start.y + current.y) / 2;

        return (
            <g transform={`translate(${midX + 15}, ${midY})`}>
                <rect x={0} y={-15} width={100} height={40} rx={4} fill={isShiftHeld ? "rgba(59, 130, 246, 0.9)" : "rgba(34, 197, 94, 0.9)"} />
                <text x={10} y={0} fill="white" fontSize={12} fontWeight="bold">L: {len} mm</text>
                <text x={10} y={16} fill="white" fontSize={12}>A: {ang}° {isShiftHeld ? '(ORTHO)' : ''}</text>
            </g>
        );
    }

    const renderGuides = () => {
        return activeGuides.map((g, i) => {
            if (g.type === 'alignment') {
                // Draw Infinite Line
                const INF = 100000;
                if (g.orientation === 'vertical') {
                    return <line key={i} x1={g.position} y1={-INF} x2={g.position} y2={INF} stroke="#3b82f6" strokeWidth={1} strokeDasharray="8,4" opacity={0.6} />
                } else {
                    return <line key={i} x1={-INF} y1={g.position} x2={INF} y2={g.position} stroke="#3b82f6" strokeWidth={1} strokeDasharray="8,4" opacity={0.6} />
                }
            }
            // Default Guide (Point to Cursor)
            return (
                <line key={i} x1={g.refPoint.x} y1={g.refPoint.y} x2={cursor.x} y2={cursor.y} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4,4" opacity={0.8} />
            )
        })
    }

    const renderSnapMarker = () => {
        if (!snapEnabled || snapType === 'none' || snapType === 'grid') return null;

        // Enhanced Snap Markers
        if (snapType === 'endpoint') return (
            <g>
                <circle cx={cursor.x} cy={cursor.y} r={8} stroke="#22c55e" strokeWidth={3} fill="none" />
                <circle cx={cursor.x} cy={cursor.y} r={4} fill="#22c55e" />
            </g>
        );
        if (snapType === 'midpoint') return (
            <g>
                <polygon points={`${cursor.x},${cursor.y - 8} ${cursor.x - 8},${cursor.y + 6} ${cursor.x + 8},${cursor.y + 6}`} stroke="#06b6d4" strokeWidth={3} fill="none" />
                <circle cx={cursor.x} cy={cursor.y} r={2} fill="#06b6d4" />
            </g>
        );
        if (snapType === 'alignment') return <g><line x1={cursor.x - 10} y1={cursor.y - 10} x2={cursor.x + 10} y2={cursor.y + 10} stroke="#3b82f6" strokeWidth={3} /><line x1={cursor.x + 10} y1={cursor.y - 10} x2={cursor.x - 10} y2={cursor.y + 10} stroke="#3b82f6" strokeWidth={3} /></g>;
        if (snapType === 'edge') return <g transform={`translate(${cursor.x}, ${cursor.y})`}><circle r={6} stroke="#eab308" strokeWidth={3} fill="none" /><line x1={-6} y1={0} x2={6} y2={0} stroke="#eab308" strokeWidth={2} transform="rotate(45)" /></g>;
        if (snapType === 'intersection') return <g transform={`translate(${cursor.x}, ${cursor.y})`}><line x1={-8} y1={-8} x2={8} y2={8} stroke="#ef4444" strokeWidth={3} /><line x1={8} y1={-8} x2={-8} y2={8} stroke="#ef4444" strokeWidth={3} /></g>;
        return null;
    }


    // NEW: Render Start Guide
    const renderStartGuide = () => {
        if (walls.length > 0 || isDrawing) return null;

        let guideText = "Select a tool below to start designing.";
        let tipText = "Tip: Use the toolbar to switch modes.";

        if (tool === 'wall') {
            guideText = "Click and drag (or click points) to create walls.";
            tipText = "Tip: Hold Shift to draw straight lines.";
        } else if (tool === 'beam') {
            guideText = "Click start and end points to create beams.";
            tipText = "Tip: Beams snap to grid and columns.";
        } else if (tool === 'slab') {
            guideText = "Click points to define slab corners. Click start to close.";
            tipText = "Tip: Ensure the shape is closed to finish.";
        }

        return (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-slate-800/90 backdrop-blur p-6 rounded-xl border border-slate-700 text-center shadow-2xl max-w-sm">
                    <div className="bg-brand-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/50">
                        <MousePointer2 className="text-white" size={24} />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">Start Drawing</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        {guideText}
                    </p>
                    <div className="text-xs text-slate-500 bg-slate-900 p-2 rounded border border-slate-800">
                        {tipText}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full cursor-crosshair relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        >
            {inputVisible && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 p-2 rounded border border-brand-500 shadow-xl text-white z-50 flex items-center gap-2">
                    <Keyboard size={16} className="text-brand-500" />
                    <span className="text-sm text-slate-400">{(tool === 'door' || tool === 'window') ? 'Offset:' : 'Length:'}</span>
                    <span className="font-mono font-bold text-lg">{inputValue}</span>
                    <span className="text-xs text-slate-500">mm</span>
                </div>
            )}

            {selectedId && (
                <PropertiesPanel
                    selectedId={selectedId}
                    wall={walls.find(w => w.id === selectedId)}
                    column={columns.find(c => c.id === selectedId)}
                    settings={settings}
                    onUpdateWall={updateSelectedWallProperty}
                    onUpdateColumn={updateSelectedColumnProperty}
                    onDelete={(id) => {
                        setWalls(prev => prev.filter(w => w.id !== id));
                        setOpenings(prev => prev.filter(o => o.wallId !== id));
                        setColumns(prev => prev.filter(c => c.id !== id));
                        setLabels(prev => prev.filter(l => l.id !== id));
                        setSelectedId(null);
                    }}
                    onClose={() => setSelectedId(null)}
                />
            )}
            {renderStartGuide()}

            <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
                <defs>
                    <pattern id="grid" width={GRID_SIZE * viewport.scale} height={GRID_SIZE * viewport.scale} patternUnits="userSpaceOnUse">
                        <path d={`M ${GRID_SIZE * viewport.scale} 0 L 0 0 0 ${GRID_SIZE * viewport.scale} `} fill="none" stroke="#334155" strokeWidth={0.5} />
                    </pattern>
                </defs>

                <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
                    <rect x={-50000} y={-50000} width={100000} height={100000} fill="url(#grid)" opacity={0.3} />

                    {/* Sketch Overlay */}
                    {sketchOverlay && (
                        <image
                            href={sketchOverlay.image}
                            x={0}
                            y={0}
                            width={sketchOverlay.width}
                            height={sketchOverlay.height}
                            opacity={0.5}
                            preserveAspectRatio="none"
                            className="pointer-events-none"
                        />
                    )}

                    {/* Layer 0: Slabs (Bottom) */}
                    {slabs.map(slab => {
                        const isSelected = slab.id === selectedId;
                        const pathData = slab.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y} `).join(' ') + ' Z';

                        // Calculate Slab Type
                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                        slab.points.forEach(p => {
                            minX = Math.min(minX, p.x);
                            maxX = Math.max(maxX, p.x);
                            minY = Math.min(minY, p.y);
                            maxY = Math.max(maxY, p.y);
                        });
                        const width = maxX - minX;
                        const height = maxY - minY;
                        const long = Math.max(width, height);
                        const short = Math.min(width, height);
                        const ratio = short > 0 ? long / short : 1;
                        const type = ratio >= 2.0 ? 'One-Way' : 'Two-Way';

                        return (
                            <g key={`slab - ${slab.id} `} onMouseDown={(e) => handleMouseDown(e, 'slab', slab.id)}>
                                <path
                                    d={pathData}
                                    fill="rgba(203, 213, 225, 0.5)" // Slate-300 with opacity
                                    stroke={isSelected ? "#f97316" : "#94a3b8"}
                                    strokeWidth={isSelected ? 4 : 2}
                                    className="cursor-pointer hover:fill-slate-300 transition-colors"
                                />
                                {/* Slab Label */}
                                <g transform={`translate(${slab.points.reduce((acc, p) => acc + p.x, 0) / slab.points.length}, ${slab.points.reduce((acc, p) => acc + p.y, 0) / slab.points.length})`}>
                                    <rect x={-40} y={-20} width={80} height={40} fill="rgba(15, 23, 42, 0.8)" rx={4} stroke="#94a3b8" strokeWidth={1} />
                                    <text
                                        x={0}
                                        y={-5}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="#e2e8f0"
                                        fontSize={14}
                                        fontWeight="bold"
                                        pointerEvents="none"
                                    >
                                        {slab.label || 'Slab'}
                                    </text>
                                    <text
                                        x={0}
                                        y={12}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="#94a3b8"
                                        fontSize={10}
                                        pointerEvents="none"
                                    >
                                        {type} ({ratio.toFixed(1)})
                                    </text>
                                </g>
                            </g>
                        );
                    })}

                    {/* Layer 0.2: Tributary Areas (Overlay) */}
                    {settings.showTributaryAreas && (() => {
                        const areas = calculateTributaryAreas(beams, slabs);
                        return areas.map((area, idx) => (
                            <path
                                key={`trib - ${idx} `}
                                d={area.polygon.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y} `).join(' ') + ' Z'}
                                fill={area.color}
                                stroke="none"
                                className="pointer-events-none"
                            />
                        ));
                    })()}

                    {/* Layer 0.5: Beams */}


                    {/* Layer 1: Wall Lines (Bottom) */}
                    {walls.map(wall => {
                        const isSelected = wall.id === selectedId;
                        return (
                            <g key={`wall - ${wall.id} `}>
                                {/* Outer glow for selection */}
                                {isSelected && (
                                    <line x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} stroke="#f97316" strokeWidth={(wall.thickness * SCALE) + 4} strokeOpacity={0.5} strokeLinecap="square" />
                                )}
                                <line x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} stroke="#94a3b8" strokeWidth={wall.thickness * SCALE} strokeLinecap="square" />
                                <line x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} stroke="#475569" strokeWidth={(wall.thickness * SCALE) - 2} strokeLinecap="square" />
                            </g>
                        )
                    })}

                    {/* Layer 2: Openings (Middle) */}
                    {openings.map(o => {
                        const w = walls.find(wall => wall.id === o.wallId);
                        if (w) return renderOpening(w, o, o.id === selectedId);
                        return null;
                    })}

                    {/* Layer 3: Wall Dimensions (Top) - ensures they are always on top of walls */}
                    {walls.map(wall => (
                        <g key={`dim - ${wall.id} `}>
                            {renderDimensions(wall)}
                        </g>
                    ))}

                    {/* Layer 4: Beams (Top of Walls) */}
                    {beams.map(beam => {
                        const isSelected = beam.id === selectedId;
                        return (
                            <g key={`beam - ${beam.id} `} onMouseDown={(e) => handleMouseDown(e, 'beam', beam.id)}>
                                {/* Selection Glow */}
                                {isSelected && (
                                    <line x1={beam.start.x} y1={beam.start.y} x2={beam.end.x} y2={beam.end.y} stroke="#f97316" strokeWidth={(beam.width * SCALE) + 4} strokeOpacity={0.5} strokeLinecap="square" />
                                )}
                                {/* Beam Body - Magenta for Visibility */}
                                <line x1={beam.start.x} y1={beam.start.y} x2={beam.end.x} y2={beam.end.y} stroke="#d946ef" strokeWidth={beam.width * SCALE} strokeLinecap="square" className="cursor-pointer" />
                                {/* Center Line */}
                                <line x1={beam.start.x} y1={beam.start.y} x2={beam.end.x} y2={beam.end.y} stroke="#fdf4ff" strokeWidth={1} strokeDasharray="10,5" strokeLinecap="square" pointerEvents="none" opacity={0.7} />

                                {/* Beam Label */}
                                {beam.label && (
                                    <g transform={`translate(${(beam.start.x + beam.end.x) / 2}, ${(beam.start.y + beam.end.y) / 2 - (beam.width * SCALE / 2) - 15})`}>
                                        <rect x={-20} y={-10} width={40} height={20} fill="rgba(15, 23, 42, 0.8)" rx={4} stroke="#d946ef" strokeWidth={1} />
                                        <text
                                            x={0}
                                            y={5}
                                            textAnchor="middle"
                                            fill="#d946ef"
                                            fontSize={12}
                                            fontWeight="bold"
                                            pointerEvents="none"
                                        >
                                            {beam.label}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {renderLabels()}

                    {renderLabels()}

                    {/* Render Pad Footings (Under Columns) */}
                    {(() => {
                        // 2. Classify Footings
                        const uniquePads = Array.from(new Set(columns.map(c => {
                            const w = c.padWidth || settings.padWidth || 1000;
                            const l = c.padLength || settings.padLength || 1000;
                            return `${w}x${l}`;
                        }))).sort();
                        const getPadType = (c: Column) => {
                            const w = c.padWidth || settings.padWidth || 1000;
                            const l = c.padLength || settings.padLength || 1000;
                            return `F${uniquePads.indexOf(`${w}x${l}`) + 1} `;
                        };

                        return columns.map(col => {
                            const pW = col.padWidth || settings.padWidth || 1000;
                            const pL = col.padLength || settings.padLength || 1000;
                            const padLabel = getPadType(col);

                            return (
                                <g key={`pad - ${col.id} `} transform={`translate(${col.x}, ${col.y}) rotate(${col.rotation || 0})`}>
                                    <rect
                                        x={-(pW * SCALE / 2)}
                                        y={-(pL * SCALE / 2)}
                                        width={pW * SCALE}
                                        height={pL * SCALE}
                                        fill="none"
                                        stroke="#94a3b8"
                                        strokeWidth={1}
                                        strokeDasharray="4,4"
                                        opacity={0.6}
                                    />
                                    {/* Footing Label (F1, F2...) */}
                                    <text
                                        x={pW * SCALE / 2 - 5}
                                        y={pL * SCALE / 2 - 5}
                                        fill="#94a3b8"
                                        fontSize={10}
                                        textAnchor="end"
                                        className="pointer-events-none select-none"
                                        transform={`rotate(-${col.rotation || 0})`} // Keep text upright
                                    >
                                        {padLabel}
                                    </text>
                                </g>
                            )
                        });
                    })()}

                    {/* Render Columns */}
                    {(() => {
                        // 1. Classify Columns (Simple Memoization logic inline for now)
                        // 1. Classify Columns (Simple Memoization logic inline for now)
                        const uniqueSizes = Array.from(new Set(columns.map(c => `${c.width}x${c.height}`))).sort();
                        const getType = (c: Column) => `C${uniqueSizes.indexOf(`${c.width}x${c.height}`) + 1} `;

                        return columns.map(col => {
                            const isSelected = selectedId === col.id;
                            const typeLabel = getType(col);

                            // Simple column styling - no safety warnings
                            const strokeColor = isSelected ? '#2563eb' : '#3b82f6'; // Blue
                            const fillColor = isSelected ? 'rgba(37, 99, 235, 0.4)' : 'rgba(59, 130, 246, 0.2)';

                            return (
                                <g
                                    key={col.id}
                                    transform={`translate(${col.x}, ${col.y}) rotate(${col.rotation || 0})`}
                                    onMouseDown={(e) => handleMouseDown(e, 'column', col.id)}
                                    className="cursor-move"
                                >
                                    {/* Pad Footing (Dashed) - Only visible when selected */}
                                    {isSelected && (
                                        <rect
                                            x={-(col.padWidth || settings.padWidth || 1000) * SCALE / 2}
                                            y={-(col.padLength || settings.padLength || 1000) * SCALE / 2}
                                            width={(col.padWidth || settings.padWidth || 1000) * SCALE}
                                            height={(col.padLength || settings.padLength || 1000) * SCALE}
                                            fill="none"
                                            stroke="#94a3b8"
                                            strokeWidth={2}
                                            strokeDasharray="5,5"
                                            opacity={0.5}
                                        />
                                    )}

                                    {/* Column Body */}
                                    <rect
                                        x={-(col.width * SCALE) / 2}
                                        y={-(col.height * SCALE) / 2}
                                        width={col.width * SCALE}
                                        height={col.height * SCALE}
                                        fill={fillColor}
                                        stroke={strokeColor}
                                        strokeWidth={isSelected ? 3 : 2}
                                    />

                                    {/* Column Label */}
                                    <text
                                        x={0}
                                        y={0}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="white"
                                        fontSize={14}
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none' }}
                                        transform={`rotate(${- (col.rotation || 0)})`} // Counter-rotate text
                                    >
                                        {typeLabel}
                                    </text>
                                </g>
                            );
                        });
                    })()}

                    {/* Center-to-Center Dimensions for Selected Column */}
                    {(() => {
                        const selectedCol = columns.find(c => c.id === selectedId);
                        if (!selectedCol) return null;

                        // Find nearest 2 columns
                        const others = columns.filter(c => c.id !== selectedId).map(c => ({
                            col: c,
                            dist: distance({ x: selectedCol.x, y: selectedCol.y }, { x: c.x, y: c.y })
                        })).sort((a, b) => a.dist - b.dist).slice(0, 2);

                        return others.map(({ col, dist }) => (
                            <g key={`dim - ${selectedCol.id} -${col.id} `} className="pointer-events-none">
                                <line
                                    x1={selectedCol.x}
                                    y1={selectedCol.y}
                                    x2={col.x}
                                    y2={col.y}
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    strokeDasharray="10,10"
                                    opacity={0.8}
                                />
                                <g transform={`translate(${(selectedCol.x + col.x) / 2}, ${(selectedCol.y + col.y) / 2})`}>
                                    <rect x={-35} y={-15} width={70} height={30} fill="rgba(30, 41, 59, 0.9)" rx={4} stroke="#3b82f6" strokeWidth={2} />
                                    <text
                                        x={0}
                                        y={5}
                                        fill="#60a5fa"
                                        fontSize={14}
                                        textAnchor="middle"
                                        fontWeight="bold"
                                        fontFamily="monospace"
                                    >
                                        {Math.round(dist / SCALE)}
                                    </text>
                                </g>
                            </g>
                        ));
                    })()}

                    {/* Dynamic Distance Tracking for Column Tool */}
                    {tool === 'column' && columns.length > 0 && (
                        (() => {
                            // Find nearest column
                            let nearestCol: Column | null = null;
                            let minDist = Infinity;
                            columns.forEach(c => {
                                const d = distance(cursor, { x: c.x, y: c.y });
                                if (d < minDist) {
                                    minDist = d;
                                    nearestCol = c;
                                }
                            });

                            if (nearestCol && minDist < 10000) { // Show if within 10m (10,000mm)
                                const angle = Math.round(getAngle({ x: nearestCol.x, y: nearestCol.y }, cursor));
                                return (
                                    <g>
                                        <line
                                            x1={nearestCol.x}
                                            y1={nearestCol.y}
                                            x2={cursor.x}
                                            y2={cursor.y}
                                            stroke="#3b82f6"
                                            strokeWidth={4}
                                            strokeDasharray="10,10"
                                        />
                                        {/* Offset tooltip to avoid obstructing view */}
                                        <g transform={`translate(${(nearestCol.x + cursor.x) / 2}, ${(nearestCol.y + cursor.y) / 2 + 40})`}>
                                            <rect x={-40} y={-25} width={80} height={50} fill="rgba(15, 23, 42, 0.7)" rx={6} stroke="#3b82f6" strokeWidth={2} />
                                            <text
                                                x={0}
                                                y={-4}
                                                fill="#60a5fa"
                                                fontSize={14}
                                                textAnchor="middle"
                                                fontWeight="bold"
                                                fontFamily="monospace"
                                            >
                                                L: {Math.round(minDist / SCALE)}
                                            </text>
                                            <text
                                                x={0}
                                                y={16}
                                                fill="#a78bfa"
                                                fontSize={14}
                                                textAnchor="middle"
                                                fontWeight="bold"
                                                fontFamily="monospace"
                                            >
                                                A: {angle}°
                                            </text>
                                        </g>
                                    </g>
                                );
                            }
                            return null;
                        })()
                    )}



                    {/* Render Section Lines */}
                    {settings.sections?.map(sec => (
                        <g key={sec.id} className="pointer-events-none">
                            <line
                                x1={sec.start.x}
                                y1={sec.start.y}
                                x2={sec.end.x}
                                y2={sec.end.y}
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="20,10,5,10"
                            />
                            {/* Section Arrows */}
                            <circle cx={sec.start.x} cy={sec.start.y} r={8} fill="#ef4444" />
                            <circle cx={sec.end.x} cy={sec.end.y} r={8} fill="#ef4444" />
                            <text x={sec.start.x} y={sec.start.y - 15} textAnchor="middle" fill="#ef4444" fontSize={24} fontWeight="bold">{sec.label}</text>
                            <text x={sec.end.x} y={sec.end.y - 15} textAnchor="middle" fill="#ef4444" fontSize={24} fontWeight="bold">{sec.label}</text>
                        </g>
                    ))}

                    {/* Section Drawing Preview */}
                    {tool === 'section' && sectionStart && (
                        <g>
                            <line
                                x1={sectionStart.x}
                                y1={sectionStart.y}
                                x2={cursor.x}
                                y2={cursor.y}
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="20,10,5,10"
                                opacity={0.7}
                            />
                            <text x={sectionStart.x} y={sectionStart.y - 15} textAnchor="middle" fill="#ef4444" fontSize={24} fontWeight="bold" opacity={0.7}>
                                {String.fromCharCode(65 + (settings.sections?.length || 0))}
                            </text>
                        </g>
                    )}

                    {previewOpening && (
                        <g opacity={0.5}>
                            {renderOpening(previewOpening.wall, {
                                id: 'preview',
                                wallId: previewOpening.wall.id,
                                type: tool as 'door' | 'window',
                                distanceFromStart: previewOpening.distFromStart,
                                width: tool === 'door' ? toolSettings.doorWidth : toolSettings.windowWidth,
                                height: tool === 'door' ? toolSettings.doorHeight : toolSettings.windowHeight
                            })}
                        </g>
                    )}

                    {/* Column Ghost Preview */}
                    {tool === 'column' && (
                        <g transform={`translate(${cursor.x}, ${cursor.y}) rotate(${wallSnap ? getAngle(wallSnap.wall.start, wallSnap.wall.end) : 0})`}>
                            <g opacity={0.5} pointerEvents="none">
                                <rect
                                    x={-(toolSettings.columnWidth * SCALE / 2)}
                                    y={-(toolSettings.columnHeight * SCALE / 2)}
                                    width={toolSettings.columnWidth * SCALE}
                                    height={toolSettings.columnHeight * SCALE}
                                    fill="#334155"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                />
                                {/* Footing Preview Removed for Clutter Reduction */}
                            </g>
                        </g>
                    )}

                    {renderPreviewDimensions()}
                    {renderWallSnapDimensions()}
                    {renderGuides()}

                    {isDrawing && points.length > 0 && (
                        <>
                            {tool === 'wall' && (() => {
                                // Calculate real-time dimensions
                                const dx = cursor.x - points[0].x;
                                const dy = cursor.y - points[0].y;
                                const lengthPx = Math.sqrt(dx * dx + dy * dy);
                                const lengthMM = Math.round(lengthPx / SCALE);
                                const lengthM = (lengthMM / 1000).toFixed(2);
                                const lengthFt = (lengthMM / 304.8).toFixed(2);
                                const angleDeg = Math.round(Math.atan2(-dy, dx) * 180 / Math.PI);
                                const normalizedAngle = angleDeg < 0 ? angleDeg + 360 : angleDeg;
                                const midX = (points[0].x + cursor.x) / 2;
                                const midY = (points[0].y + cursor.y) / 2;
                                const thickness = toolSettings.wallType === 'partition' ? 150 : 225;

                                // Snap feedback colors - green is default, special colors only when snapped
                                const snapColor = snapType === 'endpoint' ? '#22c55e' :
                                    snapType === 'midpoint' ? '#f59e0b' :
                                        snapType === 'intersection' ? '#3b82f6' :
                                            snapType === 'edge' ? '#8b5cf6' : '#22c55e'; // Default green
                                const snapLabel = snapType === 'endpoint' ? '✓ ENDPOINT' :
                                    snapType === 'midpoint' ? '◆ MIDPOINT' :
                                        snapType === 'intersection' ? '✕ INTERSECTION' :
                                            snapType === 'edge' ? '— ON EDGE' : '';
                                const isSnapped = snapType !== 'none' && snapType !== 'grid';

                                return (
                                    <>
                                        <line x1={points[0].x} y1={points[0].y} x2={cursor.x} y2={cursor.y} stroke={snapColor} strokeWidth={thickness * SCALE} opacity={0.7} />
                                        <line x1={points[0].x} y1={points[0].y} x2={cursor.x} y2={cursor.y} stroke={snapColor} strokeWidth={2} strokeDasharray="5,5" />

                                        {/* Compact dimension badge - positioned far from drawing */}
                                        <g transform={`translate(${cursor.x + 25}, ${cursor.y - 35})`} opacity={0.9} pointerEvents="none">
                                            <rect x={0} y={0} width={75} height={45} rx={6} fill="rgba(15, 23, 42, 0.85)" stroke={snapColor} strokeWidth={1.5} />
                                            {snapLabel && <text x={37} y={12} textAnchor="middle" fill={snapColor} fontSize={8} fontWeight="bold">{snapLabel}</text>}
                                            <text x={37} y={snapLabel ? 28 : 20} textAnchor="middle" fill="#22c55e" fontSize={14} fontWeight="bold" fontFamily="monospace">{lengthM}m</text>
                                            <text x={37} y={snapLabel ? 40 : 35} textAnchor="middle" fill="#94a3b8" fontSize={8}>∠{normalizedAngle}° {toolSettings.wallType === 'partition' ? '6"' : '9"'}</text>
                                        </g>

                                        {/* Start/end markers */}
                                        <circle cx={points[0].x} cy={points[0].y} r={5} fill={snapColor} stroke="white" strokeWidth={1.5} />
                                        <circle cx={cursor.x} cy={cursor.y} r={isSnapped ? 7 : 4} fill={snapColor} stroke="white" strokeWidth={1.5} />
                                        {isSnapped && <circle cx={cursor.x} cy={cursor.y} r={12} fill="none" stroke={snapColor} strokeWidth={1.5} opacity={0.4} />}
                                    </>
                                );
                            })()}
                            {tool === 'beam' && (
                                <>
                                    <line x1={points[0].x} y1={points[0].y} x2={cursor.x} y2={cursor.y} stroke="#3b82f6" strokeWidth={300 * SCALE} opacity={0.6} />
                                    <line x1={points[0].x} y1={points[0].y} x2={cursor.x} y2={cursor.y} stroke="#3b82f6" strokeWidth={4} strokeDasharray="5,5" />
                                    <g transform={`translate(${cursor.x + 20}, ${cursor.y - 20})`}>
                                        <rect x={0} y={-20} width={120} height={24} rx={4} fill="rgba(59, 130, 246, 0.9)" />
                                        <text x={60} y={-4} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold">Click to Place</text>
                                    </g>
                                </>
                            )}
                            {tool === 'slab' && (
                                <>
                                    <path
                                        d={`${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} L ${cursor.x} ${cursor.y} `}
                                        fill="rgba(34, 197, 94, 0.2)"
                                        stroke="#22c55e"
                                        strokeWidth={3}
                                        strokeDasharray="5,5"
                                    />
                                    {/* Dynamic Slab Type Preview */}
                                    {points.length > 1 && (() => {
                                        const tempPoints = [...points, cursor];
                                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                                        tempPoints.forEach(p => {
                                            minX = Math.min(minX, p.x);
                                            maxX = Math.max(maxX, p.x);
                                            minY = Math.min(minY, p.y);
                                            maxY = Math.max(maxY, p.y);
                                        });
                                        const width = maxX - minX;
                                        const height = maxY - minY;
                                        const long = Math.max(width, height);
                                        const short = Math.min(width, height);
                                        const ratio = short > 0 ? long / short : 1;
                                        const type = ratio >= 2.0 ? 'One-Way' : 'Two-Way';

                                        const centerX = (minX + maxX) / 2;
                                        const centerY = (minY + maxY) / 2;

                                        return (
                                            <g transform={`translate(${centerX}, ${centerY})`}>
                                                <rect x={-40} y={-15} width={80} height={30} fill="rgba(34, 197, 94, 0.8)" rx={4} />
                                                <text x={0} y={5} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold">
                                                    {type} ({ratio.toFixed(1)})
                                                </text>
                                            </g>
                                        )
                                    })()}

                                    {/* Closing Hint */}
                                    {points.length > 2 && distance(cursor, points[0]) < 20 && (
                                        <g>
                                            <circle cx={points[0].x} cy={points[0].y} r={15} fill="#22c55e" opacity={0.8} />
                                            <text x={points[0].x} y={points[0].y - 20} textAnchor="middle" fill="#22c55e" fontWeight="bold" fontSize={14}>Click to Close</text>
                                        </g>
                                    )}
                                </>
                            )}
                            {renderTooltip()}
                        </>
                    )}

                    {renderSnapMarker()}
                    {!snapType || snapType === 'none' || snapType === 'grid' ? (
                        <circle cx={cursor.x} cy={cursor.y} r={3} fill={snapEnabled ? "#22c55e" : "#ef4444"} opacity={0.8} />
                    ) : null}
                </g>
            </svg>

            <div className="absolute bottom-24 md:bottom-4 right-4 flex flex-col gap-2">
                <button className="bg-slate-800 p-2 rounded text-white hover:bg-slate-700 shadow-lg" onClick={() => handleZoomBtn(1)}><ZoomIn size={20} /></button>
                <button className="bg-slate-800 p-2 rounded text-white hover:bg-slate-700 shadow-lg" onClick={() => handleZoomBtn(-1)}><ZoomOut size={20} /></button>
                <button className={`bg-slate-800 p-2 rounded text-white hover:bg-slate-700 shadow-lg ${tool === 'pan' ? 'bg-brand-600' : ''}`} onClick={() => setTool(tool === 'pan' ? 'select' : 'pan')}><Move size={20} /></button>
                <button
                    className={`bg-slate-800 p-2 rounded text-white hover:bg-slate-700 shadow-lg ${manualInputVisible ? 'bg-brand-600' : ''}`}
                    onClick={toggleManualInput}
                    title="Manual Input (Length/Angle)"
                >
                    <Keyboard size={20} />
                </button>
            </div>

            <ManualInput
                visible={manualInputVisible}
                onCommit={handleManualInputCommit}
                onCancel={() => setManualInputVisible(false)}
                currentAngle={0}
            />

            <Magnifier
                visible={showMagnifier && (tool === 'wall' || tool === 'beam' || tool === 'column' || tool === 'select')}
                cursor={cursor} // Snapped world cursor
                screenPos={screenCursor}
                walls={walls}
                columns={columns}
                beams={beams}
                slabs={slabs}
                labels={labels}
            />

            <DPad
                isActive={precisionMode}
                onToggleMode={() => {
                    setPrecisionMode(!precisionMode);
                    setVirtualCursor(null); // Reset when toggling
                }}
                onMove={(dx, dy) => {
                    const scaleFactor = 1 / viewport.scale;
                    const worldDx = dx * scaleFactor;
                    const worldDy = dy * scaleFactor;

                    if (selectedId) {
                        // Nudge Selected Element
                        // Check Columns
                        const col = columns.find(c => c.id === selectedId);
                        if (col) {
                            setColumns(prev => prev.map(c => c.id === selectedId ? { ...c, x: c.x + worldDx, y: c.y + worldDy } : c));
                            return;
                        }

                        // Check Walls
                        const wall = walls.find(w => w.id === selectedId);
                        if (wall) {
                            setWalls(prev => prev.map(w => w.id === selectedId ? {
                                ...w,
                                start: { x: w.start.x + worldDx, y: w.start.y + worldDy },
                                end: { x: w.end.x + worldDx, y: w.end.y + worldDy }
                            } : w));
                            return;
                        }

                        // Check Labels
                        const label = labels.find(l => l.id === selectedId);
                        if (label) {
                            setLabels(prev => prev.map(l => l.id === selectedId ? { ...l, x: l.x + worldDx, y: l.y + worldDy } : l));
                            return;
                        }

                    } else {
                        // Move Virtual Cursor
                        let current = virtualCursor || cursor;
                        const newPos = { x: current.x + worldDx, y: current.y + worldDy };
                        setVirtualCursor(newPos);
                        setCursor(newPos);
                    }
                }}
            />
        </div >
    );
};

export default Canvas;
