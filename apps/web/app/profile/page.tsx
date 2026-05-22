import { redirect } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@cfo/ui';
import { getCurrentUser } from '@/lib/auth';

export default async function ProfilePage() {
    const user = await getCurrentUser();
    if (!user) redirect('/auth/login?next=/profile');

    return (
        <div className="max-w-xl">
            <Card>
                <CardHeader>
                    <h1 className="cfo-heading-underline font-display text-2xl text-ink">
                        Profile
                    </h1>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                    <div>
                        <span className="text-ink-soft">Username:</span>{' '}
                        <strong>{user.profile?.username ?? '—'}</strong>
                    </div>
                    <div>
                        <span className="text-ink-soft">Email:</span>{' '}
                        <strong>{user.email ?? '—'}</strong>
                    </div>
                    <div>
                        <span className="text-ink-soft">Admin:</span>{' '}
                        <strong>{user.profile?.is_admin ? 'yes' : 'no'}</strong>
                    </div>
                    <p className="text-xs text-ink-soft/70 pt-3 border-t border-brass-dark/20">
                        Phase 0 profile view — full settings, calendar connections, and
                        public profile pages land in Phase 2.
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
