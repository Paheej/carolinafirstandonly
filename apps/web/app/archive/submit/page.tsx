import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, PenSquare } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getRecapTargets } from '@/lib/archive';
import { SubmitRecapForm } from './SubmitRecapForm';

export const metadata: Metadata = {
    title: 'Submit a recap',
};

export default async function SubmitRecapPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/archive/submit');

    const targets = await getRecapTargets();

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <nav className="text-sm">
                <Link href="/archive" className="inline-flex items-center gap-1 text-ink-soft">
                    <ArrowLeft size={14} /> Archive
                </Link>
            </nav>

            <header className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-leather font-mono">
                    <PenSquare size={14} /> Submit
                </div>
                <h1 className="cfo-heading-underline font-display text-4xl text-ink">
                    Submit a recap
                </h1>
                <p className="text-ink-soft max-w-2xl">
                    Pick a season or special event, write up what happened in
                    markdown, and add any photos you took. Admins approve
                    submissions before they go live on the archive.
                </p>
            </header>

            <SubmitRecapForm seasons={targets.seasons} events={targets.events} />
        </div>
    );
}
