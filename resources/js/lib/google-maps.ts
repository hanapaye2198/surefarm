import { usePage } from '@inertiajs/react';

export type GoogleMapType = 'roadmap' | 'hybrid';

export type GoogleLatLng = {
    lat: number;
    lng: number;
};

export type GoogleMapInstance = {
    setCenter: (center: GoogleLatLng) => void;
    setZoom: (zoom: number) => void;
    setMapTypeId: (mapType: GoogleMapType) => void;
    fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

export type GoogleLatLngBounds = {
    extend: (point: GoogleLatLng) => void;
    isEmpty: () => boolean;
};

export type GoogleMapMouseEvent = {
    latLng?: {
        lat: () => number;
        lng: () => number;
    } | null;
};

export type GoogleInfoWindow = {
    setContent: (content: string) => void;
    setPosition: (position: GoogleLatLng) => void;
    open: (map: GoogleMapInstance) => void;
    close: () => void;
};

export type GoogleOverlay = {
    setMap: (map: GoogleMapInstance | null) => void;
    addListener: (
        eventName: string,
        handler: (event?: GoogleMapMouseEvent) => void,
    ) => void;
};

type GoogleMapOptions = {
    center: GoogleLatLng;
    zoom: number;
    mapTypeId: GoogleMapType;
    disableDefaultUI?: boolean;
    gestureHandling?: 'none' | 'greedy' | 'cooperative' | 'auto';
    keyboardShortcuts?: boolean;
    clickableIcons?: boolean;
    backgroundColor?: string;
    zoomControl?: boolean;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
};

type GoogleShapeOptions = {
    map: GoogleMapInstance;
    path?: GoogleLatLng[];
    paths?: GoogleLatLng[];
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
    clickable?: boolean;
    icons?: Array<{
        icon: {
            path: string;
            strokeOpacity: number;
            strokeColor: string;
            scale: number;
        };
        offset: string;
        repeat: string;
    }>;
};

type GoogleMarkerOptions = {
    map: GoogleMapInstance;
    position: GoogleLatLng;
    clickable?: boolean;
    label?: {
        text: string;
        color?: string;
        fontSize?: string;
        fontWeight?: string;
    };
    icon?: {
        path: number;
        scale: number;
        fillColor: string;
        fillOpacity: number;
        strokeColor: string;
        strokeWeight: number;
    };
};

type GoogleMapsNamespace = {
    Map: new (
        element: HTMLElement,
        options: GoogleMapOptions,
    ) => GoogleMapInstance;
    Polygon: new (options: GoogleShapeOptions) => GoogleOverlay;
    Polyline: new (options: GoogleShapeOptions) => GoogleOverlay;
    Marker: new (options: GoogleMarkerOptions) => GoogleOverlay;
    InfoWindow: new (options?: {
        maxWidth?: number;
        disableAutoPan?: boolean;
    }) => GoogleInfoWindow;
    LatLngBounds: new () => GoogleLatLngBounds;
    SymbolPath: { CIRCLE: number };
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
    if (window.google?.maps?.Map) {
        return Promise.resolve();
    }

    if (window.google?.maps?.importLibrary) {
        return window.google.maps.importLibrary('maps').then(() => undefined);
    }

    if (loading === null) {
        loading = new Promise((resolve, reject) => {
            const callbackName = '__surefarmGoogleMapsReady';
            const windowWithCallback = window as unknown as Record<string, () => void>;

            windowWithCallback[callbackName] = () => {
                delete windowWithCallback[callbackName];
                const maps = window.google?.maps;

                if (!maps?.importLibrary) {
                    resolve();

                    return;
                }

                maps
                    .importLibrary('maps')
                    .then(() => resolve())
                    .catch((error: unknown) => {
                        loading = null;
                        reject(error);
                    });
            };

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=${callbackName}`;
            script.async = true;
            script.onerror = () => {
                delete windowWithCallback[callbackName];
                loading = null;
                reject(new Error('Google Maps could not be loaded.'));
            };
            document.head.appendChild(script);
        });
    }

    return loading;
}
