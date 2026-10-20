import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { login } from '@/routes';

export function CallToAction() {
    return (
        <section className="border-t bg-muted/40 py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground sm:px-10 sm:py-14">
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary-foreground/70 uppercase">
                        Web and mobile
                    </p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Bring every farm onto one record.
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/80">
                        Register farmers, map boundaries, verify area, and
                        follow the harvest. Field teams can do the same work
                        from the SureFarm mobile app.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Button
                            asChild
                            size="lg"
                            variant="secondary"
                            className="w-full sm:w-auto"
                        >
                            <Link href={login()}>Access SureFarm</Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
                        >
                            <a href="#verification">See a verification</a>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
