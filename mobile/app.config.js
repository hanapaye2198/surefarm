module.exports = ({ config }) => {
    const mapsApiKey =
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
        process.env.VITE_GOOGLE_MAPS_API_KEY;
    const plugins = [...(config.plugins ?? [])];

    if (mapsApiKey) {
        plugins.push([
            'react-native-maps',
            {
                androidGoogleMapsApiKey: mapsApiKey,
                iosGoogleMapsApiKey: mapsApiKey,
            },
        ]);
    }

    return { ...config, plugins };
};
