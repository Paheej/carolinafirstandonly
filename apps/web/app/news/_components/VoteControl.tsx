'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// One FingerprintJS run per page view, started on load so the first click is quick.
let visitorPromise: Promise<string | null> | null = null;
function visitorId(): Promise<string | null> {
    visitorPromise ??= import('@fingerprintjs/fingerprintjs')
        .then((m) => m.default.load({ monitoring: false }))
        .then((agent) => agent.get())
        .then((r) => r.visitorId)
        .catch(() => null);
    return visitorPromise;
}

export interface VoteControlProps {
    postId: string;
    title: string;
    upvotes: number;
    downvotes: number;
    myVote: number;
    layout?: 'column' | 'row';
}

/**
 * Up, score, down. The score sits in a gold objective-marker ring; your
 * vote fills the arrow (gold up, red down). Clicking your vote again clears it.
 */
export function VoteControl({ postId, title, upvotes, downvotes, myVote, layout = 'column' }: VoteControlProps) {
    const [state, setState] = React.useState({ up: upvotes, down: downvotes, mine: myVote });
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        void visitorId();
    }, []);

    async function cast(dir: 1 | -1) {
        if (busy) return;
        const prev = state;
        const next = prev.mine === dir ? 0 : dir;
        // Optimistic: move this visitor's vote, then settle on the server's counts.
        setState({
            up: prev.up - (prev.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
            down: prev.down - (prev.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
            mine: next,
        });
        setBusy(true);
        setError(null);
        try {
            const res = await fetch('/api/votes', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ post_id: postId, vote: next, visitor_id: await visitorId() }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error ?? 'Your vote wasn’t saved. Try again.');
            setState({ up: body.upvotes, down: body.downvotes, mine: body.my_vote });
        } catch (e) {
            setState(prev);
            setError(e instanceof Error ? e.message : 'Your vote wasn’t saved. Try again.');
        } finally {
            setBusy(false);
        }
    }

    const score = state.up - state.down;
    const arrow = (on: boolean, tone: 'up' | 'down') =>
        `grid h-9 w-9 place-items-center rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
            on
                ? tone === 'up'
                    ? 'bg-gold-bright text-mat'
                    : 'bg-casualty text-primer-lift'
                : 'text-graphite-soft hover:bg-graphite/10 hover:text-graphite'
        }`;

    return (
        <div className={layout === 'column' ? 'flex w-12 shrink-0 flex-col items-center gap-1' : 'flex items-center gap-2'}>
            <button
                type="button"
                className={arrow(state.mine === 1, 'up')}
                aria-pressed={state.mine === 1}
                aria-label={`Upvote ${title}`}
                onClick={() => cast(1)}
            >
                <ChevronUp size={22} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <span
                className={`cfo-ui cfo-num grid h-11 min-w-11 place-items-center rounded-full border-2 px-1 text-lg font-extrabold leading-none ${
                    state.mine === -1 ? 'border-casualty text-casualty' : 'border-gold text-graphite'
                }`}
                aria-live="polite"
                title={`${state.up} up, ${state.down} down`}
            >
                <span className="sr-only">Score </span>
                {score}
            </span>
            <button
                type="button"
                className={arrow(state.mine === -1, 'down')}
                aria-pressed={state.mine === -1}
                aria-label={`Downvote ${title}`}
                onClick={() => cast(-1)}
            >
                <ChevronDown size={22} strokeWidth={2.5} aria-hidden="true" />
            </button>
            {error ? (
                <p role="alert" className={`cfo-ui text-xs text-casualty ${layout === 'column' ? 'w-24 text-center' : ''}`}>
                    {error}
                </p>
            ) : null}
        </div>
    );
}
