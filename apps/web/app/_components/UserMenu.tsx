import { Button } from '@cfo/ui';
import type { CurrentUser } from '@/lib/auth';

export function UserMenu({ user }: { user: CurrentUser | null }) {
    if (!user) {
        return (
            <div className="flex items-center gap-2">
                <a href="/auth/login">
                    <Button variant="ghost" size="sm">
                        Log in
                    </Button>
                </a>
                <a href="/auth/signup">
                    <Button variant="primary" size="sm">
                        Sign up
                    </Button>
                </a>
            </div>
        );
    }

    const label =
        user.profile?.display_name ?? user.profile?.username ?? user.email ?? 'You';

    return (
        <div className="flex items-center gap-2">
            {user.profile?.is_admin ? (
                <a href="/admin" className="cfo-admin-chip">
                    Admin
                </a>
            ) : null}
            <a
                href="/profile"
                className="inline-flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-parchment-dark hover:text-forest-dark"
            >
                {label}
            </a>
            <form action="/api/auth/signout" method="post">
                <Button variant="secondary" size="sm" type="submit">
                    Sign out
                </Button>
            </form>
        </div>
    );
}
