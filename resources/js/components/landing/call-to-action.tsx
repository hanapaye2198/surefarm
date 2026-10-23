import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

export function CallToAction() {
    return (
        <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="rounded-3xl border bg-card px-6 py-12 sm:px-10 sm:py-14">
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                        SureFarm
                    </p>
                    <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Ready to manage your farms smarter?
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                        Access the SureFarm platform to manage farmers, farms,
                        maps, and verification.
                    </p>
                    <Button asChild size="lg" className="mt-8">
                        <Link href={login()}>Access SureFarm</Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
