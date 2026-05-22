import './globals.css';
import type { Metadata } from 'next';
import { NavBar, Footer } from '@cfo/ui';
import { SITE_NAME, SITE_TAGLINE } from '@cfo/shared';
import { getCurrentUser } from '@/lib/auth';
import { UserMenu } from './_components/UserMenu';
import { MobileNav } from './_components/MobileNav';

export const metadata: Metadata = {
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_TAGLINE,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();
    const links = [
        { href: '/archive', label: 'Archive' },
        { href: '/news', label: 'News' },
        { href: '/groups', label: 'Groups' },
        { href: '/events', label: 'Events' },
    ];

    return (
        <html lang="en">
            <body>
                <NavBar
                    siteName={SITE_NAME}
                    links={links}
                    rightSlot={<UserMenu user={user} />}
                    mobileMenu={<MobileNav links={links} user={user} />}
                />
                <main className="mx-auto max-w-6xl px-4 py-8 min-h-[calc(100dvh-7rem)]">
                    {children}
                </main>
                <Footer siteName={SITE_NAME} />
            </body>
        </html>
    );
}
