import { Head } from '@inertiajs/react';
import { AboutSection } from '@/components/landing/about-section';
import { CallToAction } from '@/components/landing/call-to-action';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { MapShowcase } from '@/components/landing/map-showcase';
import { PlatformFeatures } from '@/components/landing/platform-features';
import { VerificationShowcase } from '@/components/landing/verification-showcase';

export default function Welcome() {
    return (
        <>
            <Head title="Digital Farm Management" />
            <div
                id="top"
                className="scroll-smooth bg-background text-foreground"
            >
                <LandingNavbar />
                <main>
                    <HeroSection />
                    <PlatformFeatures />
                    <HowItWorks />
                    <VerificationShowcase />
                    <MapShowcase />
                    <AboutSection />
                    <CallToAction />
                </main>
                <LandingFooter />
            </div>
        </>
    );
}
