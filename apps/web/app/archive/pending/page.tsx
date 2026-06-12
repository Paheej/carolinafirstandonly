import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Card, CardBody } from '@cfo/ui';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { createServerSupabase } from '@cfo/database/server';
import type { RecapSubmission } from '@cfo/database/types';
import { getCurrentUser } from '@/lib/auth';
import { PendingSubmissionCard } from './PendingSubmissionCard';

export const metadata: Metadata = {
    title: 'Pending recaps',
};

interface AuthorRow {
    id: string;
    username: string;
    display_name: string | null;
}

async function loadPending(): Promise<{
    submissions: RecapSubmission[];
    authors: Map<string, AuthorRow>;
    targetLabels: Map<string, string>;
}> {
    const supabase = createServerSupabase(await cookies());
    const { data: submissions } = await supabase
        .from('recap_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });

    const rows = submissions ?? [];
    const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
    const seasonIds = Array.from(new Set(rows.map((r) => r.season_id).filter(Boolean) as string[]));
    const eventIds = Array.from(
        new Set(rows.map((r) => r.archive_event_id).filter(Boolean) as string[]),
    );

    const [authorsRes, seasonsRes, eventsRes] = await Promise.all([
        authorIds.length > 0
            ? supabase
                  .from('profiles')
                  .select('id, username, display_name')
                  .in('id', authorIds)
            : Promise.resolve({ data: [] as AuthorRow[] }),
        seasonIds.length > 0
            ? supabase.from('seasons').select('id, name').in('id', seasonIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        eventIds.length > 0
            ? supabase.from('archive_events').select('id, name').in('id', eventIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const authors = new Map<string, AuthorRow>(
        (authorsRes.data ?? []).map((a) => [a.id, a]),
    );
    const targetLabels = new Map<string, string>();
    for (const s of seasonsRes.data ?? []) targetLabels.set(`season:${s.id}`, s.name);
    for (const e of eventsRes.data ?? []) targetLabels.set(`event:${e.id}`, e.name);

    return { submissions: rows, authors, targetLabels };
}

export default async function PendingRecapsPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/archive/pending');
    if (!user.profile?.is_admin) redirect('/archive');

    const { submissions, authors, targetLabels } = await loadPending();

    return (
        <div className="space-y-8">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>

            <header className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-leather font-mono">
                    <ShieldCheck size={14} /> Admin
                </div>
                <h1 className="cfo-heading-underline font-display text-4xl text-ink">
                    Pending recaps
                </h1>
                <p className="text-ink-soft max-w-2xl">
                    Review submissions before they go live. Approve to publish,
                    edit-then-approve to clean up, or reject with a note.
                </p>
            </header>

            {submissions.length === 0 ? (
                <Card>
                    <CardBody className="px-7 py-10 text-center">
                        <p className="font-display text-xl text-ink">
                            Inbox zero.
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            Nothing pending review right now.
                        </p>
                    </CardBody>
                </Card>
            ) : (
                <ul className="space-y-6">
                    {submissions.map((s) => {
                        const targetLabel = s.season_id
                            ? targetLabels.get(`season:${s.season_id}`) ?? 'Season'
                            : s.archive_event_id
                            ? targetLabels.get(`event:${s.archive_event_id}`) ?? 'Special event'
                            : 'Unattached';
                        return (
                            <li key={s.id}>
                                <PendingSubmissionCard
                                    submission={s}
                                    targetLabel={targetLabel}
                                    author={authors.get(s.author_id) ?? null}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
