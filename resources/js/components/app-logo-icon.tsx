import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
        >
            <path
                d="M12 21.5c-3.8-2.6-6.5-6.2-6.5-10.2C5.5 7.4 8.4 4.5 12 4.5c.4 0 .8 0 1.2.1C12.4 6.8 11.2 9.4 11.2 12c1.5.7 3.6 1.1 5.6.6 0 3.6-2.1 6.4-4.8 8.9Z"
                fill="currentColor"
            />
            <path
                d="M13.2 4.2c1.8-1.5 4.3-1.8 6.3-.6-1.1 2.2-2.8 3.6-4.8 4.2-.7-1.3-1.2-2.5-1.5-3.6Z"
                fill="currentColor"
                opacity="0.85"
            />
        </svg>
    );
}
