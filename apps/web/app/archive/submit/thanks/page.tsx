import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardBody, Button } from '@cfo/ui';
import { CheckCircle2, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Submission received',
};

export default function SubmitThanksPage() {
    return (
        <div className="mx-auto max-w-xl py-10">
            <Card>
                <CardBody className="space-y-4 px-7 py-10 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-forest/50 bg-forest/10 text-forest">
                        <CheckCircle2 size={28} />
                    </div>
                    <h1 className="font-display text-3xl text-ink">
                        Submitted for review
                    </h1>
                    <p className="text-ink-soft">
                        Admins have been notified. Once it's approved, your
                        recap will appear on the archive page for that
                        season or event.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
                        <Link href="/archive" className="no-underline">
                            <Button variant="secondary">
                                Browse the archive
                                <ChevronRight size={14} />
                            </Button>
                        </Link>
                        <Link href="/archive/submit" className="no-underline">
                            <Button variant="ghost">Submit another</Button>
                        </Link>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
