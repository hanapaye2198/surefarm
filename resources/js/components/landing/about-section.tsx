export function AboutSection() {
    return (
        <section id="about" className="scroll-mt-20 border-t py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-3xl">
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                        Digital farm management
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        A shared record for the farms you already work with.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        SureFarm is the operating record for farmer and farm
                        information. Cooperatives and field teams use it to
                        register farms, map boundaries, verify area, and follow
                        production through harvest, inventory, and traceability.
                    </p>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        The included walkthrough follows coffee farms in
                        Bukidnon and Davao del Sur, including Kalasungay Coffee
                        in Malaybalay.
                    </p>
                </div>
            </div>
        </section>
    );
}
