import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

const loginImage = '/images/login-coffee-farm.jpg';

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="grid min-h-svh bg-background lg:grid-cols-2">
            <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
                <div className="mx-auto flex w-full max-w-md flex-col gap-8">
                    <Link
                        href={home()}
                        className="w-fit rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <AppLogoIcon className="h-12" />
                    </Link>
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {title}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>
                    {children}
                </div>
            </div>
            <div className="relative hidden min-h-svh lg:block">
                <img
                    src={loginImage}
                    alt="Coffee trees growing in rows on a green hillside"
                    className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/10" />
                <div className="absolute right-10 bottom-10 left-10 text-white">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase">
                        SureFarm
                    </p>
                    <p className="mt-2 max-w-sm text-3xl font-semibold tracking-tight text-balance">
                        Verified from the ground up.
                    </p>
                </div>
            </div>
        </div>
    );
}
