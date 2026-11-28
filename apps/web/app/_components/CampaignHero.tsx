'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { DungeonMap, WarTable } from '@cfo/ui';

/**
 * One thing on the home page's table: the next game day or a running
 * campaign. `content` is rendered on the server and passed in.
 */
export interface HeroSlide {
    id: string;
    /** Short tab label, e.g. "Next game day" or the campaign name. */
    tab: string;
    /** Picks the board: D&D gets the dungeon map, everything else the war table. */
    gameSystem: string | null;
    content: ReactNode;
}

const ROTATE_MS = 9000;

function Board({ gameSystem }: { gameSystem: string | null }) {
    if (gameSystem === 'Dungeons and Dragons') {
        return (
            <>
                <DungeonMap />
                <p className="cfo-ui mt-2.5 text-sm text-on-mat-soft">
                    A dungeon level on 5-foot squares. The numbered rooms are keyed in the DM&apos;s notes.
                </p>
            </>
        );
    }
    return (
        <>
            <WarTable />
            <p className="cfo-ui mt-2.5 text-sm text-on-mat-soft">
                A Strike Force board, 60 by 44 inches. Objective 1 sits dead center; the dashed ring is 6 inches.
            </p>
        </>
    );
}

/**
 * Home hero: the next game day (if any) and the running campaigns take turns
 * on the table, each with its own board. Advances on its own, pauses on hover
 * or focus, stops once someone picks a tab, and never auto-advances for
 * reduced motion.
 */
export function CampaignHero({ slides, footer }: { slides: HeroSlide[]; footer?: ReactNode }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [picked, setPicked] = useState(false);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const many = slides.length > 1;

    useEffect(() => {
        if (!many || paused || picked) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
        return () => clearInterval(t);
    }, [many, paused, picked, slides.length]);

    const s = slides[index]!;

    const pick = (i: number, focus = false) => {
        setIndex(i);
        setPicked(true);
        if (focus) tabs.current[i]?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
        const n = slides.length;
        if (e.key === 'ArrowRight') pick((index + 1) % n, true);
        else if (e.key === 'ArrowLeft') pick((index - 1 + n) % n, true);
        else return;
        e.preventDefault();
    };

    return (
        <div
            className="contents"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <div className="grid min-w-0 gap-6">
                <h1 id="table-h" className="cfo-kicker">On the table now</h1>
                {many ? (
                    <div role="tablist" aria-label="On the table" className="-mt-2 flex flex-wrap gap-2" onKeyDown={onKey}>
                        {slides.map((x, i) => (
                            <button
                                key={x.id}
                                ref={(el) => {
                                    tabs.current[i] = el;
                                }}
                                type="button"
                                role="tab"
                                id={`hero-tab-${x.id}`}
                                aria-selected={i === index}
                                aria-controls="hero-panel"
                                tabIndex={i === index ? 0 : -1}
                                onClick={() => pick(i)}
                                className={`cfo-ui rounded-[3px] border px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    i === index
                                        ? 'border-gold-bright text-on-mat'
                                        : 'border-mat-line text-on-mat-soft hover:border-gold hover:text-on-mat'
                                }`}
                            >
                                {x.tab}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div
                    key={s.id}
                    id="hero-panel"
                    role={many ? 'tabpanel' : undefined}
                    aria-labelledby={many ? `hero-tab-${s.id}` : undefined}
                    className="cfo-fade grid gap-2.5"
                >
                    {s.content}
                </div>
                {footer}
            </div>
            <div key={`board-${s.id}`} className="cfo-fade min-w-0">
                <Board gameSystem={s.gameSystem} />
            </div>
        </div>
    );
}
