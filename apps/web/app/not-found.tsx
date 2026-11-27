import Link from 'next/link';
import { PageHead, buttonClasses } from '@cfo/ui';

export default function NotFound() {
    return (
        <>
            <PageHead
                kicker="Page not found"
                title="Off the board"
                lede="There's nothing at this address. The page may have moved, or it belongs to a part of the site that isn't built yet."
            />
            <div className="py-12">
                <Link href="/" className={buttonClasses('secondary')}>
                    Back to the home page
                </Link>
            </div>
        </>
    );
}
