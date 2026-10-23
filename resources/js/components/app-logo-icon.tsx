import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const surefarmLogoSrc = '/surefarm%20logo.png';

export default function AppLogoIcon({
    className,
    alt = 'SureFarm',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            {...props}
            src={surefarmLogoSrc}
            alt={alt}
            className={cn('h-8 w-auto object-contain object-left', className)}
        />
    );
}
