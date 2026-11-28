import * as React from 'react';

/** Trig results can differ in the last digit between Node and the browser; round so hydration matches. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface DungeonMapProps {
    /** Accessible description of what the map represents. */
    label?: string;
    className?: string;
}

// A DM's map on 5-foot squares: 30 x 22 squares, drawn at 20 units per square
// with a 30-unit margin for the rulers. Same footprint and palette as
// <WarTable />, so the hero can swap between them.
const SQ = 20;
const W = 30;
const H = 22;
const PAD = 30;

type Rect = [x: number, y: number, w: number, h: number];

// Rooms and corridors, in squares. Original layout: a ruined keep.
const ROOMS: Rect[] = [
    [2, 1, 5, 5], // 5: tower stair
    [2, 9, 6, 4], // 1: gatehouse
    [11, 6, 9, 10], // 2: great hall
    [23, 2, 6, 8], // 3: chapel
];
const CORRIDORS: Rect[] = [
    [0, 10, 2, 2], // way in
    [4, 6, 2, 3], // tower to gatehouse
    [8, 10, 3, 2], // gatehouse to hall
    [20, 7, 3, 2], // hall to chapel
    [20, 15.5, 2.6, 2], // hall to crypt
];
const CRYPT = { cx: 25.5, cy: 16.5, r: 4 };

// Doors: [x, y, vertical?] at room/corridor joins, in squares.
const DOORS: [number, number, boolean][] = [
    [2, 11, true],
    [5, 9, false],
    [11, 11, true],
    [23, 8, true],
    [20, 16.5, true],
];

// Keyed rooms, in the order the markers drop.
const KEYS: [number, number][] = [
    [5, 11],
    [15.5, 11],
    [26, 4],
    [25.5, 16.5],
    [4.5, 3.5],
];

const r = ([x, y, w, h]: Rect) => ({ x: x * SQ, y: y * SQ, width: w * SQ, height: h * SQ });

function Floor({ fill, stroke, strokeWidth }: { fill: string; stroke?: string; strokeWidth?: number }) {
    return (
        <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round">
            {[...ROOMS, ...CORRIDORS].map((rect, i) => (
                <rect key={i} {...r(rect)} />
            ))}
            <circle cx={CRYPT.cx * SQ} cy={CRYPT.cy * SQ} r={CRYPT.r * SQ} />
        </g>
    );
}

/**
 * Top-down dungeon map for D&D campaigns: foot rulers, hatched rock, rooms and
 * corridors on a 5-foot grid, doors, a tower stair, chapel pews, a round crypt,
 * and five numbered room keys that drop in like the war table's objectives.
 */
