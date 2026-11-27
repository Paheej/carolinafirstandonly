import { Card, CardBody, CardHeader } from '@cfo/ui';
import { safeNext } from '@/lib/auth';
import { AuthForm } from '../_components/AuthForm';

interface PageProps {
    searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: PageProps) {
    const next = safeNext((await searchParams).next);
    return (
        <div className="mx-auto max-w-sm py-8">
            <Card>
                <CardHeader>
                    <h1 className="cfo-heading-underline font-display text-2xl text-graphite">Create your account</h1>
                </CardHeader>
                <CardBody>
                    <AuthForm mode="signup" next={next} />
                    <p className="mt-6 text-sm text-graphite-soft">
                        Already have an account?{' '}
                        <a href={`/auth/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="underline">
                            Sign in
                        </a>
                        .
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
