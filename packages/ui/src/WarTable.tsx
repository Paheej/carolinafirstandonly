import * as React from 'react';

export interface WarTableProps {
    /** Accessible description of what the board represents. */
    label?: string;
    className?: string;
}

// Strike Force board: 60" x 44", drawn at 10 units per inch with a 30-unit
// margin for the rulers.
const INCH = 10;
const W = 60;
const H = 44;
const PAD = 30;

const OBJECTIVES: [number, number][] = [
    [30, 22],
    [12, 10],
    [48, 10],
    [12, 34],
    [48, 34],
];

/**
 * Top-down war table: inch rulers, two 12" deployment zones, ruins, and five
 * numbered objective markers that drop in on first paint (respecting
 * prefers-reduced-motion via the .cfo-obj class).
 */
export function WarTable({
    label = 'Top-down Strike Force board, 60 by 44 inches, with two deployment zones and five objective markers',
    className,
}: WarTableProps) {
    const topTicks = Array.from({ length: W + 1 }, (_, i) => i);
    const leftTicks = Array.from({ length: H + 1 }, (_, i) => i);
    return (
        <svg
            viewBox={`0 0 ${W * INCH + PAD + 10} ${H * INCH + PAD + 14}`}
            role="img"
            aria-label={label}
            className={className}
            style={{ width: '100%', height: 'auto', display: 'block' }}
        >
            <defs>
                <pattern id="cfo-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#9e7e38" strokeOpacity=".28" strokeWidth="2" />
                </pattern>
                <pattern id="cfo-grid" width="60" height="60" patternUnits="userSpaceOnUse" x={PAD} y={PAD}>
                    <path d="M60 0H0V60" fill="none" stroke="#9e7e38" strokeOpacity=".12" strokeWidth="1" />
                </pattern>
            </defs>

            <g fill="#9e7e38" fontFamily="var(--font-archivo), sans-serif" fontSize="10">
                {topTicks.map((i) => {
                    const len = i % 6 === 0 ? 10 : 5;
                    return (
                        <React.Fragment key={`t${i}`}>
                            <rect x={PAD + i * INCH - 0.5} y={PAD - len - 4} width={1} height={len} fillOpacity={i % 6 === 0 ? 1 : 0.55} />
                            {i % 12 === 0 ? (
                                <text x={PAD + i * INCH} y={12} textAnchor="middle">
                                    {i}″
                                </text>
                            ) : null}
                        </React.Fragment>
                    );
                })}
                {leftTicks.map((j) => {
                    const len = j % 6 === 0 ? 10 : 5;
                    return (
                        <rect key={`l${j}`} x={PAD - len - 4} y={PAD + j * INCH - 0.5} width={len} height={1} fillOpacity={j % 6 === 0 ? 1 : 0.55} />
                    );
                })}
            </g>

            <g transform={`translate(${PAD} ${PAD})`}>
                <rect width={W * INCH} height={H * INCH} fill="#151514" stroke="#9e7e38" strokeOpacity=".6" />
                <rect width={W * INCH} height={H * INCH} fill="url(#cfo-grid)" />
                <rect width={W * INCH} height={12 * INCH} fill="url(#cfo-hatch)" />
                <rect y={32 * INCH} width={W * INCH} height={12 * INCH} fill="url(#cfo-hatch)" />
                <g fill="#cfab52" fontFamily="var(--font-archivo), sans-serif" fontWeight="700" fontSize="14" style={{ fontStretch: '80%' }}>
                    <text x="12" y="22">Attacker deployment</text>
                    <text x="12" y="430">Defender deployment</text>
                </g>

                <g fill="#2a2a27" stroke="#46453f" strokeWidth="1.5">
                    <path d="M150 150h70v14h-56v46h-14z" />
                    <path d="M450 290h-70v-14h56v-46h14z" />
                    <path d="M265 300h70v14h-70z" />
                    <path d="M265 126h70v14h-70z" />
                    <rect x="40" y="200" width="40" height="40" />
                    <rect x="520" y="200" width="40" height="40" />
                    <path d="M470 140h50v50h-14v-36h-36z" />
                    <path d="M130 300h-50v-50h14v36h36z" />
                </g>

                <g fontFamily="var(--font-archivo), sans-serif" fontWeight="800" fontSize="15" textAnchor="middle">
                    {OBJECTIVES.map(([x, y], i) => (
                        <g key={i} className="cfo-obj" style={{ ['--i' as string]: i } as React.CSSProperties}>
                            <circle cx={x * INCH} cy={y * INCH} r="17" fill="#cfab52" />
                            {i === 0 ? (
                                <circle cx={x * INCH} cy={y * INCH} r={6 * INCH} fill="none" stroke="#cfab52" strokeOpacity=".35" strokeDasharray="4 5" />
                            ) : null}
                            <text x={x * INCH} y={y * INCH + 5.5} fill="#0d0d0c">
                                {i + 1}
                            </text>
                        </g>
                    ))}
                </g>
            </g>
        </svg>
    );
}
