import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

export function CallToAction() {
    return (
        <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="rounded-3xl bg-primary px-6 py-12 text-primary-foreground sm:px-10 sm:py-14">
                    <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Ready to manage your farms smarter?
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/80">
                        Access the SureFarm platform to manage farmers, farms,
                        maps, and verification.
                    </p>
                    <Button
                        asChild
                        size="lg"
                        variant="secondary"
                        className="mt-8"
                    >
                        <Link href={login()}>Access SureFarm</Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