export function DungeonMap({
    label = 'Top-down dungeon map on 5-foot squares: a ruined keep with a gatehouse, great hall, chapel, tower stair and round crypt, with five numbered rooms',
    className,
}: DungeonMapProps) {
    const topTicks = Array.from({ length: W + 1 }, (_, i) => i);
    const leftTicks = Array.from({ length: H + 1 }, (_, i) => i);
    return (
        <svg
            viewBox={`0 0 ${W * SQ + PAD + 10} ${H * SQ + PAD + 14}`}
            role="img"
            aria-label={label}
            className={className}
            style={{ width: '100%', height: 'auto', display: 'block' }}
        >
            <defs>
                <pattern id="cfo-rock" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
                    <line x1="0" y1="0" x2="0" y2="7" stroke="#9e7e38" strokeOpacity=".22" strokeWidth="1.5" />
                </pattern>
                <pattern id="cfo-squares" width={SQ} height={SQ} patternUnits="userSpaceOnUse">
                    <path d={`M${SQ} 0H0V${SQ}`} fill="none" stroke="#9e7e38" strokeOpacity=".2" strokeWidth="1" />
                </pattern>
            </defs>

            {/* Rulers: one tick per square (5 ft), labels every 30 ft. */}
            <g fill="#9e7e38" fontFamily="var(--font-archivo), sans-serif" fontSize="10">
                {topTicks.map((i) => {
                    const len = i % 6 === 0 ? 10 : 5;
                    return (
                        <React.Fragment key={`t${i}`}>
                            <rect x={PAD + i * SQ - 0.5} y={PAD - len - 4} width={1} height={len} fillOpacity={i % 6 === 0 ? 1 : 0.55} />
                            {i % 6 === 0 ? (
                                <text x={PAD + i * SQ} y={12} textAnchor={i === W ? 'end' : i === 0 ? 'start' : 'middle'}>
                                    {i * 5} ft
                                </text>
                            ) : null}
                        </React.Fragment>
                    );
                })}
                {leftTicks.map((j) => {
                    const len = j % 6 === 0 ? 10 : 5;
                    return <rect key={`l${j}`} x={PAD - len - 4} y={PAD + j * SQ - 0.5} width={len} height={1} fillOpacity={j % 6 === 0 ? 1 : 0.55} />;
                })}
            </g>

            <g transform={`translate(${PAD} ${PAD})`}>
                {/* Solid rock */}
                <rect width={W * SQ} height={H * SQ} fill="#111110" />
                <rect width={W * SQ} height={H * SQ} fill="url(#cfo-rock)" />

                {/* Walls: stroke every shape, then cover the inner half with floor so joins open up. */}
                <Floor fill="#1d1d1b" stroke="#9e7e38" strokeWidth={6} />
                <Floor fill="#1d1d1b" />
                <g fill="url(#cfo-squares)">
                    {[...ROOMS, ...CORRIDORS].map((rect, i) => (
                        <rect key={i} {...r(rect)} />
                    ))}
                    <circle cx={CRYPT.cx * SQ} cy={CRYPT.cy * SQ} r={CRYPT.r * SQ} />
                </g>

                {/* Great hall pillars */}
                <g fill="#2a2a27" stroke="#46453f" strokeWidth="1.5">
                    {[
                        [13, 8],
                        [18, 8],
                        [13, 14],
                        [18, 14],
                    ].map(([x, y]) => (
                        <circle key={`${x}-${y}`} cx={x! * SQ} cy={y! * SQ} r={7} />
                    ))}
                </g>

                {/* Chapel: altar and pews */}
                <g fill="#2a2a27" stroke="#46453f" strokeWidth="1.5">
                    <rect x={24.5 * SQ} y={2.4 * SQ} width={3 * SQ} height={0.8 * SQ} />
                    {[5, 6, 7, 8].flatMap((y) => [
                        <rect key={`pl${y}`} x={23.6 * SQ} y={y * SQ + 4} width={2 * SQ} height={6} />,
                        <rect key={`pr${y}`} x={26.4 * SQ} y={y * SQ + 4} width={2 * SQ} height={6} />,
                    ])}
                </g>

                {/* Tower stair: treads spiralling in */}
                <g stroke="#9e7e38" strokeOpacity=".55" strokeWidth="1.5" fill="none">
                    <circle cx={4.5 * SQ} cy={3.5 * SQ} r={2 * SQ} />
                    {Array.from({ length: 10 }, (_, i) => {
                        const a = (i / 10) * Math.PI * 2;
                        return (
                            <line
                                key={i}
                                x1={r2(4.5 * SQ + Math.cos(a) * 0.9 * SQ)}
                                y1={r2(3.5 * SQ + Math.sin(a) * 0.9 * SQ)}
                                x2={r2(4.5 * SQ + Math.cos(a) * 2 * SQ)}
                                y2={r2(3.5 * SQ + Math.sin(a) * 2 * SQ)}
                            />
                        );
                    })}
                </g>

                {/* Crypt: sarcophagi around the ring */}
                <g fill="#2a2a27" stroke="#46453f" strokeWidth="1.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
                        const x = r2(CRYPT.cx * SQ + Math.cos(a) * 2.7 * SQ);
                        const y = r2(CRYPT.cy * SQ + Math.sin(a) * 2.7 * SQ);
                        return <rect key={i} x={x - 6} y={y - 12} width={12} height={24} transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />;
                    })}
                </g>

                {/* Doors */}
                <g fill="#cfab52">
                    {DOORS.map(([x, y, v], i) =>
                        v ? <rect key={i} x={x * SQ - 3} y={y * SQ - 9} width={6} height={18} /> : <rect key={i} x={x * SQ - 9} y={y * SQ - 3} width={18} height={6} />,
                    )}
                </g>

                <g fill="#cfab52" fontFamily="var(--font-archivo), sans-serif" fontWeight="700" fontSize="14" style={{ fontStretch: '80%' }}>
                    <text x="12" y={H * SQ - 12}>1 square = 5 feet</text>
                </g>

                <g fontFamily="var(--font-archivo), sans-serif" fontWeight="800" fontSize="15" textAnchor="middle">
                    {KEYS.map(([x, y], i) => (
                        <g key={i} className="cfo-obj" style={{ ['--i' as string]: i } as React.CSSProperties}>
                            <circle cx={x * SQ} cy={y * SQ} r="15" fill="#cfab52" />
                            <text x={x * SQ} y={y * SQ + 5.5} fill="#0d0d0c">
                                {i + 1}
                            </text>
                        </g>
                    ))}
                </g>
            </g>
        </svg>
    );
}
