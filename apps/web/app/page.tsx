import { Card, CardBody, Button, Badge } from '@cfo/ui';
import { SITE_NAME } from '@cfo/shared';
import {
    BookMarked,
    Newspaper,
    Users,
    ChevronRight,
    ExternalLink,
    Swords,
    Shield,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
    const user = await getCurrentUser();

    return (
        <div className="space-y-14">
            {/* ----- HERO -------------------------------------------------- */}
            <section
                className={[
                    'cfo-hex-bg cfo-spotlight',
                    'relative overflow-hidden rounded-sm',
                    'border border-brass-dark/50',
                    'bg-gradient-to-br from-parchment-dark/70 via-parchment/40 to-parchment-dark/30',
                    'shadow-[0_2px_0_rgba(176,141,87,0.5),0_10px_30px_-10px_rgba(26,24,21,0.25)]',
                    'px-7 py-14 sm:px-16 sm:py-24',
                ].join(' ')}
            >
                <span className="cfo-ribbon" aria-hidden="true" />

                <div className="relative max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="brass">Charlotte · NC</Badge>
                        <span className="h-px w-12 bg-brass-dark/60" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft/80">
                            Est. 2023 · for the hobby
                        </span>
                    </div>

                    <h1 className="cfo-heading-underline mt-5 font-display text-5xl sm:text-6xl text-ink leading-[1.05]">
                        {SITE_NAME}
                    </h1>

                    <p className="mt-7 text-lg sm:text-xl text-ink-soft leading-relaxed max-w-xl">
                        A community of painters, generals, and storytellers. 40K runs
                        the table — D&amp;D, Warhammer Fantasy, Warhammer RPG, board
                        games, and whatever else you brought all get a seat.
                    </p>

                    <div className="mt-9 flex flex-wrap gap-3">
                        {user ? (
                            <>
                                <a href="/events">
                                    <Button size="lg">
                                        Upcoming events <ChevronRight size={18} />
                                    </Button>
                                </a>
                                <a href="/groups">
                                    <Button size="lg" variant="secondary">
                                        Find your group
                                    </Button>
                                </a>
                            </>
                        ) : (
                            <>
                                <a href="/auth/signup">
                                    <Button size="lg">
                                        Join the warband <ChevronRight size={18} />
                                    </Button>
                                </a>
                                <a href="/archive">
                                    <Button size="lg" variant="secondary">
                                        Browse the archive
                                    </Button>
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ----- THREE PILLARS ---------------------------------------- */}
            <section>
                <div className="mb-6 flex items-baseline justify-between">
                    <h2 className="cfo-heading-underline font-display text-2xl">
                        What's in the campaign book
                    </h2>
                    <span className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-ink-soft/70 font-mono">
                        Three pillars
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <FeatureCard
                        href="/archive"
                        icon={<BookMarked size={20} />}
                        title="Archive"
                        body="Three seasons of crusade play and our special-event battles, preserved with recaps and photos. Submit your own when the dust settles."
                    />
                    <FeatureCard
                        href="/news"
                        icon={<Newspaper size={20} />}
                        title="News"
                        body="What the hobby is talking about this week — curated daily from the sources you'd otherwise have to scroll through yourself."
                    />
                    <FeatureCard
                        href="/groups"
                        icon={<Users size={20} />}
                        title="Coordination"
                        body="Groups, events, RSVPs, and shared availability — so the hardest part of game night is choosing what to bring."
                    />
                </div>
            </section>

            {/* ----- CURRENT CAMPAIGNS ----------------------------------- */}
            <section>
                <div className="mb-6 flex items-baseline justify-between">
                    <h2 className="cfo-heading-underline font-display text-2xl">
                        Current campaigns
                    </h2>
                    <span className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-ink-soft/70 font-mono">
                        Live · upcoming
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <CampaignCard
                        href="https://campaign-chronicle.app"
                        external
                        systemLabel="Warhammer 40,000"
                        systemVariant="forest"
                        icon={<Swords size={20} />}
                        title="40K Crusade — Campaign Chronicle"
                        body="Our active 40K crusade lives on campaign-chronicle.app — narrative arcs, roster updates, and battle results tracked between game nights."
                        linkLabel="campaign-chronicle.app"
                    />
                    <CampaignCard
                        placeholder
                        systemLabel="Warhammer Fantasy"
                        systemVariant="leather"
                        icon={<Shield size={20} />}
                        title="Old World campaign"
                        body="A dedicated Fantasy campaign hub is the next build after this site ships. We'll wire it into the archive and event system when it lands."
                    />
                </div>
            </section>

            {/* ----- PHASE 0 NOTICE --------------------------------------- */}
            <section className="cfo-pinned-notice relative">
                <div
                    className="relative rounded-sm border-x border-b border-t-2 border-brass-dark/60 bg-parchment px-7 py-7 pr-28"
                    style={{ borderTopStyle: 'dashed' }}
                >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-leather font-mono">
                        <span className="inline-block h-px w-6 bg-leather/70" />
                        Builder's note
                    </div>
                    <h3 className="mt-2 font-display text-2xl text-ink">
                        Phase&nbsp;0 — Foundation
                    </h3>
                    <p className="mt-2 text-sm sm:text-base text-ink-soft max-w-2xl">
                        The site shell, auth, and design system are live. Archive,
                        news, groups, events, and the AI agent land in subsequent
                        phases. If something looks off, that's where to point.
                    </p>

                    <span
                        className="cfo-seal absolute top-5 right-6"
                        aria-hidden="true"
                        title="Phase 0"
                    >
                        <span>
                            Phase
                            <br />
                            <strong className="text-base font-display tracking-normal">
                                0
                            </strong>
                        </span>
                    </span>
                </div>
            </section>
        </div>
    );
}

function FeatureCard({
    href,
    icon,
    title,
    body,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    body: string;
}) {
    return (
        <a href={href} className="block no-underline">
            <Card interactive className="h-full">
                <CardBody className="flex h-full flex-col gap-4 px-7 py-7">
                    <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-sm border border-brass-dark/60 bg-brass/20 text-leather">
                            {icon}
                        </span>
                        <h3 className="font-display text-xl text-ink">{title}</h3>
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed">{body}</p>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-forest">
                        Enter
                        <ChevronRight size={14} />
                    </span>
                </CardBody>
            </Card>
        </a>
    );
}

function CampaignCard({
    href,
    external,
    placeholder,
    systemLabel,
    systemVariant,
    icon,
    title,
    body,
    linkLabel,
}: {
    href?: string;
    external?: boolean;
    placeholder?: boolean;
    systemLabel: string;
    systemVariant: 'forest' | 'leather' | 'brass';
    icon: React.ReactNode;
    title: string;
    body: string;
    linkLabel?: string;
}) {
    const inner = (
        <Card
            interactive={!placeholder}
            className={[
                'h-full',
                placeholder ? 'border-dashed opacity-90' : '',
            ].join(' ')}
        >
            <CardBody className="flex h-full flex-col gap-4 px-7 py-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={systemVariant}>{systemLabel}</Badge>
                    {placeholder ? (
                        <Badge variant="default">Coming next</Badge>
                    ) : linkLabel ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-soft">
                            {linkLabel} <ExternalLink size={11} />
                        </span>
                    ) : null}
                </div>

                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-sm border border-brass-dark/60 bg-brass/20 text-leather">
                        {icon}
                    </span>
                    <h3 className="font-display text-xl text-ink">{title}</h3>
                </div>

                <p className="text-sm text-ink-soft leading-relaxed">{body}</p>

                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-forest">
                    {placeholder ? (
                        <span className="text-ink-soft/70">Stay tuned</span>
                    ) : (
                        <>
                            Open <ExternalLink size={12} />
                        </>
                    )}
                </span>
            </CardBody>
        </Card>
    );

    if (placeholder || !href) return <div>{inner}</div>;

    return external ? (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block no-underline"
        >
            {inner}
        </a>
    ) : (
        <a href={href} className="block no-underline">
            {inner}
        </a>
    );
}
