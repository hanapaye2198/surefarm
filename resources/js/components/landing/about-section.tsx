export function AboutSection() {
    return (
        <section
            id="about"
            className="scroll-mt-20 border-t bg-muted/40 py-16 sm:py-20"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-3xl">
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                        Digital farm management & verification platform
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Built for better agricultural decisions.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        SureFarm is a structured digital foundation for farmer
                        and farm information. It supports registration, mapping,
                        and area verification, and leaves room for later
                        agricultural operations.
                    </p>
                </div>
            </div>
        </section>
    );
}
