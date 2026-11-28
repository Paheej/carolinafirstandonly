import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Card, CardBody } from '@cfo/ui';
import { ShieldCheck, BookMarked, Inbox, Newspaper, Bot } from 'lucide-react';
import { countAgentDrafts } from '@/lib/agent/admin';
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

async function countNewsDrafts(): Promise<number> {
    const supabase = createServerSupabase(await cookies());
    const { count } = await supabase
        .from('news_posts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft');
    return count ?? 0;
}

export default async function AdminIndexPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/admin');
    if (!user.profile?.is_admin) redirect('/');

    const [pendingRecaps, newsDrafts, agentDrafts] = await Promise.all([countPendingRecaps(), countNewsDrafts(), countAgentDrafts()]);

    return (
        <div className="space-y-8">
            <header className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gold-deep cfo-ui">
                    <ShieldCheck size={14} /> Admin
                </div>
                <h1 className="cfo-heading-underline font-display text-4xl text-graphite">
                    Admin dashboard
                </h1>
                <p className="text-graphite-soft">
                    A growing index of admin areas. User moderation and audit
                    views land in later phases.
                </p>
            </header>

            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <li>
                    <Link href="/archive/pending" className="block no-underline">
                        <Card interactive className="h-full">
                            <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Inbox size={18} className="text-gold-deep" />
                                        <h2 className="font-display text-xl text-graphite">
                                            Pending recaps
                                        </h2>
                                    </div>
                                    {pendingRecaps > 0 ? (
                                        <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-gold text-[11px] font-semibold text-graphite px-1.5">
                                            {pendingRecaps}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-graphite-soft">
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
                                    <BookMarked size={18} className="text-gold-deep" />
                                    <h2 className="font-display text-xl text-graphite">
                                        Archive
                                    </h2>
                                </div>
                                <p className="text-sm text-graphite-soft">
                                    Public archive index — seasons and special events.
                                </p>
                            </CardBody>
                        </Card>
                    </Link>
                </li>
                <li>
                    <Link href="/news/admin" className="block no-underline">
                        <Card interactive className="h-full">
                            <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Newspaper size={18} className="text-gold-deep" />
                                        <h2 className="font-display text-xl text-graphite">
                                            News posts
                                        </h2>
                                    </div>
                                    {newsDrafts > 0 ? (
                                        <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-gold text-[11px] font-semibold text-graphite px-1.5">
                                            {newsDrafts}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-graphite-soft">
                                    Write, publish and archive news. The number is how
                                    many drafts are waiting.
                                </p>
                            </CardBody>
                        </Card>
                    </Link>
                </li>
                <li>
                    <Link href="/news/admin/drafts" className="block no-underline">
                        <Card interactive className="h-full">
                            <CardBody className="flex h-full flex-col gap-3 px-6 py-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Bot size={18} className="text-gold-deep" />
                                        <h2 className="font-display text-xl text-graphite">
                                            News agent
                                        </h2>
                                    </div>
                                    {agentDrafts > 0 ? (
                                        <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-gold text-[11px] font-semibold text-graphite px-1.5">
                                            {agentDrafts}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-graphite-soft">
                                    Drafts the agent wrote from the sites it follows, its
                                    runs and its sources. The number is how many drafts are waiting.
                                </p>
                            </CardBody>
                        </Card>
                    </Link>
                </li>
            </ul>
        </div>
    );
}
