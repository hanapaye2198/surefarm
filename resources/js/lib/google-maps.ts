import { usePage } from '@inertiajs/react';

export type GoogleMapType = 'roadmap' | 'hybrid';

type GoogleLatLng = {
    lat: number;
    lng: number;
};

export type GoogleMapInstance = {
    setCenter: (center: GoogleLatLng) => void;
    setZoom: (zoom: number) => void;
    setMapTypeId: (mapType: GoogleMapType) => void;
};

type GoogleMapsNamespace = {
    Map: new (
        element: HTMLElement,
        options: {
            center: GoogleLatLng;
            zoom: number;
            mapTypeId: GoogleMapType;
            disableDefaultUI: boolean;
            gestureHandling: 'none';
            keyboardShortcuts: boolean;
            clickableIcons: boolean;
            backgroundColor: string;
        },
    ) => GoogleMapInstance;
    event: {
        trigger: (instance: GoogleMapInstance, eventName: string) => void;
    };
    importLibrary?: (name: string) => Promise<unknown>;
};

declare global {
    interface Window {
        google?: {
            maps: GoogleMapsNamespace;
        };
    }
}

let loading: Promise<void> | null = null;

export function useGoogleMapsApiKey(): string {
    const { google_maps_api_key } = usePage().props;

    return (
        google_maps_api_key?.trim() ||
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
        ''
    );
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
    if (window.google?.maps) {
        return Promise.resolve();
    }

    if (loading === null) {
        loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
            script.async = true;
            script.onload = () => {
                const maps = window.google?.maps;

                if (!maps?.importLibrary) {
                    resolve();

                    return;
                }

                maps.importLibrary('maps')
                    .then(() => resolve())
                    .catch((error: unknown) => {
                        loading = null;
                        reject(error);
                    });
            };
            script.onerror = () => {
                loading = null;
                reject(new Error('Google Maps could not be loaded.'));
            };
            document.head.appendChild(script);
        });
    }

    return loading;
}
