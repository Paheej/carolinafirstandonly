import { Card, CardBody, CardHeader } from '@cfo/ui';
import { AuthForm } from '../_components/AuthForm';

export default function SignupPage() {
    return (
        <div className="mx-auto max-w-sm py-8">
            <Card>
                <CardHeader>
                    <h1 className="cfo-heading-underline font-display text-2xl text-ink">
                        Create your account
                    </h1>
                </CardHeader>
                <CardBody>
                    <AuthForm mode="signup" />
                    <p className="mt-6 text-sm text-ink-soft">
                        Already have an account?{' '}
                        <a href="/auth/login" className="underline">
                            Log in
                        </a>
                        .
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
