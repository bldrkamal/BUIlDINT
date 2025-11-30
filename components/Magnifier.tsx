import React from 'react';
import { Point, Wall, Column, Beam, Slab, ProjectLabel } from '../types';

interface MagnifierProps {
    cursor: Point; // World coordinates for the center of the view
    screenPos: Point; // Screen coordinates for positioning the loupe
    walls: Wall[];
    columns: Column[];
    beams: Beam[];
    slabs: Slab[];
    labels: ProjectLabel[];
    visible: boolean;
}

const Magnifier: React.FC<MagnifierProps> = ({ cursor, screenPos, walls, columns, beams, slabs, labels, visible }) => {
    if (!visible) return null;

    // Magnifier Settings
    const SIZE = 140; // Diameter in px
    const ZOOM_SCALE = 0.1; // 1mm = 0.1px (2x default 0.05)
    const VIEW_SIZE = SIZE / ZOOM_SCALE; // World units visible in magnifier

    // Offset the magnifier above the finger (screen coords)
    const OFFSET_Y = -100;

    const viewBox = `${cursor.x - VIEW_SIZE / 2} ${cursor.y - VIEW_SIZE / 2} ${VIEW_SIZE} ${VIEW_SIZE}`;

    return (
        <div
            className="fixed pointer-events-none z-50 rounded-full border-4 border-brand-500 bg-slate-900 shadow-2xl overflow-hidden"
            style={{
                width: SIZE,
                height: SIZE,
                left: screenPos.x - SIZE / 2,
                top: screenPos.y + OFFSET_Y - SIZE / 2,
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid slice"
                className="bg-slate-900"
            >
                {/* Grid (Simplified) */}
                <defs>
                    <pattern id="mag-grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
                        <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#1e293b" strokeWidth="20" />
                    </pattern>
                </defs>
                <rect x={cursor.x - VIEW_SIZE} y={cursor.y - VIEW_SIZE} width={VIEW_SIZE * 2} height={VIEW_SIZE * 2} fill="url(#mag-grid)" />

                {/* Render Walls */}
                {walls.map(w => (
                    <line
                        key={w.id}
                        x1={w.start.x}
                        y1={w.start.y}
                        x2={w.end.x}
                        y2={w.end.y}
                        stroke="#94a3b8"
                        strokeWidth={225} // Real world width
                        strokeLinecap="square"
                    />
                ))}

                {/* Render Columns */}
                {columns.map(c => (
                    <rect
                        key={c.id}
                        x={c.x - c.width / 2}
                        y={c.y - c.height / 2}
                        width={c.width}
                        height={c.height}
                        fill="#3b82f6"
                        transform={`rotate(${c.rotation || 0} ${c.x} ${c.y})`}
                    />
                ))}

                {/* Crosshair */}
                <line x1={cursor.x - 100} y1={cursor.y} x2={cursor.x + 100} y2={cursor.y} stroke="#ef4444" strokeWidth={10} />
                <line x1={cursor.x} y1={cursor.y - 100} x2={cursor.x} y2={cursor.y + 100} stroke="#ef4444" strokeWidth={10} />
                <circle cx={cursor.x} cy={cursor.y} r={20} fill="none" stroke="#ef4444" strokeWidth={5} />
            </svg>
        </div>
    );
};

export default Magnifier;
