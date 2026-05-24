import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Card, CardBody } from '@cfo/ui';
import { ShieldCheck, BookMarked, Inbox } from 'lucide-react';
import { createServerSupabase } from '@cfo/database/server';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
    title: 'Admin',
};

async function countPendingRecaps(): Promise<number> {
    const supabase = createServerSupabase(await cookies());
    const { count } = await supabase
        .from('recap_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
    return count ?? 0;
}

export default async function AdminIndexPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/admin');
    if (!user.profile?.is_admin) redirect('/');

    const pendingRecaps = await countPendingRecaps();

    return (
        <div className="space-y-8">
            <header className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-leather font-mono">
                    <ShieldCheck size={14} /> Admin
                </div>
                <h1 className="cfo-heading-underline font-display text-4xl text-ink">
                    Admin dashboard
                </h1>
                <p className="text-ink-soft">
                    A growing index of admin areas. News drafts, user moderation,
                    and audit views land in subsequent phases.
                </p>
            </header>

            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <li>
                    <Link href="/archive/pending" className="block no-underline">
                        <Card interactive className="h-full">
                            <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Inbox size={18} className="text-leather" />
                                        <h2 className="font-display text-xl text-ink">
                                            Pending recaps
                                        </h2>
                                    </div>
                                    {pendingRecaps > 0 ? (
                                        <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-brass text-[11px] font-semibold text-ink px-1.5">
                                            {pendingRecaps}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-ink-soft">
                                    Review user-submitted battle recaps. Approve, edit
                                    then approve, or reject with a note.
                                </p>
                            </CardBody>
                        </Card>
                    </Link>
                </li>
                <li>
                    <Link href="/archive" className="block no-underline">
                        <Card interactive className="h-full">
                            <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                <div className="flex items-center gap-2">
                                    <BookMarked size={18} className="text-leather" />
                                    <h2 className="font-display text-xl text-ink">
                                        Archive
                                    </h2>
                                </div>
                                <p className="text-sm text-ink-soft">
                                    Public archive index — seasons and special events.
                                </p>
                            </CardBody>
                        </Card>
                    </Link>
                </li>
            </ul>
        </div>
    );
}
