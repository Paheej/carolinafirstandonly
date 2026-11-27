import { Card, CardBody, CardHeader } from '@cfo/ui';
import { AuthForm } from '../_components/AuthForm';

interface PageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
    const params = await searchParams;
    return (
        <div className="mx-auto max-w-sm py-8">
            <Card>
                <CardHeader>
                    <h1 className="cfo-heading-underline font-display text-2xl text-graphite">
                        Sign in
                    </h1>
                </CardHeader>
                <CardBody>
                    <AuthForm mode="login" initialError={params.error ?? null} />
                    <p className="mt-6 text-sm text-graphite-soft">
                        New here?{' '}
                        <a href="/auth/signup" className="underline">
                            Create an account
                        </a>
                        .
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
