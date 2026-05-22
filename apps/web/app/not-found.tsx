import { Card, CardBody } from '@cfo/ui';

export default function NotFound() {
    return (
        <div className="max-w-md py-12">
            <Card>
                <CardBody className="space-y-3">
                    <h1 className="cfo-heading-underline font-display text-2xl text-ink">
                        Off the map
                    </h1>
                    <p className="text-sm text-ink-soft">
                        That page hasn't been charted yet. It's either Phase-something
                        work that hasn't shipped, or you took a wrong turn at the
                        objective marker.
                    </p>
                    <a href="/" className="text-sm underline">
                        ← Back to the home table
                    </a>
                </CardBody>
            </Card>
        </div>
    );
}
