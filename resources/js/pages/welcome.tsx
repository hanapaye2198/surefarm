import { Head } from '@inertiajs/react';
import { AboutSection } from '@/components/landing/about-section';
import { Audiences } from '@/components/landing/audiences';
import { CallToAction } from '@/components/landing/call-to-action';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { MapShowcase } from '@/components/landing/map-showcase';
import { PlatformFeatures } from '@/components/landing/platform-features';
import { VerificationShowcase } from '@/components/landing/verification-showcase';

const description =
    'SureFarm keeps farmer records, mapped farm boundaries, field verification, harvest, inventory, and coffee traceability together for cooperatives and field teams.';

export default function Welcome() {
    return (
        <>
            <Head title="Farm records and verification">
                <meta
                    head-key="description"
                    name="description"
                    content={description}
                />
            </Head>
            <div
                id="top"
                className="relative scroll-smooth bg-background text-foreground"
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-primary/10 to-transparent"
                />
                <div className="relative">
                    <LandingNavbar />
                    <main>
                        <HeroSection />
                        <Audiences />
                        <PlatformFeatures />
                        <HowItWorks />
                        <VerificationShowcase />
                        <MapShowcase />
                        <AboutSection />
                        <CallToAction />
                    </main>
                    <LandingFooter />
                </div>
            </div>
        </>
    );
}
