import { buttonClasses } from '@cfo/ui';
import type { CurrentUser } from '@/lib/auth';

export function UserMenu({ user }: { user: CurrentUser | null }) {
    if (!user) {
        return (
            <div className="flex items-center gap-2">
                <a href="/auth/login" className={buttonClasses('ghost', 'sm')}>
                    Sign in
                </a>
                <a href="/auth/signup" className={buttonClasses('primary', 'sm')}>
                    Join
                </a>
            </div>
        );
    }

    const label = user.profile?.display_name ?? user.profile?.username ?? user.email ?? 'You';

    return (
        <div className="flex items-center gap-2">
            {user.profile?.is_admin ? (
                <a href="/admin" className="cfo-admin-chip">
                    Admin
                </a>
            ) : null}
            <a
                href="/profile"
                className="cfo-ui rounded-[3px] px-2.5 py-1.5 text-[0.95rem] font-semibold text-on-mat-soft no-underline hover:text-on-mat"
            >
                {label}
            </a>
            <form action="/api/auth/signout" method="post">
                <button type="submit" className={buttonClasses('outline', 'sm')}>
                    Sign out
                </button>
            </form>
        </div>
    );
}
