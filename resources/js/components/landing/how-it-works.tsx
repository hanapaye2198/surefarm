const steps = [
    {
        number: '01',
        title: 'Register Farmers',
        description:
            'Create a structured profile for each farmer, including identity and location details.',
    },
    {
        number: '02',
        title: 'Register Farms',
        description:
            'Attach farms to a farmer, with the crop, location, and declared area.',
    },
    {
        number: '03',
        title: 'Map & Measure',
        description:
            'Place the farm on the map and record a boundary so measured area can be compared.',
    },
    {
        number: '04',
        title: 'Verify',
        description:
            'Review declared information and measured area before a farm is marked verified.',
    },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    How it works
                </h2>
                <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((step) => (
                        <li
                            key={step.number}
                            className="rounded-2xl border bg-card p-5 shadow-sm"
                        >
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
