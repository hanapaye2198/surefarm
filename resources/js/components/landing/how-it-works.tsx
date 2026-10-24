const steps = [
    {
        number: '01',
        title: 'Register',
        description:
            'Create the farmer profile, then attach each farm with its crop, location, and declared area.',
    },
    {
        number: '02',
        title: 'Map',
        description:
            'Place the farm and draw the boundary so the measured area is stored with the record.',
    },
    {
        number: '03',
        title: 'Verify',
        description:
            'A field verifier compares the declaration with the mapped area, using GPS and photos from the mobile app.',
    },
    {
        number: '04',
        title: 'Follow the harvest',
        description:
            'Record production and harvest, receive it into inventory, and publish a lot buyers can follow.',
    },
];

export function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="scroll-mt-20 border-t bg-muted/40 py-16 sm:py-20"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        How it works
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        The same farm moves from a declared area to a verified
                        boundary, then into harvest and traceability.
                    </p>
                </div>
                <ol className="mt-10 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((step) => (
                        <li key={step.number} className="bg-card p-5 sm:p-6">
                            <p className="font-mono text-sm font-semibold text-primary">
                                {step.number}
                            </p>
                            <h3 className="mt-3 text-lg font-semibold tracking-tight">
                                {step.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {step.description}
                            </p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
