import { useEffect, useRef, type RefObject } from 'react';
import { useMap } from 'react-leaflet';
import {
    loadGoogleMaps,
    type GoogleMapInstance,
    type GoogleMapType,
} from '@/lib/google-maps';

export function GoogleBasemap({
    host,
    apiKey,
    mapType,
    onReady,
    onError,
}: {
    host: RefObject<HTMLDivElement | null>;
    apiKey: string;
    mapType: GoogleMapType;
    onReady: () => void;
    onError: () => void;
}) {
    const leafletMap = useMap();
    const googleMap = useRef<GoogleMapInstance | null>(null);
    const mapTypeRef = useRef(mapType);
    mapTypeRef.current = mapType;

    useEffect(() => {
        const element = host.current;

        if (element === null || apiKey === '') {
            return;
        }

        let cancelled = false;
        let detach = () => {};

        loadGoogleMaps(apiKey)
            .then(() => {
                if (cancelled || !window.google?.maps) {
                    return;
                }

                const center = leafletMap.getCenter();
                const instance = new window.google.maps.Map(element, {
                    center: { lat: center.lat, lng: center.lng },
                    zoom: leafletMap.getZoom(),
                    mapTypeId: mapTypeRef.current,
                    disableDefaultUI: true,
                    gestureHandling: 'none',
                    keyboardShortcuts: false,
                    clickableIcons: false,
                    backgroundColor: '#e7eee8',
                });
                googleMap.current = instance;

                const sync = () => {
                    const next = leafletMap.getCenter();
                    instance.setCenter({ lat: next.lat, lng: next.lng });
                    instance.setZoom(leafletMap.getZoom());
                };

                leafletMap.on('move', sync);
                leafletMap.on('zoom', sync);
                sync();
                onReady();

                const observer = new ResizeObserver(() => {
                    window.google?.maps.event.trigger(instance, 'resize');
                    sync();
                });
                observer.observe(element);

                detach = () => {
                    leafletMap.off('move', sync);
                    leafletMap.off('zoom', sync);
                    observer.disconnect();
                };
            })
            .catch(() => {
                if (!cancelled) {
                    onError();
                }
            });

        return () => {
            cancelled = true;
            detach();
            googleMap.current = null;
        };
    }, [apiKey, host, leafletMap, onError, onReady]);

    useEffect(() => {
        googleMap.current?.setMapTypeId(mapType);
    }, [mapType]);

    return null;
}
