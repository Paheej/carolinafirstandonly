'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { DungeonMap, WarTable, buttonClasses } from '@cfo/ui';

export interface HeroCampaign {
    id: string;
    slug: string;
    name: string;
    system: string | null;
    gameSystem: string | null;
    blurb: string | null;
    externalUrl: string | null;
    externalLabel: string | null;
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
 * Home hero when no game day is scheduled: one running campaign at a time,
 * with its own board (war table for 40K, dungeon map for D&D). Advances on its
 * own every few seconds, pauses on hover or focus, stops once someone picks a
 * campaign, and never auto-advances for reduced motion.
 */
export function CampaignHero({ campaigns, footer }: { campaigns: HeroCampaign[]; footer?: ReactNode }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [picked, setPicked] = useState(false);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const many = campaigns.length > 1;

    useEffect(() => {
        if (!many || paused || picked) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const t = setInterval(() => setIndex((i) => (i + 1) % campaigns.length), ROTATE_MS);
        return () => clearInterval(t);
    }, [many, paused, picked, campaigns.length]);

    const c = campaigns[index]!;

    const pick = (i: number, focus = false) => {
        setIndex(i);
        setPicked(true);
        if (focus) tabs.current[i]?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
        const n = campaigns.length;
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
                    <div role="tablist" aria-label="Running campaigns" className="-mt-2 flex flex-wrap gap-2" onKeyDown={onKey}>
                        {campaigns.map((x, i) => (
                            <button
                                key={x.id}
                                ref={(el) => {
                                    tabs.current[i] = el;
                                }}
                                type="button"
                                role="tab"
                                id={`hero-tab-${x.slug}`}
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
                                {x.name}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div
                    key={c.id}
                    id="hero-panel"
                    role={many ? 'tabpanel' : undefined}
                    aria-labelledby={many ? `hero-tab-${c.slug}` : undefined}
                    className="cfo-fade grid gap-2.5"
                >
                    <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-[850] leading-[0.95] text-on-mat">{c.name}</h2>
                    {c.system ? <p className="cfo-ui text-on-mat-soft">{c.system}</p> : null}
                    {c.blurb ? <p className="max-w-[46ch] text-on-mat-soft">{c.blurb}</p> : null}
                    <div className="flex flex-wrap gap-3 pt-1">
                        {c.externalUrl ? (
                            <a href={c.externalUrl} className={buttonClasses('primary')}>
                                {c.externalLabel}
                            </a>
                        ) : null}
                        <Link href={`/archive/seasons/${c.slug}`} className={buttonClasses(c.externalUrl ? 'outline' : 'primary')}>
                            Campaign page
                        </Link>
                    </div>
                </div>
                {footer}
            </div>
            <div key={`board-${c.id}`} className="cfo-fade min-w-0">
                <Board gameSystem={c.gameSystem} />
            </div>
        </div>
    );
}
