import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    Linking,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { ApiError, apiRequest, API_URL, SITE_URL } from './src/api';
import {
    formForPage,
    initialFieldValues,
    optionList,
    type FieldSpec,
    type FormSpec,
} from './src/forms';

type Role = 'admin' | 'operations' | 'field_verifier' | 'farmer';
type User = { id: number; name: string; email: string; role: Role; farmer_profile_linked?: boolean };
type Page = { component: string; data: Record<string, any> };
type Screen = { path: string; title: string };
const ICONS = {
    dashboard: 'M3 3h8v8H3z M14 3h7v5h-7z M14 10h7v11h-7z M3 14h8v7H3z',
    farmers:
        'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    farms: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z M12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
    verification: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11 M9 12l2 2 4-4',
    activities: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    production:
        'M12 22v-9 M12 13c-4 0-7-2.5-7-7 4.5 0 7 2.5 7 7 M12 13c0-4.5 2.5-7 7-7 0 4.5-2.5 7-7 7',
    harvest:
        'M12 22V2 M5 6c4 0 7 2 7 6 M19 6c-4 0-7 2-7 6 M4 12c4 0 8 2 8 6 M20 12c-4 0-8 2-8 6',
    inventory: 'm12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5',
    processing:
        'M2 20h20 M4 20V11l5 3v-3l5 3V7l6 3v10 M7 7h.01 M7 4h.01 M17 14h.01 M17 17h.01',
    traceability:
        'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h-2z M19 15h2v6h-2z M15 19h2v2h-2z',
    cooperatives:
        'M3 21h18 M5 21V7l7-4 7 4v14 M9 9h.01 M15 9h.01 M9 13h.01 M15 13h.01 M10 21v-4h4v4',
    cropManagement:
        'M20 4c-9 0-15 5-15 12a4 4 0 0 0 4 4c7 0 12-6 11-16Z M5 20c4-5 7-7 12-10',
    finance:
        'M12 8c-2.5 0-4 1.2-4 3s1.5 3 4 3 4 1.2 4 3-1.5 3-4 3m0-14v2m0 10v2 M6 10a6 6 0 1 1 0 4',
    insurance: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11',
    logistics:
        'M3 7h11v10H3z M14 11h4l3 3v3h-7z M7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M18 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
    reports: 'M3 3v18h18 M7 14v3 M12 10v7 M17 6v11',
    activityTypes:
        'M9 6h12 M9 12h12 M9 18h12 M3 6l1 1 2-2 M3 12l1 1 2-2 M3 18l1 1 2-2',
    home: 'm3 10 9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7',
    features: 'M3 3h8v8H3z M14 3h7v5h-7z M14 10h7v11h-7z M3 14h8v7H3z',
    account: 'M20 21a8 8 0 0 0-16 0 M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    arrowRight: 'M5 12h14 M12 5l7 7-7 7',
    chevronRight: 'm9 18 6-6-6-6',
    empty: 'M9 3h6l2 2h3v16H4V5h3l2-2Z M9 11h6 M9 15h6 M9 19h6',
    pending: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2',
    inProgress: 'M12 3a9 9 0 1 0 9 9 M12 7v5l3 2',
    failed: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M15 9l-6 6 M9 9l6 6',
    needsReview: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 8v4 M12 16h.01',
    verified: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11 M9 12l2 2 4-4',
    back: 'm15 18-6-6 6-6 M20 12H9 M9 12l3-3 M9 12l3 3',
    signOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
    search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M21 21l-4.35-4.35',
    leaf: 'M20 4c-9 0-15 5-15 12a4 4 0 0 0 4 4c7 0 12-6 11-16Z M5 20c4-5 7-7 12-10',
    location: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z M12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
    calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01',
    shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11 M9 12l2 2 4-4',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 11v5 M12 8h.01',
    lock: 'M5 11h14v10H5z M8 11V7a4 4 0 1 1 8 0v4',
} as const;
type IconName = keyof typeof ICONS;
type Section = {
    key: string;
    title: string;
    description: string;
    path: string;
    icon: IconName;
    roles?: Role[];
};

const TOKEN_KEY = 'surefarm.mobile.access-token';
const LOGO_URL = `${SITE_URL}/surefarm-logo.png`;

const getStoredToken = async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
        return typeof window === 'undefined'
            ? null
            : window.localStorage.getItem(TOKEN_KEY);
    }

    return SecureStore.getItemAsync(TOKEN_KEY);
};

const storeToken = async (token: string): Promise<void> => {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined')
            window.localStorage.setItem(TOKEN_KEY, token);
        return;
    }

    await SecureStore.setItemAsync(TOKEN_KEY, token);
};

const removeStoredToken = async (): Promise<void> => {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined')
            window.localStorage.removeItem(TOKEN_KEY);
        return;
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
};

const API_FOREST = '#254d3a';
const GREEN = '#4b8a68';
const CANVAS = '#f5f7f4';
const INK = '#1f3027';
const MUTED = '#748178';

function AppIcon({
    name,
    size = 20,
    color = API_FOREST,
    strokeWidth = 2,
}: {
    name: IconName;
    size?: number;
    color?: string;
    strokeWidth?: number;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d={ICONS[name]}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

const SECTIONS: Section[] = [
    {
        key: 'dashboard',
        title: 'Dashboard',
        description: 'Farm program overview and recent activity',
        path: '/dashboard',
        icon: 'dashboard',
    },
    {
        key: 'farmers',
        title: 'Farmers',
        description: 'Farmer registry and farm portfolios',
        path: '/farmers',
        roles: ['operations', 'field_verifier'],
        icon: 'farmers',
    },
    {
        key: 'farmer-farms',
        title: 'My farms',
        description: 'Farm status, GPS area, and verification progress',
        path: '/farmer/farms',
        roles: ['farmer'],
        icon: 'farms',
    },
    {
        key: 'farmer-activities',
        title: 'Activities & harvest',
        description: 'Recent farm work and harvest records',
        path: '/farmer/activities',
        roles: ['farmer'],
        icon: 'activities',
    },
    {
        key: 'farmer-notifications',
        title: 'Notifications',
        description: 'Updates about your farm verification',
        path: '/farmer/notifications',
        roles: ['farmer'],
        icon: 'pending',
    },
    {
        key: 'farmer-profile',
        title: 'My profile',
        description: 'Your registered farmer information',
        path: '/farmer/profile',
        roles: ['farmer'],
        icon: 'account',
    },
    {
        key: 'farms',
        title: 'Farms & map',
        description: 'Farm records, coordinates, and boundaries',
        path: '/farms',
        roles: ['operations', 'field_verifier'],
        icon: 'farms',
    },
    {
        key: 'farm-verification',
        title: 'Farm verification',
        description: 'Review and record field results',
        path: '/farm-verification',
        roles: ['field_verifier'],
        icon: 'verification',
    },
    {
        key: 'farm-activities',
        title: 'Farm activities',
        description: 'Field work, costs, and history',
        path: '/farm-activities',
        roles: ['operations', 'field_verifier'],
        icon: 'activities',
    },
    {
        key: 'production',
        title: 'Production',
        description: 'Expected output and production periods',
        path: '/production',
        roles: ['operations', 'field_verifier'],
        icon: 'production',
    },
    {
        key: 'harvest',
        title: 'Harvest',
        description: 'Actual harvest records and receiving',
        path: '/harvest',
        roles: ['operations', 'field_verifier'],
        icon: 'harvest',
    },
    {
        key: 'inventory',
        title: 'Inventory',
        description: 'Coffee stock and inventory movements',
        path: '/inventory',
        roles: ['operations', 'field_verifier'],
        icon: 'inventory',
    },
    {
        key: 'processing',
        title: 'Coffee processing',
        description: 'Processing stages and movements',
        path: '/inventory/processing',
        roles: ['operations', 'field_verifier'],
        icon: 'processing',
    },
    {
        key: 'traceability',
        title: 'Traceability',
        description: 'Coffee lots and journey history',
        path: '/traceability',
        roles: ['operations', 'field_verifier'],
        icon: 'traceability',
    },
    {
        key: 'cooperatives',
        title: 'Cooperatives',
        description: 'Cooperative directory',
        path: '/modules/cooperatives',
        icon: 'cooperatives',
    },
    {
        key: 'crop-management',
        title: 'Crop management',
        description: 'Crop program workspace',
        path: '/modules/crop-management',
        icon: 'cropManagement',
    },
    {
        key: 'finance',
        title: 'Finance',
        description: 'Farm financing workspace',
        path: '/modules/finance',
        icon: 'finance',
    },
    {
        key: 'insurance',
        title: 'Insurance',
        description: 'Farm insurance workspace',
        path: '/modules/insurance',
        icon: 'insurance',
    },
    {
        key: 'logistics-export',
        title: 'Logistics & export',
        description: 'Logistics workspace',
        path: '/modules/logistics-export',
        icon: 'logistics',
    },
    {
        key: 'reports',
        title: 'Reports',
        description: 'Program reporting workspace',
        path: '/modules/reports',
        icon: 'reports',
    },
    {
        key: 'activity-types',
        title: 'Activity types',
        description: 'Configure farm activities',
        path: '/settings/activity-types',
        roles: ['admin'],
        icon: 'activityTypes',
    },
];

const ROLE_LABEL: Record<Role, string> = {
    admin: 'Administrator',
    operations: 'Operations',
    field_verifier: 'Farm validator',
    farmer: 'Farmer',
};
const COLLECTION: Record<string, string> = {
    'farmers/index': 'farmers',
    'farms/index': 'farms',
    'farm-verification/index': 'farms',
    'farm-activities/index': 'activities',
    'production/index': 'productions',
    'harvest/index': 'harvests',
    'inventory/index': 'inventories',
    'inventory/processing': 'movements',
    'traceability/index': 'lots',
    'activity-types/index': 'activityTypes',
};
const COLLECTION_FILTERS: Record<
    string,
    { key: string; label: string; source: string }[]
> = {
    'farms/index': [
        { key: 'verification_status', label: 'Verification', source: 'verificationStatuses' },
        { key: 'status', label: 'Farm status', source: 'statuses' },
    ],
    'farm-verification/index': [
        { key: 'verification_status', label: 'Verification', source: 'verificationStatuses' },
        { key: 'crop', label: 'Crop', source: 'crops' },
        { key: 'province', label: 'Province', source: 'provinces' },
        { key: 'municipality', label: 'Municipality', source: 'municipalities' },
    ],
    'farm-activities/index': [
        { key: 'farm', label: 'Farm', source: 'farms' },
        { key: 'farmer', label: 'Farmer', source: 'farmers' },
        { key: 'crop', label: 'Crop', source: 'crops' },
        { key: 'activity_type', label: 'Activity', source: 'activityTypes' },
        { key: 'status', label: 'Status', source: 'statuses' },
    ],
    'production/index': [
        { key: 'farm', label: 'Farm', source: 'farms' },
        { key: 'farmer', label: 'Farmer', source: 'farmers' },
        { key: 'crop', label: 'Crop', source: 'crops' },
        { key: 'period', label: 'Period', source: 'periods' },
        { key: 'status', label: 'Status', source: 'statuses' },
    ],
    'harvest/index': [
        { key: 'farm', label: 'Farm', source: 'farms' },
        { key: 'farmer', label: 'Farmer', source: 'farmers' },
        { key: 'crop', label: 'Crop', source: 'crops' },
        { key: 'status', label: 'Status', source: 'statuses' },
    ],
    'inventory/index': [
        { key: 'farmer', label: 'Farmer', source: 'farmers' },
        { key: 'farm', label: 'Farm', source: 'farms' },
        { key: 'stage', label: 'Stage', source: 'stages' },
        { key: 'status', label: 'Status', source: 'statuses' },
    ],
    'traceability/index': [
        { key: 'stage', label: 'Stage', source: 'stages' },
        { key: 'crop', label: 'Crop', source: 'crops' },
        { key: 'status', label: 'Status', source: 'statuses' },
    ],
};
const TITLES: Record<string, string> = {
    dashboard: 'Dashboard',
    'farmers/index': 'Farmers',
    'farmers/show': 'Farmer details',
    'farmers/create': 'Register farmer',
    'farmers/edit': 'Edit farmer',
    'farms/index': 'Farms & map',
    'farms/show': 'Farm details',
    'farms/create': 'Add farm',
    'farms/edit': 'Edit farm',
    'farm-verification/index': 'Farm verification',
    'farm-verification/show': 'Verification record',
    'farm-activities/index': 'Farm activities',
    'farm-activities/show': 'Activity details',
    'farm-activities/create': 'Record activity',
    'farm-activities/edit': 'Edit activity',
    'production/index': 'Production',
    'production/show': 'Production details',
    'production/create': 'Record production',
    'production/edit': 'Edit production',
    'harvest/index': 'Harvest',
    'harvest/show': 'Harvest details',
    'harvest/create': 'Record harvest',
    'harvest/edit': 'Edit harvest',
    'inventory/index': 'Inventory',
    'inventory/show': 'Inventory details',
    'inventory/processing': 'Coffee processing',
    'inventory/process': 'Process coffee',
    'inventory/receive': 'Receive harvest',
    'inventory/adjust': 'Adjust inventory',
    'inventory/damage': 'Record damage',
    'traceability/index': 'Traceability',
    'traceability/show': 'Lot journey',
    'traceability/create': 'Create lot',
    'traceability/print': 'Lot record',
    'activity-types/index': 'Activity types',
    'activity-types/edit': 'Edit activity type',
    'farm-insurance/create': 'Add farm insurance',
    'farm-insurance/edit': 'Edit farm insurance',
    'farm-financing/create': 'Add farm financing',
    'farm-financing/edit': 'Edit farm financing',
    'settings/profile': 'Profile settings',
    'settings/security': 'Security settings',
    'modules/placeholder': 'SureFarm workspace',
};

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor={API_FOREST} />
            <SureFarmApp />
        </SafeAreaProvider>
    );
}

function SureFarmApp() {
    const [checking, setChecking] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [challenge, setChallenge] = useState<string | null>(null);
    const [recoveryMode, setRecoveryMode] = useState(false);
    const [authError, setAuthError] = useState('');
    const [busy, setBusy] = useState(false);
    const [stack, setStack] = useState<Screen[]>([
        { path: '/dashboard', title: 'Dashboard' },
    ]);
    const [panel, setPanel] = useState<'page' | 'features'>('page');
    const [page, setPage] = useState<Page | null>(null);
    const [pageLoading, setPageLoading] = useState(false);
    const [pageError, setPageError] = useState('');
    const [values, setValues] = useState<Record<string, any>>({});
    const [photos, setPhotos] = useState<
        Record<string, ImagePicker.ImagePickerAsset>
    >({});
    const [formError, setFormError] = useState('');
    const [search, setSearch] = useState('');

    const current = stack[stack.length - 1];
    const sections = useMemo(
        () =>
            SECTIONS.filter(
                (item) => {
                    if (user?.role === 'farmer')
                        return item.key === 'dashboard' || (user.farmer_profile_linked === true && item.roles?.includes('farmer') === true);
                    if (user?.role === 'field_verifier')
                        return ['dashboard', 'farm-verification'].includes(item.key);
                    return (
                        !item.roles ||
                        user?.role === 'admin' ||
                        (user && item.roles.includes(user.role))
                    );
                },
            ),
        [user?.role],
    );
    const isOperations = user?.role === 'admin' || user?.role === 'operations';

    const loadPage = useCallback(
        async (path: string, activeToken = token) => {
            if (!activeToken) return;
            setPageLoading(true);
            setPageError('');
            try {
                const result = await apiRequest<Page>(path, activeToken);
                setPage(result);
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                    await removeStoredToken().catch(() => undefined);
                    setToken(null);
                    setUser(null);
                } else {
                    setPageError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load this page.',
                    );
                }
            } finally {
                setPageLoading(false);
            }
        },
        [token],
    );

    useEffect(() => {
        let mounted = true;
        void (async () => {
            const saved = await getStoredToken().catch(() => null);
            if (!mounted) return;
            if (!saved) {
                setChecking(false);
                return;
            }
            try {
                const result = await apiRequest<{ user: User }>('/me', saved);
                if (!mounted) return;
                setToken(saved);
                setUser(result.user);
                await loadPage('/dashboard', saved);
            } catch (error) {
                if (
                    error instanceof ApiError &&
                    (error.status === 401 || error.status === 403)
                ) {
                    await removeStoredToken().catch(() => undefined);
                } else if (mounted) {
                    setAuthError(
                        error instanceof Error
                            ? error.message
                            : 'Could not reconnect to SureFarm.',
                    );
                }
            } finally {
                if (mounted) setChecking(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!page) return;
        const spec = formForPage(page.component, page.data);
        if (spec) {
            setValues(
                initialFieldValues(page.component, page.data, spec.fields),
            );
            setPhotos({});
            setFormError('');
        }
    }, [page]);

    const finishSignIn = async (accessToken: string, account: User) => {
        await storeToken(accessToken);
        setToken(accessToken);
        setUser(account);
        setChallenge(null);
        setAuthCode('');
        setPassword('');
        setStack([{ path: '/dashboard', title: 'Dashboard' }]);
        await loadPage('/dashboard', accessToken);
    };

    const signIn = async () => {
        setBusy(true);
        setAuthError('');
        try {
            if (challenge) {
                const result = await apiRequest<{
                    access_token: string;
                    user: User;
                }>('/two-factor', null, {
                    method: 'POST',
                    body: {
                        challenge_token: challenge,
                        ...(recoveryMode
                            ? { recovery_code: authCode }
                            : { code: authCode }),
                    },
                });
                await finishSignIn(result.access_token, result.user);
            } else {
                const result = await apiRequest<any>('/login', null, {
                    method: 'POST',
                    body: {
                        email: email.trim(),
                        password,
                        device_name:
                            Platform.OS === 'web'
                                ? 'SureFarm Web'
                                : Platform.OS === 'ios'
                                  ? 'SureFarm iOS'
                                  : 'SureFarm Android',
                    },
                });
                if (result.two_factor_required) {
                    setChallenge(result.challenge_token);
                    setAuthError('Enter the code from your authenticator app.');
                } else if (result.access_token && result.user)
                    await finishSignIn(result.access_token, result.user);
                else
                    setAuthError(
                        result.message ?? 'Sign-in could not be completed.',
                    );
            }
        } catch (error) {
            setAuthError(
                error instanceof Error
                    ? error.message
                    : 'Sign-in failed. Try again.',
            );
        } finally {
            setBusy(false);
        }
    };

    const signOut = async () => {
        if (token)
            await apiRequest('/logout', token, { method: 'DELETE' }).catch(
                () => undefined,
            );
        await removeStoredToken().catch(() => undefined);
        setToken(null);
        setUser(null);
        setPage(null);
        setChallenge(null);
    };

    const navigate = async (path: string, title = titleFor(path)) => {
        setStack((previous) => [...previous, { path, title }]);
        setPanel('page');
        if (!path.includes('search=')) setSearch('');
        setPage(null);
        await loadPage(path);
    };

    const openLocalForm = (component: string, data: Record<string, any>) => {
        const spec = formForPage(component, data);
        if (!spec) return;
        setStack((previous) => [
            ...previous,
            { path: `local:${component}`, title: spec.title },
        ]);
        setPage({ component, data });
        setPanel('page');
    };

    const back = async () => {
        if (stack.length < 2) {
            setPanel('features');
            return;
        }
        const previous = stack.slice(0, -1);
        setStack(previous);
        const path = previous[previous.length - 1].path;
        setSearch(new URLSearchParams(path.split('?')[1] ?? '').get('search') ?? '');
        if (!path.startsWith('local:')) await loadPage(path);
    };

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (panel === 'features') {
                    setPanel('page');
                    return true;
                }

                if (stack.length > 1) {
                    void back();
                    return true;
                }

                return false;
            },
        );

        return () => subscription.remove();
    }, [panel, stack, back]);

    const submitForm = async (spec: FormSpec) => {
        if (!token) return;
        setBusy(true);
        setFormError('');
        try {
            let body: Record<string, unknown> | FormData;
            if (Object.keys(photos).length) {
                const form = new FormData();
                if (spec.method !== 'POST') form.append('_method', spec.method);
                for (const [key, value] of Object.entries(values)) {
                    const field = spec.fields.find(
                        (entry) => entry.key === key,
                    );
                    if (field?.kind === 'image') continue;
                    if (
                        field?.kind === 'geojson' &&
                        typeof value === 'string' &&
                        value.trim()
                    )
                        form.append(key, value);
                    else if (typeof value === 'boolean')
                        form.append(key, value ? '1' : '0');
                    else if (value !== null && value !== undefined)
                        form.append(key.replace(/_input$/, ''), String(value));
                }
                for (const [key, asset] of Object.entries(photos))
                    form.append(key, {
                        uri: asset.uri,
                        name: asset.fileName ?? `${key}.jpg`,
                        type: asset.mimeType ?? 'image/jpeg',
                    } as unknown as Blob);
                body = form;
            } else {
                body = Object.fromEntries(
                    Object.entries(values).map(([key, value]) => [
                        key.replace(/_input$/, ''),
                        typeof value === 'boolean' ? Number(value) : value,
                    ]),
                );
                for (const field of spec.fields.filter(
                    (item) => item.kind === 'geojson',
                )) {
                    const raw = values[field.key];
                    if (typeof raw === 'string' && raw.trim())
                        (body as Record<string, unknown>)[field.key] =
                            JSON.parse(raw);
                }
            }
            const requestMethod =
                body instanceof FormData ? 'POST' : spec.method;
            await apiRequest(spec.path, token, { method: requestMethod, body });
            const nextStack =
                stack.length > 1
                    ? stack.slice(0, -1)
                    : [{ path: '/dashboard', title: 'Dashboard' }];
            setStack(nextStack);
            await loadPage(nextStack[nextStack.length - 1].path);
            Alert.alert('Saved', 'Your changes have been saved.');
        } catch (error) {
            setFormError(
                error instanceof SyntaxError
                    ? 'Enter valid GeoJSON for the farm boundary.'
                    : error instanceof Error
                      ? error.message
                      : 'Could not save changes.',
            );
        } finally {
            setBusy(false);
        }
    };

    const chooseImage = async (field: string, camera: boolean) => {
        const permission = camera
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            setFormError(
                camera
                    ? 'Allow camera access to take a photo.'
                    : 'Allow photo access to choose an image.',
            );
            return;
        }
        const result = camera
            ? await ImagePicker.launchCameraAsync({
                  mediaTypes: ['images'],
                  quality: 0.8,
              })
            : await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  quality: 0.8,
              });
        if (!result.canceled && result.assets[0])
            setPhotos((old) => ({ ...old, [field]: result.assets[0] }));
    };

    const startVerification = async (farmId: number) => {
        if (!token) return;
        setBusy(true);
        try {
            await apiRequest(`/farm-verification/${farmId}`, token, {
                method: 'POST',
                body: {},
            });
            await loadPage(current.path);
            Alert.alert(
                'Verification started',
                'The farm is now marked in progress.',
            );
        } catch (error) {
            Alert.alert(
                'Could not start verification',
                error instanceof Error ? error.message : 'Try again.',
            );
        } finally {
            setBusy(false);
        }
    };

    const removeBoundary = (farmId: number) =>
        Alert.alert(
            'Remove farm boundary?',
            'This removes the saved GPS polygon for this farm.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () =>
                        void (async () => {
                            if (!token) return;
                            setBusy(true);
                            try {
                                await apiRequest(
                                    `/farms/${farmId}/boundary`,
                                    token,
                                    { method: 'DELETE' },
                                );
                                await loadPage(current.path);
                                Alert.alert(
                                    'Boundary removed',
                                    'The saved farm boundary has been removed.',
                                );
                            } catch (error) {
                                Alert.alert(
                                    'Could not remove boundary',
                                    error instanceof Error
                                        ? error.message
                                        : 'Try again.',
                                );
                            } finally {
                                setBusy(false);
                            }
                        })(),
                },
            ],
        );

    if (checking)
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color={GREEN} />
            </SafeAreaView>
        );
    if (!token || !user)
        return (
            <LoginScreen
                email={email}
                password={password}
                code={authCode}
                challenge={Boolean(challenge)}
                recovery={recoveryMode}
                error={authError}
                busy={busy}
                onEmail={setEmail}
                onPassword={setPassword}
                onCode={setAuthCode}
                onToggleRecovery={() => setRecoveryMode((value) => !value)}
                onCancel={() => {
                    setChallenge(null);
                    setAuthError('');
                }}
                onSubmit={() => void signIn()}
            />
        );

    const spec = page ? formForPage(page.component, page.data) : null;
    const title =
        current.title || (page && TITLES[page.component]) || 'SureFarm';

    return (
        <SafeAreaView
            style={styles.root}
            edges={['top', 'left', 'right', 'bottom']}
        >
            <View style={styles.header}>
                <Pressable
                    style={[styles.backButton, stack.length === 1 && styles.brandButton]}
                    onPress={() => void back()}
                >
                    {stack.length > 1 ? (
                        <AppIcon name="back" size={22} color={API_FOREST} />
                    ) : (
                        <Image
                            source={{ uri: LOGO_URL }}
                            style={styles.headerLogo}
                            resizeMode="contain"
                            accessibilityLabel="SureFarm logo"
                        />
                    )}
                </Pressable>
                <View style={styles.headerCopy}>
                    <Text numberOfLines={1} style={styles.headerTitle}>
                        {panel === 'features' ? 'Features' : title}
                    </Text>
                    <Text style={styles.headerSub}>
                        {user.name} · {ROLE_LABEL[user.role]}
                    </Text>
                </View>
                <Pressable
                    onPress={() => void signOut()}
                    style={styles.signOut}
                >
                    <AppIcon name="signOut" size={18} color={API_FOREST} />
                </Pressable>
            </View>

            {panel === 'features' ? (
                <FeatureList
                    sections={sections}
                    onOpen={(item) => void navigate(item.path, item.title)}
                />
            ) : pageLoading && !page ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={GREEN} />
                    <Text style={styles.muted}>Loading your workspace…</Text>
                </View>
            ) : pageError ? (
                <View style={styles.center}>
                    <Text style={styles.heading}>Could not load this page</Text>
                    <Text style={styles.muted}>{pageError}</Text>
                    <Primary
                        title="Try again"
                        onPress={() => void loadPage(current.path)}
                    />
                </View>
            ) : spec && page ? (
                <FormView
                    key={current.path}
                    spec={spec}
                    data={page.data}
                    values={values}
                    photos={photos}
                    error={formError}
                    busy={busy}
                    onChange={(key, value) =>
                        setValues((old) => ({
                            ...old,
                            [key]: value,
                            ...(key === 'inventory_id'
                                ? { destination_stage_id: '' }
                                : {}),
                        }))
                    }
                    onImage={(key, camera) => void chooseImage(key, camera)}
                    onOpen={(path, title) => void navigate(path, title)}
                    onSubmit={() => void submitForm(spec)}
                />
            ) : page?.component === 'dashboard' ? (
                <Dashboard
                    page={page}
                    user={user}
                    sections={sections}
                    onOpen={(item) => void navigate(item.path, item.title)}
                />
            ) : page ? (
                <DataPage
                    page={page}
                    path={current.path}
                    user={user}
                    isOperations={isOperations}
                    token={token}
                    search={search}
                    onSearch={setSearch}
                    onOpen={(path, title) => void navigate(path, title)}
                    onLocalForm={openLocalForm}
                    onStartVerification={(id) => void startVerification(id)}
                    onDeleteBoundary={removeBoundary}
                    onLoadMore={(path, title) => void navigate(path, title)}
                    busy={busy || pageLoading}
                />
            ) : (
                <FeatureList
                    sections={sections}
                    onOpen={(item) => void navigate(item.path, item.title)}
                />
            )}

            <View style={styles.bottomBar}>
                <BottomItem
                    label="Home"
                    active={panel === 'page' && current.path === '/dashboard'}
                    icon="home"
                    onPress={() => {
                        setPanel('page');
                        setStack([{ path: '/dashboard', title: 'Dashboard' }]);
                        void loadPage('/dashboard');
                    }}
                />
                {user.role === 'farmer' && user.farmer_profile_linked ? (
                    <BottomItem
                        label="My farms"
                        active={
                            panel === 'page' &&
                            current.path === '/farmer/farms'
                        }
                        icon="farms"
                        onPress={() =>
                            void navigate('/farmer/farms', 'My farms')
                        }
                    />
                ) : user.role === 'farmer' ? (
                    <BottomItem
                        label="Security"
                        active={panel === 'page' && current.path === '/settings/security'}
                        icon="lock"
                        onPress={() => void navigate('/settings/security', 'Security settings')}
                    />
                ) : (
                    <BottomItem
                        label="Features"
                        active={panel === 'features'}
                        icon="features"
                        onPress={() => setPanel('features')}
                    />
                )}
                <BottomItem
                    label="Account"
                    active={
                        panel === 'page' &&
                        current.path.startsWith('/settings/')
                    }
                    icon="account"
                    onPress={() =>
                        void navigate('/settings/profile', 'Profile settings')
                    }
                />
            </View>
        </SafeAreaView>
    );
}

function LoginScreen(props: {
    email: string;
    password: string;
    code: string;
    challenge: boolean;
    recovery: boolean;
    busy: boolean;
    error: string;
    onEmail: (s: string) => void;
    onPassword: (s: string) => void;
    onCode: (s: string) => void;
    onToggleRecovery: () => void;
    onCancel: () => void;
    onSubmit: () => void;
}) {
    return (
        <SafeAreaView style={styles.loginSafe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.loginWrap}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.loginBrand}>
                        <Image
                            source={{ uri: LOGO_URL }}
                            style={styles.loginLogoImage}
                            resizeMode="contain"
                            accessibilityLabel="SureFarm logo"
                        />
                        <View style={styles.loginBrandCopy}>
                            <Text style={styles.loginTagline}>Coffee farm operations</Text>
                        </View>
                    </View>
                    <View style={styles.loginCard}>
                        <Text style={styles.loginHeading}>
                            {props.challenge
                                ? 'Verify it’s you'
                                : 'Welcome back'}
                        </Text>
                        <Text style={styles.loginHelp}>
                            {props.challenge
                                ? 'Enter your authentication code to continue.'
                                : 'Sign in with your SureFarm account.'}
                        </Text>
                        {!props.challenge ? (
                            <>
                                <Label text="Email" />
                                <TextInput
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    value={props.email}
                                    onChangeText={props.onEmail}
                                    style={styles.input}
                                    placeholder="name@example.com"
                                    placeholderTextColor="#9aa49e"
                                />
                                <Label text="Password" />
                                <TextInput
                                    secureTextEntry
                                    autoComplete="password"
                                    value={props.password}
                                    onChangeText={props.onPassword}
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#9aa49e"
                                />
                            </>
                        ) : (
                            <>
                                <Label
                                    text={
                                        props.recovery
                                            ? 'Recovery code'
                                            : 'Authenticator code'
                                    }
                                />
                                <TextInput
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType={
                                        props.recovery
                                            ? 'default'
                                            : 'number-pad'
                                    }
                                    value={props.code}
                                    onChangeText={props.onCode}
                                    style={styles.input}
                                    placeholder={
                                        props.recovery
                                            ? 'xxxxxxxxxx-xxxxxxxxxx'
                                            : '000000'
                                    }
                                    placeholderTextColor="#9aa49e"
                                />
                                <Pressable
                                    onPress={props.onToggleRecovery}
                                    style={styles.link}
                                >
                                    <Text style={styles.linkText}>
                                        {props.recovery
                                            ? 'Use authenticator code'
                                            : 'Use a recovery code'}
                                    </Text>
                                </Pressable>
                            </>
                        )}
                        {props.error ? (
                            <Text style={styles.errorText}>{props.error}</Text>
                        ) : null}
                        <Primary
                            title={
                                props.challenge
                                    ? 'Verify and sign in'
                                    : 'Sign in'
                            }
                            onPress={props.onSubmit}
                            busy={props.busy}
                        />
                        {props.challenge && (
                            <Pressable
                                onPress={props.onCancel}
                                style={styles.link}
                            >
                                <Text style={styles.linkText}>
                                    Back to sign in
                                </Text>
                            </Pressable>
                        )}
                    </View>
                    <Text style={styles.loginFoot}>
                        Access follows your SureFarm account role.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function Dashboard({
    page,
    user,
    sections,
    onOpen,
}: {
    page: Page;
    user: User | null;
    sections: Section[];
    onOpen: (item: Section) => void;
}) {
    if (page.data.mobile_dashboard_mode === 'farmer_account_not_linked') {
        return (
            <ScrollView style={styles.page} contentContainerStyle={styles.content}>
                <View style={styles.welcome}>
                    <View style={styles.welcomeOrb} />
                    <Text style={styles.eyebrow}>SUREFARM · FARMER PORTAL</Text>
                    <Text style={styles.welcomeTitle}>
                        Welcome, {user?.name?.split(' ')[0] ?? 'farmer'}
                    </Text>
                    <Text style={styles.welcomeBody}>
                        Your account is signed in. Your farm records will appear
                        here once the SureFarm team links your account to your
                        farmer profile.
                    </Text>
                </View>
                <View style={styles.setupCard}>
                    <View style={styles.setupIcon}>
                        <AppIcon name="farmers" size={22} color={GREEN} />
                    </View>
                    <Text style={styles.cardTitle}>Finish setting up your farm access</Text>
                    <Text style={styles.muted}>
                        To protect farmer records, the app only shows farms
                        assigned to your account. Contact your cooperative or
                        SureFarm administrator and ask them to link this login
                        to your farmer record.
                    </Text>
                    <View style={styles.accountInfo}>
                        <AppIcon name="account" size={16} color={GREEN} />
                        <Text style={styles.accountInfoText}>
                            {page.data.account?.email ?? user?.email}
                        </Text>
                    </View>
                    <View style={styles.setupNote}>
                        <AppIcon name="lock" size={15} color={API_FOREST} />
                        <Text style={styles.setupNoteText}>
                            Your sign-in is active. No other farmer’s information
                            is shown on this screen.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        );
    }

    if (page.data.mobile_dashboard_mode === 'farmer_dashboard') {
        const summary = page.data.summary ?? {};
        const farmsSection = sections.find((section) => section.key === 'farmer-farms');
        const activitySection = sections.find((section) => section.key === 'farmer-activities');

        return (
            <ScrollView style={styles.page} contentContainerStyle={styles.content}>
                <View style={styles.welcome}>
                    <Text style={styles.eyebrow}>SUREFARM · FARMER PORTAL</Text>
                    <Text style={styles.welcomeTitle}>Hello, {(page.data.farmer?.name ?? user?.name)?.split(' ')[0] ?? 'farmer'}</Text>
                    <Text style={styles.welcomeBody}>Your farms and verification updates, in one place.</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Farm verification</Text>
                    <SummaryRow label="My farms" value={summary.registered_farms ?? 0} />
                    <SummaryRow label="Pending" value={summary.pending_verification ?? 0} />
                    <SummaryRow label="In progress" value={summary.in_progress ?? 0} />
                    <SummaryRow label="Verified" value={summary.verified_farms ?? 0} />
                    <SummaryRow label="Needs review" value={summary.needs_review ?? 0} />
                </View>
                {farmsSection && <Primary title="View my farms" onPress={() => onOpen(farmsSection)} />}
                {activitySection && <Secondary title="Activities & harvest" onPress={() => onOpen(activitySection)} />}
            </ScrollView>
        );
    }

    const summary = page.data.summary ?? {};
    const operationsStats: { icon: IconName; label: string; value: string | number }[] = [
        {
            icon: 'farmers',
            label: 'Farmers',
            value: summary.registered_farmers ?? 0,
        },
        { icon: 'farms', label: 'Farms', value: summary.registered_farms ?? 0 },
        {
            icon: 'pending',
            label: 'Pending',
            value: summary.pending_verification ?? 0,
        },
        {
            icon: 'inProgress',
            label: 'In progress',
            value: summary.in_progress ?? 0,
        },
        {
            icon: 'verified',
            label: 'Verified',
            value: summary.verified_farms ?? 0,
        },
        {
            icon: 'needsReview',
            label: 'Needs review',
            value: summary.needs_review ?? 0,
        },
        {
            icon: 'failed',
            label: 'Failed',
            value: summary.failed ?? 0,
        },
    ];
    const verifierStats: { icon: IconName; label: string; value: string | number }[] = [
        { icon: 'pending', label: 'Pending', value: summary.pending_verification ?? 0 },
        { icon: 'inProgress', label: 'In progress', value: summary.in_progress ?? 0 },
        { icon: 'verified', label: 'Verified', value: summary.verified_farms ?? 0 },
        { icon: 'needsReview', label: 'Needs review', value: summary.needs_review ?? 0 },
        { icon: 'failed', label: 'Failed', value: summary.failed ?? 0 },
    ];
    const stats = user?.role === 'field_verifier' ? verifierStats : operationsStats;
    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? 'Good morning'
            : hour < 18
              ? 'Good afternoon'
              : 'Good evening';
    const verificationWorkspace = sections.find(
        (section) => section.key === 'farm-verification',
    );
    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <View style={styles.welcome}>
                <View style={styles.welcomeOrb} />
                <View style={styles.welcomeOrbSmall} />
                <Text style={styles.eyebrow}>
                    SUREFARM · {ROLE_LABEL[user?.role ?? 'admin'].toUpperCase()}
                </Text>
                <Text style={styles.welcomeTitle}>
                    {greeting}
                    {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </Text>
                <Text style={styles.welcomeBody}>
                    {user?.role === 'field_verifier'
                        ? 'Review current farm verification records, saved boundaries, and the progress of each farm.'
                        : 'Your live overview of farmer registrations, farm verification, and harvest activity.'}
                </Text>
                {verificationWorkspace && (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => onOpen(verificationWorkspace)}
                        style={({ pressed }) => [
                            styles.heroAction,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text style={styles.heroActionText}>
                            Review farm verification
                        </Text>
                        <AppIcon name="arrowRight" size={17} color={GREEN} />
                    </Pressable>
                )}
            </View>
            <View style={styles.dashboardHeading}>
                <View>
                    <Text style={styles.dashboardTitle}>
                        {user?.role === 'field_verifier'
                            ? 'Farm verification'
                            : 'Program overview'}
                    </Text>
                    <Text style={styles.dashboardDate}>{today}</Text>
                </View>
                <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE API</Text>
                </View>
            </View>
            <View style={styles.stats}>
                {stats.map(({ icon, label, value }) => (
                    <View key={label} style={styles.stat}>
                        <View style={styles.statTop}>
                            <View style={styles.statCode}>
                                <AppIcon name={icon} size={15} color={GREEN} />
                            </View>
                            <Text style={styles.statLabel}>{label}</Text>
                        </View>
                        <Text style={styles.statValue}>{String(value)}</Text>
                    </View>
                ))}
            </View>
            {page.data.area_summary && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Farm area</Text>
                    <SummaryRow
                        label="Declared"
                        value={`${page.data.area_summary.total_declared_hectares} ha`}
                    />
                    <SummaryRow
                        label="Verified"
                        value={`${page.data.area_summary.total_verified_hectares} ha`}
                    />
                    <SummaryRow
                        label="Coffee"
                        value={`${page.data.area_summary.coffee_hectares} ha`}
                    />
                </View>
            )}
            <View style={styles.sectionHeadingRow}>
                <View>
                    <Text style={styles.dashboardTitle}>Workspaces</Text>
                    <Text style={styles.dashboardDate}>
                        Tools for your day-to-day work
                    </Text>
                </View>
                <Text style={styles.sectionHint}>SHORTCUTS</Text>
            </View>
            <View style={styles.quickGrid}>
                {sections
                    .filter((s) => s.key !== 'dashboard')
                    .slice(0, 6)
                    .map((item) => (
                        <Pressable
                            key={item.key}
                            onPress={() => onOpen(item)}
                            style={({ pressed }) => [
                                styles.quickCard,
                                pressed && styles.pressed,
                            ]}
                        >
                            <View style={styles.quickCardTop}>
                                <View style={styles.quickIcon}>
                                    <AppIcon name={item.icon} size={20} />
                                </View>
                                <AppIcon
                                    name="chevronRight"
                                    size={16}
                                    color={GREEN}
                                />
                            </View>
                            <Text style={styles.quickTitle}>{item.title}</Text>
                            <Text style={styles.quickDescription}>
                                {item.description}
                            </Text>
                        </Pressable>
                    ))}
            </View>
            {page.data.recent_activities?.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Recent activities</Text>
                    {page.data.recent_activities
                        .slice(0, 5)
                        .map((item: any) => (
                            <View key={item.id} style={styles.relatedRow}>
                                <Text style={styles.recordTitle}>
                                    {item.activity}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.farm_name} · {item.activity_date}
                                </Text>
                            </View>
                        ))}
                </View>
            )}
            {page.data.recent_harvests?.length > 0 && (
                <RelatedLinks
                    title="Recent harvests"
                    rows={page.data.recent_harvests}
                    pathFor={(row) => `/harvest/${row.id}`}
                    onOpen={(path, title) =>
                        onOpen({
                            key: 'harvest',
                            title,
                            path,
                            icon: 'harvest',
                            description: '',
                        })
                    }
                />
            )}
            {page.data.recent_lots?.length > 0 && (
                <RelatedLinks
                    title="Recent traceability lots"
                    rows={page.data.recent_lots}
                    pathFor={(row) => `/traceability/${row.id}`}
                    onOpen={(path, title) =>
                        onOpen({
                            key: 'traceability',
                            title,
                            path,
                            icon: 'traceability',
                            description: '',
                        })
                    }
                />
            )}
        </ScrollView>
    );
}

function FeatureList({
    sections,
    onOpen,
}: {
    sections: Section[];
    onOpen: (item: Section) => void;
}) {
    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <Text style={styles.muted}>
                Open a SureFarm workspace. Available actions depend on your
                account role.
            </Text>
            <View style={{ gap: 9, marginTop: 14 }}>
                {sections.map((item) => (
                    <Pressable
                        key={item.key}
                        onPress={() => onOpen(item)}
                        style={({ pressed }) => [
                            styles.featureCard,
                            pressed && styles.pressed,
                        ]}
                    >
                        <View style={styles.featureIcon}>
                            <AppIcon name={item.icon} size={20} />
                        </View>
                        <View style={styles.flex}>
                            <Text style={styles.recordTitle}>{item.title}</Text>
                            <Text style={styles.mutedSmall}>
                                {item.description}
                            </Text>
                        </View>
                        <AppIcon
                            name="chevronRight"
                            size={18}
                            color="#97a39a"
                        />
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}

function DataPage(props: {
    page: Page;
    path: string;
    user: User;
    isOperations: boolean;
    token: string;
    search: string;
    onSearch: (s: string) => void;
    onOpen: (path: string, title: string) => void;
    onLocalForm: (component: string, data: Record<string, any>) => void;
    onStartVerification: (id: number) => void;
    onDeleteBoundary: (id: number) => void;
    onLoadMore: (path: string, title: string) => void;
    busy: boolean;
}) {
    const { page } = props;
    const [filterValues, setFilterValues] = useState<Record<string, any>>(
        page.data.filters ?? {},
    );
    useEffect(() => {
        setFilterValues(page.data.filters ?? {});
    }, [page.component, page.data.filters]);
    const collectionName = COLLECTION[page.component];
    const collection = collectionName ? page.data[collectionName] : null;
    const rows: any[] = Array.isArray(collection)
        ? collection
        : Array.isArray(collection?.data)
          ? collection.data
          : [];

    if (page.component === 'mobile/farmer-farms') {
        const farms: any[] = page.data.farms ?? [];
        return (
            <ScrollView style={styles.page} contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>My registered farms</Text>
                    <Text style={styles.mutedSmall}>Declared, GPS measured, and verified area are shown separately.</Text>
                </View>
                {farms.length === 0 ? <EmptyState title="No farms linked yet" message="Your registered farms will appear here." /> : farms.map((farm) => (
                    <Pressable key={farm.id} onPress={() => props.onOpen(`/farmer/farms/${farm.id}`, farm.farm_name)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                        <Text style={styles.recordTitle}>{farm.farm_name}</Text>
                        <Text style={styles.recordCode}>{farm.farm_id} · {farm.crop}</Text>
                        <SummaryRow label="Declared" value={farm.declared_area} />
                        <SummaryRow label="GPS measured" value={farm.measured_area ?? 'Not measured'} />
                        <SummaryRow label="Verified area" value={farm.verified_area ?? 'Not verified'} />
                        <VerificationProgress status={farm.verification_status} />
                        <Text style={styles.mutedSmall}>{farm.location}</Text>
                    </Pressable>
                ))}
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-farm') {
        const farm = page.data.farm ?? {};
        return (
            <ScrollView style={styles.page} contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.recordTitle}>{farm.farm_name}</Text>
                    <Text style={styles.recordCode}>{farm.farm_id} · {farm.crop}</Text>
                    <Text style={styles.muted}>{farm.location}</Text>
                    <VerificationProgress status={farm.verification_status} />
                    <SummaryRow label="Declared area" value={farm.declared_area} />
                    <SummaryRow label="GPS measured area" value={farm.measured_area ?? 'Not measured'} />
                    <SummaryRow label="Verified area" value={farm.verified_area ?? 'Not verified'} />
                </View>
                {page.data.comparison && <View style={styles.card}>
                    <Text style={styles.cardTitle}>Area comparison</Text>
                    <SummaryRow label="Declared" value={page.data.comparison.declared} />
                    <SummaryRow label="Measured" value={page.data.comparison.measured} />
                    <SummaryRow label="Difference" value={page.data.comparison.difference} />
                </View>}
                {page.data.boundary && <BoundaryCard boundary={page.data.boundary} apiKey={page.data.google_maps_api_key} />}
                <Related title="Verification history" rows={page.data.history ?? []} />
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-activities') {
        const activities: any[] = page.data.activities ?? [];
        const harvests: any[] = page.data.harvests ?? [];
        return (
            <ScrollView style={styles.page} contentContainerStyle={styles.content}>
                <Text style={styles.cardTitle}>Farm activities</Text>
                {activities.length ? activities.map((item) => <View key={`activity-${item.id}`} style={styles.card}>
                    <Text style={styles.recordTitle}>{item.activity ?? item.description ?? 'Farm activity'}</Text>
                    <Text style={styles.mutedSmall}>{item.farm_name} · {item.activity_date ?? ''}</Text>
                    <Text style={styles.muted}>{item.status_label ?? item.status}</Text>
                </View>) : <EmptyState title="No activities yet" message="Farm activity records will appear here." />}
                <Text style={[styles.cardTitle, { marginTop: 12 }]}>Harvest</Text>
                {harvests.length ? harvests.map((item) => <View key={`harvest-${item.id}`} style={styles.card}>
                    <Text style={styles.recordTitle}>{item.farm_name}</Text>
                    <SummaryRow label="Harvested" value={item.quantity_label ?? item.quantity} />
                    <Text style={styles.mutedSmall}>{item.harvest_date ?? ''} · {item.status_label ?? item.status}</Text>
                </View>) : <EmptyState title="No harvest records yet" message="Harvest records will appear here." />}
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-notifications') {
        const notifications: any[] = page.data.notifications ?? [];
        return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            {notifications.length ? notifications.map((item) => <Pressable key={item.id} onPress={async () => {
                if (item.read) return;
                await apiRequest(`/farmer/notifications/${item.id}/read`, props.token, { method: 'POST' });
                props.onOpen('/farmer/notifications', 'Notifications');
            }} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <Text style={styles.recordTitle}>{item.title}{item.read ? '' : ' · New'}</Text>
                <Text style={styles.muted}>{item.message}</Text>
                {item.farm_name ? <Text style={styles.mutedSmall}>{item.farm_name} · {item.status ?? ''}</Text> : null}
                <Text style={styles.mutedSmall}>{item.created_at}</Text>
            </Pressable>) : <EmptyState title="No updates yet" message="Verification updates will appear here." />}
        </ScrollView>;
    }

    if (page.component === 'mobile/farmer-profile') {
        const farmer = page.data.farmer ?? {};
        return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Farmer profile</Text>
                <SummaryRow label="Name" value={farmer.name} />
                <SummaryRow label="Farmer ID" value={farmer.farmer_id} />
                <SummaryRow label="Email" value={farmer.email ?? 'Not provided'} />
                <SummaryRow label="Mobile" value={farmer.mobile_number ?? 'Not provided'} />
                <SummaryRow label="Address" value={farmer.address ?? 'Not provided'} />
                <SummaryRow label="Cooperative" value={farmer.cooperative ?? 'Not linked'} />
            </View>
        </ScrollView>;
    }

    if (collectionName) {
        const filterControls = (COLLECTION_FILTERS[page.component] ?? [])
            .map((filter) => ({
                ...filter,
                options: optionList(page.data[filter.source], page.data),
            }))
            .filter((filter) => filter.options.length > 0);
        const applyFilter = (key: string, value: string) => {
            const next = { ...filterValues, [key]: value };
            if (key === 'province') next.municipality = '';
            setFilterValues(next);
            props.onOpen(
                withCollectionQuery(props.path, props.search, next),
                titleFor(props.path),
            );
        };
        const createPaths: Record<string, string> = {
            'farmers/index': '/farmers/create',
            'farm-activities/index': '/farm-activities/create',
            'production/index': '/production/create',
            'harvest/index': '/harvest/create',
            'traceability/index': '/traceability/create',
            'inventory/processing': '/inventory/process/create',
        };
        const createPath = createPaths[page.component];
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.collectionHeader}>
                    <View style={styles.collectionHeaderIcon}>
                        <AppIcon
                            name={collectionIcon(page.component)}
                            size={22}
                            color={API_FOREST}
                        />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.collectionTitle}>
                            {TITLES[page.component] ?? 'Records'}
                        </Text>
                        <Text style={styles.mutedSmall}>
                            {collectionDescription(page.component)}
                        </Text>
                    </View>
                </View>
                {page.data.summary && (
                    <View style={styles.summaryStrip}>
                        {Object.entries(page.data.summary)
                            .filter(([, value]) =>
                                ['number', 'string'].includes(typeof value),
                            )
                            .slice(0, 4)
                            .map(([key, value]) => (
                                <View key={key} style={styles.summaryCell}>
                                    <Text style={styles.summaryNumber}>
                                        {String(value)}
                                    </Text>
                                    <Text style={styles.mutedSmall}>
                                        {pretty(key)}
                                    </Text>
                                </View>
                            ))}
                    </View>
                )}
                {page.data.filters && (
                    <View style={styles.searchRow}>
                        <TextInput
                            style={[styles.input, styles.searchInput]}
                            placeholder="Search records"
                            value={props.search}
                            onChangeText={props.onSearch}
                            onSubmitEditing={() =>
                                props.onOpen(
                                    withCollectionQuery(props.path, props.search, filterValues),
                                    titleFor(props.path),
                                )
                            }
                            returnKeyType="search"
                        />
                        <Pressable
                            style={({ pressed }) => [
                                styles.searchBtn,
                                pressed && styles.pressed,
                            ]}
                            onPress={() =>
                                props.onOpen(
                                    withCollectionQuery(props.path, props.search, filterValues),
                                    titleFor(props.path),
                                )
                            }
                        >
                            <AppIcon
                                name="search"
                                size={15}
                                color={API_FOREST}
                            />
                            <Text style={styles.searchText}>Search</Text>
                        </Pressable>
                    </View>
                )}
                {page.data.filters && filterControls.length > 0 && (
                    <View style={styles.filterGrid}>
                        {filterControls.map((filter) => (
                            <View key={filter.key} style={styles.filterField}>
                                <Text style={styles.filterLabel}>{filter.label}</Text>
                                <View style={styles.filterPicker}>
                                    <Picker
                                        selectedValue={String(filterValues[filter.key] ?? '')}
                                        onValueChange={(value) => applyFilter(filter.key, String(value))}
                                        style={styles.filterPickerControl}
                                    >
                                        <Picker.Item label={`All ${filter.label.toLowerCase()}`} value="" />
                                        {filter.options.map((option, index) => (
                                            <Picker.Item key={`${option.value}-${index}`} label={option.label} value={option.value} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                {createPath && props.isOperations && (
                    <Primary
                        title={createLabel(page.component)}
                        onPress={() =>
                            props.onOpen(createPath, titleFor(createPath))
                        }
                    />
                )}
                {page.component === 'farms/index' && props.isOperations && (
                    <Text style={styles.notice}>
                        Open a farmer record to add a farm to their portfolio.
                    </Text>
                )}
                {page.component === 'activity-types/index' &&
                    props.user.role === 'admin' && (
                        <Primary
                            title="Add activity type"
                            onPress={() =>
                                props.onLocalForm(
                                    'activity-types/create',
                                    page.data,
                                )
                            }
                        />
                    )}
                {rows.length === 0 ? (
                    <Empty
                        title={props.search.trim() ? 'No matching records' : 'No records yet'}
                        detail={
                            props.search.trim()
                                ? 'Try a different name, farm ID, or search term.'
                                : emptyCollectionDescription(page.component)
                        }
                    />
                ) : (
                    rows.map((row, index) => {
                        const path = rowPath(page.component, row);
                        return (
                            <Pressable
                                key={row.id ?? index}
                                onPress={() =>
                                    path &&
                                    props.onOpen(
                                        path,
                                        detailTitle(page.component),
                                    )
                                }
                                style={({ pressed }) => [
                                    styles.recordCard,
                                    pressed && path && styles.pressed,
                                ]}
                            >
                                <View style={styles.recordTop}>
                                    <View style={styles.rowIdentity}>
                                        <View style={styles.rowIcon}>
                                            <AppIcon
                                                name={collectionIcon(page.component)}
                                                size={16}
                                                color={GREEN}
                                            />
                                        </View>
                                        <View style={styles.flex}>
                                            <Text style={styles.recordTitle}>
                                                {recordTitle(row)}
                                            </Text>
                                            {row.farm_id || row.farmer_id || row.lot_code ? (
                                                <Text style={styles.recordCode}>
                                                    {String(row.farm_id ?? row.farmer_id ?? row.lot_code)}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    <AppIcon
                                        name="chevronRight"
                                        size={18}
                                        color="#97a39a"
                                    />
                                </View>
                                <Text style={styles.mutedSmall}>
                                    {recordSubtitle(row)}
                                </Text>
                                {(row.status_label ||
                                    row.verification_status) && (
                                    <Text style={[styles.status, statusStyle(String(row.status_label ?? row.verification_status))]}>
                                        {String(
                                            row.status_label ??
                                                row.verification_status,
                                        ).replaceAll('_', ' ')}
                                    </Text>
                                )}
                            </Pressable>
                        );
                    })
                )}
                {collection?.next_page_url && (
                    <Secondary
                        title="Load more"
                        onPress={() =>
                            props.onLoadMore(
                                nextPath(collection.next_page_url),
                                titleFor(props.path),
                            )
                        }
                    />
                )}
            </ScrollView>
        );
    }

    if (page.component === 'farm-verification/show') {
        const farm = page.data.farm ?? {};
        const canVerifierManageBoundary =
            props.user.role === 'field_verifier' &&
            farm.verification_status === 'in_progress';
        const inspection = page.data.inspection;
        const hasInspection = Boolean(
            inspection?.checklist?.farm_identified &&
            inspection?.checklist?.boundary_walked &&
            inspection?.checklist?.farmer_or_representative_met &&
            inspection?.photos?.length,
        );
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <Entity
                    data={farm}
                    title={farm.farm_name ?? 'Farm verification'}
                />
                <FarmLocationCard farm={farm} />
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Verification progress</Text>
                    <VerificationProgress status={farm.verification_status} />
                    <Text style={styles.mutedSmall}>
                        Start the visit, capture the farm perimeter, complete the inspection, then submit a result.
                    </Text>
                </View>
                {page.data.comparison && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Area comparison</Text>
                        <SummaryRow
                            label="Declared"
                            value={page.data.comparison.declared_area}
                        />
                        <SummaryRow
                            label="Measured"
                            value={page.data.comparison.measured_area}
                        />
                        <SummaryRow
                            label="Variance"
                            value={page.data.comparison.variance}
                        />
                    </View>
                )}
                {page.data.boundary ? (
                    <BoundaryCard boundary={page.data.boundary} apiKey={page.data.google_maps_api_key} />
                ) : (
                    <View style={styles.noticeCard}>
                        <AppIcon name="location" size={18} color={GREEN} />
                        <View style={styles.flex}>
                            <Text style={styles.recordTitle}>No GPS boundary saved</Text>
                            <Text style={styles.mutedSmall}>Capture the farm perimeter to calculate its measured area.</Text>
                        </View>
                    </View>
                )}
                {props.isOperations && (
                    <Primary
                        title="Edit farm boundary"
                        onPress={() =>
                            props.onLocalForm('farm-boundary/edit', {
                                farmId: farm.id,
                                hasBoundary: Boolean(page.data.boundary),
                                boundary: page.data.boundary,
                            })
                        }
                    />
                )}
                {canVerifierManageBoundary && (
                    page.data.boundary ? (
                        <Secondary
                            title="Update GPS boundary"
                            onPress={() =>
                                props.onLocalForm('farm-boundary/edit', {
                                    farmId: farm.id,
                                    hasBoundary: true,
                                    boundary: page.data.boundary,
                                })
                            }
                        />
                    ) : (
                        <Primary
                            title="Capture GPS boundary"
                            onPress={() =>
                                props.onLocalForm('farm-boundary/edit', {
                                    farmId: farm.id,
                                    hasBoundary: false,
                                })
                            }
                        />
                    )
                )}
                {props.user.role === 'field_verifier' &&
                    farm.verification_status === 'verified' && (
                        <View style={styles.noticeCard}>
                            <AppIcon name="lock" size={17} color={API_FOREST} />
                            <Text style={[styles.mutedSmall, styles.flex]}>
                                This verified boundary is read-only. Ask operations to open a new verification if it needs review.
                            </Text>
                        </View>
                    )}
                {props.user.role === 'field_verifier' &&
                    ['pending', 'needs_review'].includes(farm.verification_status) && (
                        <Primary
                            title="Start verification"
                            busy={props.busy}
                            onPress={() => props.onStartVerification(farm.id)}
                        />
                    )}
                {props.user.role === 'field_verifier' &&
                    farm.verification_status === 'in_progress' && (
                        <>
                            {page.data.boundary && !hasInspection && props.user.role === 'field_verifier' && (
                                <Primary
                                    title="Complete inspection & add evidence"
                                    onPress={() => props.onLocalForm('farm-verification/inspection', {
                                        farmId: farm.id,
                                        farmName: farm.farm_name,
                                        farmCode: farm.farm_id,
                                        farmerName: farm.farmer_name,
                                        declaredArea: page.data.comparison?.declared_area,
                                        measuredArea: page.data.comparison?.measured_area,
                                    })}
                                />
                            )}
                            {page.data.boundary && hasInspection && (
                                <Primary
                                    title="Record verification result"
                                    onPress={() => props.onLocalForm('farm-verification/decision', {
                                        farmId: farm.id,
                                        farmName: farm.farm_name,
                                        farmCode: farm.farm_id,
                                        farmerName: farm.farmer_name,
                                        declaredArea: page.data.comparison?.declared_area,
                                        measuredArea: page.data.comparison?.measured_area,
                                    })}
                                />
                            )}
                            {inspection && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Field inspection</Text>
                                    <SummaryRow label="Farm identified" value={inspection.checklist?.farm_identified ? 'Complete' : 'Incomplete'} />
                                    <SummaryRow label="Boundary walked" value={inspection.checklist?.boundary_walked ? 'Complete' : 'Incomplete'} />
                                    <SummaryRow label="Farmer / representative met" value={inspection.checklist?.farmer_or_representative_met ? 'Complete' : 'Incomplete'} />
                                    {(inspection.photos ?? []).map((photo: any) => <Text key={photo.id} style={styles.mutedSmall}>Evidence: {photo.name}{photo.captured_at ? ` · ${photo.captured_at}` : ''}</Text>)}
                                </View>
                            )}
                        </>
                    )}
                <Related title="Verification history" rows={page.data.history ?? []} />
            </ScrollView>
        );
    }

    if (page.component === 'modules/placeholder')
        return (
            <ScrollView style={styles.page} contentContainerStyle={styles.content}>
                <View style={styles.moduleHero}>
                    <View style={styles.moduleIcon}>
                        <AppIcon name={moduleIcon(page.data.module)} size={28} color={API_FOREST} />
                    </View>
                    <Text style={styles.moduleEyebrow}>SUREFARM WORKSPACE</Text>
                    <Text style={styles.moduleTitle}>{page.data.title ?? 'Workspace'}</Text>
                    <Text style={styles.muted}>
                        {page.data.description ?? 'This workspace is part of the SureFarm program.'}
                    </Text>
                    <View style={styles.comingSoonPill}>
                        <View style={styles.comingSoonDot} />
                        <Text style={styles.comingSoonText}>In development</Text>
                    </View>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>What you can do now</Text>
                    <Text style={styles.muted}>
                        This workspace does not have working record screens yet. SureFarm will show live tools here when they are ready.
                    </Text>
                    {['finance', 'insurance'].includes(page.data.module) && (
                        <>
                            <Text style={[styles.muted, { marginTop: 10 }]}>
                                Existing farm financing and insurance records can be reviewed from a farm profile.
                            </Text>
                            <Primary title="Browse farm records" onPress={() => props.onOpen('/farms', 'Farms & map')} />
                        </>
                    )}
                </View>
            </ScrollView>
        );

    const key = entityKey(page.component, page.data);
    const entity = key ? page.data[key] : null;
    if (entity && typeof entity === 'object' && !Array.isArray(entity)) {
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <Entity
                    data={entity}
                    title={recordTitle(entity)}
                    token={props.token}
                />
                {page.component === 'farmers/show' && page.data.farmer?.farm_summary && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Farm portfolio</Text>
                        <SummaryRow label="Registered farms" value={page.data.farmer.farm_summary.registered_farms} />
                        <SummaryRow label="Declared area" value={`${page.data.farmer.farm_summary.declared_area_hectares} ha`} />
                        <SummaryRow label="Verified area" value={`${page.data.farmer.farm_summary.total_verified_hectares} ha`} />
                        <SummaryRow label="Verified farms" value={page.data.farmer.farm_summary.verified_farms} />
                        <SummaryRow label="Pending verification" value={page.data.farmer.farm_summary.pending_verification} />
                    </View>
                )}
                {page.component === 'farmers/show' && page.data.farmer?.spouse && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Spouse</Text>
                        <SummaryRow label="Name" value={page.data.farmer.spouse.full_name} />
                    </View>
                )}
                {page.component === 'farmers/show' && page.data.farmer?.bank_account && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Bank account</Text>
                        <SummaryRow label="Bank" value={page.data.farmer.bank_account.bank_name} />
                        <SummaryRow label="Account name" value={page.data.farmer.bank_account.account_name} />
                        <SummaryRow label="Account number" value={page.data.farmer.bank_account.account_number} />
                        <SummaryRow label="Verification" value={page.data.farmer.bank_account.status_label} />
                    </View>
                )}
                {page.component === 'inventory/show' && entity.stage && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Current processing stage</Text>
                        <SummaryRow label="Stage" value={entity.stage.name} />
                        <SummaryRow label="Stage code" value={entity.stage.code} />
                    </View>
                )}
                {page.component !== 'farms/show' && entity.farm?.id && (
                    <LinkedRecord row={entity.farm} kind="farm" onOpen={props.onOpen} />
                )}
                {page.component !== 'farmers/show' && entity.farmer?.id && (
                    <LinkedRecord row={entity.farmer} kind="farmer" onOpen={props.onOpen} />
                )}
                {detailActions(
                    page.component,
                    page.data,
                    props.isOperations,
                    props.user.role,
                ).map((action) => (
                    <Primary
                        key={action.title}
                        title={action.title}
                        onPress={() =>
                            action.local
                                ? props.onLocalForm(
                                      action.local,
                                      action.data ?? {},
                                  )
                                : action.path &&
                                  props.onOpen(action.path, action.title)
                        }
                    />
                ))}
                {page.component === 'farms/show' && page.data.farm?.farmer && (
                    <LinkedFarmer farmer={page.data.farm.farmer} onOpen={props.onOpen} />
                )}
                {page.component === 'farms/show' && (
                    <FarmLocationCard farm={page.data.farm} />
                )}
                {page.component === 'farms/show' && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Area records</Text>
                        <SummaryRow label="Declared area" value={`${page.data.farm.declared_area_hectares} ha`} />
                        <SummaryRow label="GPS measured" value={page.data.farm.measured_area ?? 'Not yet measured'} />
                        <SummaryRow label="Verified area" value={page.data.farm.verified_area ?? 'Not yet verified'} />
                        <SummaryRow label="Difference" value={page.data.farm.difference ?? '—'} />
                        <SummaryRow label="Variance" value={page.data.farm.variance ?? '—'} />
                    </View>
                )}
                {page.component === 'farmers/show' && (
                        <RelatedLinks
                            title="Farms"
                            rows={page.data.farmer?.farms ?? []}
                            pathFor={(row) => `/farms/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farmers/show' && (
                        <Related
                            title="Recent activities"
                            rows={page.data.farmer?.recent_activities ?? []}
                        />
                    )}
                {page.component === 'farms/show' && (
                        <RelatedLinks
                            title="Farm activities"
                            rows={page.data.farm?.activities ?? []}
                            pathFor={(row) => `/farm-activities/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' && (
                        <RelatedLinks
                            title="Production records"
                            rows={page.data.farm?.productions ?? []}
                            pathFor={(row) => `/production/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' && (
                        <RelatedLinks
                            title="Harvest records"
                            rows={page.data.farm?.harvests ?? []}
                            pathFor={(row) => `/harvest/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' && (
                        <RelatedLinks
                            title="Traceability lots"
                            rows={page.data.farm?.traceability_lots ?? []}
                            pathFor={(row) => `/traceability/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.can_record_activity && (
                        <Primary
                            title="Record farm activity"
                            onPress={() =>
                                props.onOpen(
                                    `/farm-activities/create?farm=${entity.id}`,
                                    'Record farm activity',
                                )
                            }
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.can_record_production && (
                        <Primary
                            title="Record expected production"
                            onPress={() =>
                                props.onOpen(
                                    `/production/create?farm=${entity.id}`,
                                    'Record expected production',
                                )
                            }
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.can_remove_boundary &&
                    page.data.farm.boundary && (
                        <Secondary
                            title="Remove farm boundary"
                            onPress={() => props.onDeleteBoundary(entity.id)}
                        />
                    )}
                {page.data.harvests && (
                    <Related
                        title="Harvest records"
                        rows={page.data.harvests}
                    />
                )}
                {page.data.movements && (
                    <Related title="Inventory movements" rows={page.data.movements} />
                )}
                {page.data.events && (
                    <Related title="Lot journey" rows={page.data.events} />
                )}
                {props.isOperations && page.data.farm_coverage?.length > 0 && (
                    <CoverageActions
                        rows={page.data.farm_coverage}
                        onOpen={props.onOpen}
                    />
                )}
                {page.component === 'farms/show' && page.data.farm?.can_manage_coverage && (
                    <CoverageActions
                        rows={[
                            {
                                ...page.data.farm,
                                number_label: 'Farm coverage',
                            },
                        ]}
                        onOpen={props.onOpen}
                    />
                )}
                {(page.data.boundary ?? page.data.farm?.boundary)?.geojson && (
                    <BoundaryCard boundary={page.data.boundary ?? page.data.farm.boundary} apiKey={page.data.google_maps_api_key} />
                )}
            </ScrollView>
        );
    }
    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>
                    {TITLES[page.component] ?? 'SureFarm'}
                </Text>
                <KeyRows data={page.data} />
            </View>
        </ScrollView>
    );
}

function VerificationProgress({ status = 'pending' }: { status?: string }) {
    const completed = ['verified', 'failed', 'needs_review'].includes(status);
    const activeStep = status === 'pending' ? 0 : completed ? 2 : 1;
    const labels = ['Pending', 'Field visit', 'Result'];
    return (
        <View style={styles.progressTrack}>
            {labels.map((label, index) => {
                const done = index < activeStep || (completed && index === activeStep);
                const active = index === activeStep && !completed;
                return (
                    <View key={label} style={styles.progressStep}>
                        <View style={[styles.progressDot, done && styles.progressDotDone, active && styles.progressDotActive]}>
                            {done ? <AppIcon name="verified" size={13} color="#ffffff" /> : <Text style={[styles.progressNumber, active && styles.progressNumberActive]}>{index + 1}</Text>}
                        </View>
                        <Text style={[styles.progressLabel, (done || active) && styles.progressLabelActive]}>{label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

function FarmLocationCard({ farm }: { farm: Record<string, any> }) {
    const hasCoordinates = farm.latitude !== null && farm.latitude !== undefined && farm.longitude !== null && farm.longitude !== undefined;
    const address = farm.location ?? [farm.purok_sitio, farm.barangay, farm.municipality, farm.province]
        .filter((part) => typeof part === 'string' && part.trim())
        .join(', ');
    const openMap = async () => {
        if (!hasCoordinates) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${farm.latitude},${farm.longitude}`)}`;
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Could not open map', 'Check that a maps app or browser is available.');
        }
    };

    return (
        <View style={styles.locationCard}>
            <View style={styles.locationTitleRow}>
                <View style={styles.locationIcon}><AppIcon name="location" size={18} color={API_FOREST} /></View>
                <View style={styles.flex}>
                    <Text style={styles.recordTitle}>Farm location</Text>
                    <Text style={styles.mutedSmall}>{address || 'Location not provided'}</Text>
                </View>
            </View>
            {hasCoordinates ? (
                <>
                    <Text style={styles.coordinateText}>Lat {farm.latitude}  ·  Lng {farm.longitude}</Text>
                    <Secondary title="Open directions in Maps" onPress={() => void openMap()} />
                </>
            ) : (
                <Text style={styles.gpsAccuracy}>GPS coordinates have not been recorded.</Text>
            )}
        </View>
    );
}

function BoundaryCard({ boundary, apiKey }: { boundary: Record<string, any>; apiKey?: string }) {
    const mapHost = useRef<HTMLDivElement | null>(null);
    const geometry = useMemo(() => {
        try {
            const parsed = typeof boundary.geojson === 'string' ? JSON.parse(boundary.geojson) : boundary.geojson;
            if (parsed?.type === 'Polygon') return parsed.coordinates?.[0];
            if (parsed?.type === 'MultiPolygon') return parsed.coordinates?.[0]?.[0];
        } catch {
            return null;
        }
        return null;
    }, [boundary.geojson]);
    const points = useMemo(
        () => Array.isArray(geometry)
            ? geometry.filter((point: any) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
            : [],
        [geometry],
    );
    const openPoints = useMemo(
        () => points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]
            ? points.slice(0, -1)
            : points,
        [points],
    );
    const previewPoints = (() => {
        if (openPoints.length < 3) return '';
        const xs = openPoints.map((point: any) => Number(point[0]));
        const ys = openPoints.map((point: any) => Number(point[1]));
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(250 / width, 105 / height);
        const offsetX = (320 - width * scale) / 2;
        const offsetY = (140 - height * scale) / 2;
        return openPoints.map((point: any) => `${(offsetX + (Number(point[0]) - minX) * scale).toFixed(1)},${(offsetY + 8 + (maxY - Number(point[1])) * scale).toFixed(1)}`).join(' ');
    })();

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined' || !apiKey || openPoints.length < 3 || !mapHost.current) return;

        const browserWindow = window as any;
        let cancelled = false;
        const renderMap = () => {
            if (cancelled || !mapHost.current || !browserWindow.google?.maps) return;
            const map = new browserWindow.google.maps.Map(mapHost.current, {
                mapTypeId: 'hybrid',
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true,
                gestureHandling: 'greedy',
            });
            const path = openPoints.map((point: any) => ({ lat: Number(point[1]), lng: Number(point[0]) }));
            const polygon = new browserWindow.google.maps.Polygon({
                paths: path,
                strokeColor: '#17613d',
                strokeOpacity: 0.95,
                strokeWeight: 3,
                fillColor: '#70b83b',
                fillOpacity: 0.28,
            });
            polygon.setMap(map);
            const bounds = new browserWindow.google.maps.LatLngBounds();
            path.forEach((point: any) => bounds.extend(point));
            map.fitBounds(bounds, 24);
        };

        if (browserWindow.google?.maps) {
            renderMap();
        } else {
            let script = document.querySelector<HTMLScriptElement>('#surefarm-google-maps');
            if (!script) {
                script = document.createElement('script');
                script.id = 'surefarm-google-maps';
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
            script.addEventListener('load', renderMap);
        }

        return () => { cancelled = true; };
    }, [apiKey, openPoints]);

    return (
        <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
                <View>
                    <Text style={styles.cardTitle}>Saved GPS boundary</Text>
                    <Text style={styles.mutedSmall}>{Platform.OS === 'web' && apiKey ? 'Google satellite map · saved GPS boundary' : 'Boundary outline preview'}</Text>
                </View>
                <View style={styles.boundaryIcon}><AppIcon name="location" size={17} color={API_FOREST} /></View>
            </View>
            {Platform.OS === 'web' && apiKey && openPoints.length >= 3
                ? createElement('div', { ref: mapHost, style: { width: '100%', height: 220, borderRadius: 14, overflow: 'hidden' } })
                : <View style={styles.boundaryPreview}>
                <Svg width="100%" height={140} viewBox="0 0 320 140">
                    <Path d="M0 35H320 M0 70H320 M0 105H320 M80 0V140 M160 0V140 M240 0V140" stroke="#e6eee7" strokeWidth={1} />
                    {previewPoints ? <Polygon points={previewPoints} fill="#88b89555" stroke={GREEN} strokeWidth={3} strokeLinejoin="round" /> : <Circle cx={160} cy={70} r={5} fill={GREEN} />}
                </Svg>
                </View>}
            <View style={styles.boundaryFacts}>
                <View style={styles.boundaryFact}>
                    <Text style={styles.boundaryValue}>{boundary.gps_measured_area_hectares ?? '—'}</Text>
                    <Text style={styles.mutedSmall}>Measured ha</Text>
                </View>
                <View style={styles.boundaryFact}>
                    <Text style={styles.boundaryValue}>{openPoints.length || '—'}</Text>
                    <Text style={styles.mutedSmall}>GPS points</Text>
                </View>
                <View style={styles.boundaryFact}>
                    <Text style={styles.boundaryValue}>{boundary.captured_at ?? '—'}</Text>
                    <Text style={styles.mutedSmall}>Captured</Text>
                </View>
            </View>
        </View>
    );
}

function LinkedFarmer({ farmer, onOpen }: { farmer: Record<string, any>; onOpen: (path: string, title: string) => void }) {
    return (
        <Pressable onPress={() => onOpen(`/farmers/${farmer.id}`, 'Farmer details')} style={({ pressed }) => [styles.linkedFarmer, pressed && styles.pressed]}>
            <View style={styles.linkedFarmerIcon}><AppIcon name="farmers" size={18} color={API_FOREST} /></View>
            <View style={styles.flex}>
                <Text style={styles.mutedSmall}>REGISTERED FARMER</Text>
                <Text style={styles.recordTitle}>{farmer.full_name ?? 'Farmer profile'}</Text>
                <Text style={styles.recordCode}>{farmer.farmer_id}</Text>
            </View>
            <AppIcon name="chevronRight" size={18} color={GREEN} />
        </Pressable>
    );
}

function LinkedRecord({ row, kind, onOpen }: { row: Record<string, any>; kind: 'farm' | 'farmer'; onOpen: (path: string, title: string) => void }) {
    const farmer = kind === 'farmer';
    const title = farmer ? (row.full_name ?? row.name ?? 'Farmer profile') : (row.farm_name ?? 'Farm profile');
    const code = farmer ? row.farmer_id : row.farm_id;
    return (
        <Pressable onPress={() => onOpen(`/${farmer ? 'farmers' : 'farms'}/${row.id}`, farmer ? 'Farmer details' : 'Farm details')} style={({ pressed }) => [styles.linkedFarmer, pressed && styles.pressed]}>
            <View style={styles.linkedFarmerIcon}>
                <AppIcon name={farmer ? 'farmers' : 'farms'} size={18} color={API_FOREST} />
            </View>
            <View style={styles.flex}>
                <Text style={styles.mutedSmall}>{farmer ? 'FARMER PROFILE' : 'FARM RECORD'}</Text>
                <Text style={styles.recordTitle}>{title}</Text>
                {code ? <Text style={styles.recordCode}>{String(code)}</Text> : null}
            </View>
            <AppIcon name="chevronRight" size={18} color={GREEN} />
        </Pressable>
    );
}

function FormView(props: {
    spec: FormSpec;
    data: Record<string, any>;
    values: Record<string, any>;
    photos: Record<string, ImagePicker.ImagePickerAsset>;
    error: string;
    busy: boolean;
    onChange: (key: string, value: any) => void;
    onImage: (key: string, camera: boolean) => void;
    onOpen: (path: string, title: string) => void;
    onSubmit: () => void;
}) {
    const [boundaryPoints, setBoundaryPoints] = useState<[number, number][]>(
        [],
    );
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const boundaryField = props.spec.fields.find(
        (field) => field.kind === 'geojson',
    );
    const hasCoordinates =
        props.spec.fields.some((field) => field.key === 'latitude') &&
        props.spec.fields.some((field) => field.key === 'longitude');

    const captureLocation = async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(
                'Location permission needed',
                'Allow location access while using SureFarm to record farm coordinates.',
            );
            return;
        }

        try {
            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setGpsAccuracy(position.coords.accuracy);
            const point: [number, number] = [
                position.coords.longitude,
                position.coords.latitude,
            ];

            if (boundaryField) {
                let existing: [number, number][] = boundaryPoints;
                const raw = props.values[boundaryField.key];
                if (typeof raw === 'string' && raw.trim()) {
                    try {
                        const geometry = JSON.parse(raw);
                        const ring = geometry?.coordinates?.[0];
                        if (
                            geometry?.type === 'Polygon' &&
                            Array.isArray(ring)
                        ) {
                            existing = ring.map(
                                (coordinate: any) =>
                                    [
                                        Number(coordinate[0]),
                                        Number(coordinate[1]),
                                    ] as [number, number],
                            );
                            const first = existing[0];
                            const last = existing[existing.length - 1];
                            if (
                                first &&
                                last &&
                                first[0] === last[0] &&
                                first[1] === last[1]
                            )
                                existing = existing.slice(0, -1);
                        }
                    } catch {
                        /* The boundary can also be captured from a blank form. */
                    }
                }

                const nextPoints = [...existing, point];
                setBoundaryPoints(nextPoints);
                props.onChange(
                    boundaryField.key,
                    JSON.stringify(
                        { type: 'Polygon', coordinates: [nextPoints] },
                        null,
                        2,
                    ),
                );
            } else {
                props.onChange('latitude', point[1].toFixed(7));
                props.onChange('longitude', point[0].toFixed(7));
            }
        } catch {
            Alert.alert(
                'Could not read location',
                'Move outdoors and try again.',
            );
        }
    };

    const closeBoundary = () => {
        const raw = props.values[boundaryField?.key ?? ''];
        let points = boundaryPoints;
        if (typeof raw === 'string') {
            try {
                const geometry = JSON.parse(raw);
                if (
                    geometry?.type === 'Polygon' &&
                    Array.isArray(geometry.coordinates?.[0])
                ) {
                    points = geometry.coordinates[0].map(
                        (coordinate: any) =>
                            [Number(coordinate[0]), Number(coordinate[1])] as [
                                number,
                                number,
                            ],
                    );
                }
            } catch {
                /* The server will return a field error if the text is malformed. */
            }
        }

        if (points.length < 3 || !boundaryField) {
            Alert.alert(
                'Add more points',
                'Walk to and record at least three farm corners first.',
            );
            return;
        }

        const ring = [...points, points[0]];
        props.onChange(
            boundaryField.key,
            JSON.stringify({ type: 'Polygon', coordinates: [ring] }, null, 2),
        );
        setBoundaryPoints(points);
        Alert.alert(
            'Boundary closed',
            `${points.length} GPS points are ready to save.`,
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.formIntro}>
                    <Text style={styles.formTitle}>{props.spec.title}</Text>
                    <Text style={styles.muted}>
                        Complete the fields below. SureFarm checks the values before saving.
                    </Text>
                </View>
                {props.spec.path.includes('/farm-verification/') && (
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeading}>
                            <AppIcon name="shield" size={17} color={API_FOREST} />
                            <Text style={styles.recordTitle}>Verification review</Text>
                        </View>
                        <SummaryRow label="Farmer" value={props.data.farmerName ?? '—'} />
                        <SummaryRow label="Farm" value={props.data.farmName ?? props.data.farmCode ?? '—'} />
                        {props.data.declaredArea && <SummaryRow label="Declared area" value={props.data.declaredArea} />}
                        {props.data.measuredArea && <SummaryRow label="GPS measured" value={props.data.measuredArea} />}
                    </View>
                )}
                {hasCoordinates && (
                    <View style={styles.locationCard}>
                        <Text style={styles.recordTitle}>Farm location</Text>
                        <Text style={styles.mutedSmall}>
                            Use the phone’s current GPS location to fill in
                            latitude and longitude.
                        </Text>
                        <Secondary
                            title="Use current location"
                            onPress={() => void captureLocation()}
                        />
                        {gpsAccuracy !== null && (
                            <Text style={styles.gpsAccuracy}>
                                Last GPS reading accuracy: about {Math.round(gpsAccuracy)} m
                            </Text>
                        )}
                    </View>
                )}
                {boundaryField && (
                    <View style={styles.locationCard}>
                        <Text style={styles.recordTitle}>
                            Walk and record the boundary
                        </Text>
                        <Text style={styles.mutedSmall}>
                            Record a GPS point at each farm corner in order. Add
                            at least three corners, then close the polygon.
                        </Text>
                        <Secondary
                            title="Add GPS point"
                            onPress={() => void captureLocation()}
                        />
                        <Secondary
                            title="Close boundary"
                            onPress={closeBoundary}
                        />
                        <Text style={styles.mutedSmall}>
                            {boundaryPoints.length} new GPS point
                            {boundaryPoints.length === 1 ? '' : 's'} recorded
                        </Text>
                        {gpsAccuracy !== null && (
                            <Text style={styles.gpsAccuracy}>
                                Last point accuracy: about {Math.round(gpsAccuracy)} m
                            </Text>
                        )}
                    </View>
                )}
                {props.spec.fields.map((field) => {
                    let options = optionList(field.options, props.data);
                    if (
                        field.key === 'destination_stage_id' &&
                        Array.isArray(props.data.lots)
                    ) {
                        const lot = props.data.lots.find(
                            (item: any) =>
                                String(item.id) ===
                                String(props.values.inventory_id),
                        );
                        options =
                            lot?.next_stage_id == null
                                ? []
                                : [
                                      {
                                          value: String(lot.next_stage_id),
                                          label: String(
                                              lot.next_stage_name ??
                                                  lot.next_stage_id,
                                          ),
                                      },
                                  ];
                    }

                    return (
                        <InputField
                            key={field.key}
                            field={field}
                            value={props.values[field.key]}
                            options={options}
                            photo={props.photos[field.key]}
                            onChange={(value) =>
                                props.onChange(field.key, value)
                            }
                            onImage={(camera) =>
                                props.onImage(field.key, camera)
                            }
                        />
                    );
                })}
                {props.error ? (
                    <Text style={styles.errorText}>{props.error}</Text>
                ) : null}
                <Primary
                    title="Save changes"
                    busy={props.busy}
                    onPress={props.onSubmit}
                />
                {props.spec.path === '/settings/profile' && (
                    <Secondary
                        title="Open security settings"
                        onPress={() =>
                            props.onOpen(
                                '/settings/security',
                                'Security settings',
                            )
                        }
                    />
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function InputField(props: {
    field: FieldSpec;
    value: any;
    options: { value: string; label: string }[];
    photo?: ImagePicker.ImagePickerAsset;
    onChange: (value: any) => void;
    onImage: (camera: boolean) => void;
}) {
    const { field } = props;
    if (field.kind === 'toggle')
        return (
            <View style={styles.toggle}>
                <Text style={styles.flex}>{field.label}</Text>
                <Switch
                    value={Boolean(props.value)}
                    onValueChange={props.onChange}
                    trackColor={{ false: '#d9dfda', true: '#b5d1bb' }}
                    thumbColor={props.value ? API_FOREST : '#ffffff'}
                />
            </View>
        );
    if (field.kind === 'select') {
        const options = field.optional
            ? [{ value: '', label: 'Not selected' }, ...props.options]
            : props.options;
        return (
            <View style={styles.field}>
                <Label text={`${field.label}${field.required ? ' *' : ''}`} />
                <View style={styles.pickerBox}>
                    <Picker
                        selectedValue={String(props.value ?? '')}
                        onValueChange={(value) => props.onChange(value)}
                        style={styles.picker}
                    >
                        {!field.required &&
                            !options.some((item) => item.value === '') && (
                                <Picker.Item
                                    label="Choose an option"
                                    value=""
                                />
                            )}
                        {options.map((item, index) => (
                            <Picker.Item
                                key={`${item.value}-${index}`}
                                label={item.label}
                                value={item.value}
                            />
                        ))}
                    </Picker>
                </View>
            </View>
        );
    }
    if (field.kind === 'image')
        return (
            <View style={styles.field}>
                <Label text={field.label} />
                {props.photo && (
                    <Image
                        source={{ uri: props.photo.uri }}
                        style={styles.photoPreview}
                    />
                )}
                <View style={styles.imageActions}>
                    <Secondary
                        title="Choose photo"
                        onPress={() => props.onImage(false)}
                    />
                    <Secondary
                        title="Take photo"
                        onPress={() => props.onImage(true)}
                    />
                </View>
            </View>
        );
    return (
        <View style={styles.field}>
            <Label text={`${field.label}${field.required ? ' *' : ''}`} />
            {field.hint && <Text style={styles.hint}>{field.hint}</Text>}
            <TextInput
                value={String(props.value ?? '')}
                onChangeText={props.onChange}
                style={[
                    styles.input,
                    (field.multiline || field.kind === 'geojson') &&
                        styles.multiline,
                ]}
                placeholder={
                    field.kind === 'date'
                        ? 'YYYY-MM-DD'
                        : field.kind === 'geojson'
                          ? '{ "type": "Polygon", … }'
                          : undefined
                }
                placeholderTextColor="#9aa49e"
                keyboardType={
                    field.kind === 'number'
                        ? 'decimal-pad'
                        : field.kind === 'email'
                          ? 'email-address'
                          : field.kind === 'phone'
                            ? 'phone-pad'
                            : 'default'
                }
                autoCapitalize={
                    field.kind === 'email' ||
                    field.kind === 'geojson' ||
                    field.key.toLowerCase().includes('password')
                        ? 'none'
                        : 'sentences'
                }
                autoCorrect={field.kind !== 'geojson'}
                secureTextEntry={field.key.toLowerCase().includes('password')}
                multiline={field.multiline || field.kind === 'geojson'}
                textAlignVertical={
                    field.multiline || field.kind === 'geojson'
                        ? 'top'
                        : 'center'
                }
            />
        </View>
    );
}

function Entity({
    data,
    title,
    token,
}: {
    data: Record<string, any>;
    title: string;
    token?: string;
}) {
    const image = data.photo_url ?? data.drone_image_url;
    const imageUrl = typeof image === 'string' ? toImageApiUrl(image) : null;
    const status = data.verification_status ?? data.status_label ?? data.status;
    const recordCode = data.farm_id ?? data.farmer_id ?? data.lot_code;
    return (
        <View style={styles.entity}>
            {imageUrl && (
                <Image
                    source={{
                        uri: imageUrl,
                        headers: token
                            ? { Authorization: `Bearer ${token}` }
                            : undefined,
                    }}
                    style={styles.entityPhoto}
                    resizeMode="cover"
                />
            )}
            <View style={styles.entityTitleRow}>
                <Text style={styles.entityTitle}>{title}</Text>
                {status ? (
                    <Text style={[styles.status, statusStyle(String(status))]}>
                        {String(status).replaceAll('_', ' ')}
                    </Text>
                ) : null}
            </View>
            {recordCode ? <Text style={styles.recordCode}>{String(recordCode)}</Text> : null}
            <KeyRows
                data={data}
                skip={[
                    'id',
                    'photo_url',
                    'drone_image_url',
                    'farms',
                    'farm_summary',
                    'farm_filters',
                    'recent_activities',
                    'farm_coverage',
                    'verifications',
                    'activities',
                    'productions',
                    'harvests',
                    'traceability_lots',
                    'insurances',
                    'financings',
                    'boundary',
                    'farmer',
                    'reference',
                    'farm',
                    'comparison',
                    'history',
                    'spouse',
                    'bank_account',
                    'status',
                    'status_label',
                    'verification_status',
                ]}
            />
        </View>
    );
}

function KeyRows({
    data,
    skip = [],
}: {
    data: Record<string, any>;
    skip?: string[];
}) {
    const rows = Object.entries(data).filter(
        ([key, value]) =>
            !skip.includes(key) &&
            value !== null &&
            value !== undefined &&
            value !== '' &&
            typeof value !== 'object',
    );
    return (
        <View>
            {rows.map(([key, value]) => (
                <View key={key} style={styles.keyRow}>
                    <Text style={styles.keyLabel}>{fieldLabel(key)}</Text>
                    <Text style={styles.keyValue}>{displayValue(key, value)}</Text>
                </View>
            ))}
        </View>
    );
}

function Related({ title, rows }: { title: string; rows: any[] }) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title} <Text style={styles.sectionCount}>{rows.length}</Text></Text>
            {rows.length === 0 ? (
                <Text style={styles.inlineEmpty}>Nothing has been recorded here yet.</Text>
            ) : rows.map((item, i) => (
                <View key={item.id ?? i} style={styles.relatedRow}>
                    <Text style={styles.recordTitle}>{recordTitle(item)}</Text>
                    <Text style={styles.mutedSmall}>
                        {recordSubtitle(item)}
                    </Text>
                </View>
            ))}
        </View>
    );
}

function EmptyState({ title, message }: { title: string; message: string }) {
    return (
        <View style={styles.card}>
            <AppIcon name="empty" size={22} color={API_FOREST} />
            <Text style={styles.recordTitle}>{title}</Text>
            <Text style={styles.muted}>{message}</Text>
        </View>
    );
}

function RelatedLinks({
    title,
    rows,
    pathFor,
    onOpen,
}: {
    title: string;
    rows: any[];
    pathFor: (row: any) => string;
    onOpen: (path: string, title: string) => void;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title} <Text style={styles.sectionCount}>{rows.length}</Text></Text>
            {rows.length === 0 ? (
                <Text style={styles.inlineEmpty}>No records are linked to this item yet.</Text>
            ) : rows.map((row, index) => (
                <Pressable
                    key={row.id ?? index}
                    onPress={() => onOpen(pathFor(row), recordTitle(row))}
                    style={styles.relatedRow}
                >
                    <Text style={styles.recordTitle}>{recordTitle(row)}</Text>
                    <Text style={styles.mutedSmall}>{recordSubtitle(row)}</Text>
                </Pressable>
            ))}
        </View>
    );
}

function CoverageActions({
    rows,
    onOpen,
}: {
    rows: any[];
    onOpen: (path: string, title: string) => void;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Insurance and financing</Text>
            {rows.map((row, index) => (
                <View key={row.id ?? index} style={styles.relatedRow}>
                    <Text style={styles.recordTitle}>
                        {row.number_label ?? 'Farm coverage'} -{' '}
                        {row.farm_name ?? 'Farm'}
                    </Text>
                    {(row.insurances ?? []).map((item: any) => (
                        <View
                            key={`insurance-${item.id}`}
                            style={styles.inline}
                        >
                            <Text style={[styles.mutedSmall, styles.flex]}>
                                Insurance -{' '}
                                {item.covered_label ??
                                    item.status_label ??
                                    item.status}
                            </Text>
                            <Pressable
                                onPress={() =>
                                    onOpen(
                                        `/farms/${row.id}/insurance/${item.id}/edit`,
                                        'Edit farm insurance',
                                    )
                                }
                            >
                                <Text style={styles.linkText}>Edit</Text>
                            </Pressable>
                        </View>
                    ))}
                    {(row.financings ?? []).map((item: any) => (
                        <View
                            key={`financing-${item.id}`}
                            style={styles.inline}
                        >
                            <Text style={[styles.mutedSmall, styles.flex]}>
                                Financing - {item.amount_label ?? item.amount}
                            </Text>
                            <Pressable
                                onPress={() =>
                                    onOpen(
                                        `/farms/${row.id}/financing/${item.id}/edit`,
                                        'Edit farm financing',
                                    )
                                }
                            >
                                <Text style={styles.linkText}>Edit</Text>
                            </Pressable>
                        </View>
                    ))}
                    <View style={styles.inline}>
                        <Pressable
                            onPress={() =>
                                onOpen(
                                    `/farms/${row.id}/insurance/create`,
                                    'Add farm insurance',
                                )
                            }
                        >
                            <Text style={styles.linkText}>Add insurance</Text>
                        </Pressable>
                        <Pressable
                            onPress={() =>
                                onOpen(
                                    `/farms/${row.id}/financing/create`,
                                    'Add farm financing',
                                )
                            }
                        >
                            <Text style={styles.linkText}>Add financing</Text>
                        </Pressable>
                    </View>
                </View>
            ))}
        </View>
    );
}

function Label({ text }: { text: string }) {
    return <Text style={styles.fieldLabel}>{text}</Text>;
}
function SummaryRow({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <View style={styles.keyRow}>
            <Text style={styles.keyLabel}>{label}</Text>
            <Text style={styles.keyValue}>{String(value)}</Text>
        </View>
    );
}
function Primary({
    title,
    onPress,
    busy = false,
}: {
    title: string;
    onPress: () => void;
    busy?: boolean;
}) {
    return (
        <Pressable
            disabled={busy}
            onPress={onPress}
            style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
                busy && { opacity: 0.7 },
            ]}
        >
            {busy ? (
                <ActivityIndicator color="#ffffff" />
            ) : (
                <Text style={styles.primaryText}>{title}</Text>
            )}
        </Pressable>
    );
}
function Secondary({ title, onPress }: { title: string; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
            ]}
        >
            <Text style={styles.secondaryText}>{title}</Text>
        </Pressable>
    );
}
function Empty({ title, detail }: { title: string; detail: string }) {
    return (
        <View style={styles.empty}>
            <AppIcon name="empty" size={36} color="#9aab9d" />
            <Text style={styles.heading}>{title}</Text>
            <Text style={styles.muted}>{detail}</Text>
        </View>
    );
}
function BottomItem({
    label,
    icon,
    active,
    onPress,
}: {
    label: string;
    icon: IconName;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
                styles.bottomItem,
                pressed && styles.pressed,
            ]}
        >
            <View
                style={[styles.bottomIcon, active && styles.bottomIconActive]}
            >
                <AppIcon
                    name={icon}
                    size={18}
                    color={active ? API_FOREST : MUTED}
                    strokeWidth={active ? 2.2 : 1.8}
                />
            </View>
            <Text
                style={[styles.bottomLabel, active && styles.bottomLabelActive]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

function titleFor(path: string) {
    const clean = path.split('?')[0].replace(/^\//, '');
    return (
        TITLES[clean] ??
        TITLES[`${clean}/index`] ??
        clean.split('/').map(pretty).join(' · ')
    );
}
function collectionIcon(component: string): IconName {
    const icons: Record<string, IconName> = {
        'farmers/index': 'farmers',
        'farms/index': 'farms',
        'farm-verification/index': 'verification',
        'farm-activities/index': 'activities',
        'production/index': 'production',
        'harvest/index': 'harvest',
        'inventory/index': 'inventory',
        'inventory/processing': 'processing',
        'traceability/index': 'traceability',
        'activity-types/index': 'activityTypes',
    };
    return icons[component] ?? 'dashboard';
}
function collectionDescription(component: string) {
    const descriptions: Record<string, string> = {
        'farmers/index': 'Farmer profiles and registered farm portfolios',
        'farms/index': 'Registered land, declared area, and verification status',
        'farm-verification/index': 'Field assignments and farm verification status',
        'farm-activities/index': 'Recorded work across registered farms',
        'production/index': 'Expected crop output by farm and season',
        'harvest/index': 'Harvest quantities, dates, and receiving status',
        'inventory/index': 'Coffee stock and its current processing stage',
        'inventory/processing': 'Processing activity and coffee movements',
        'traceability/index': 'Coffee lots and their traceable journeys',
        'activity-types/index': 'Configured activities available to field teams',
    };
    return descriptions[component] ?? 'Live records from SureFarm';
}
function emptyCollectionDescription(component: string) {
    const messages: Record<string, string> = {
        'farmers/index': 'No farmer profiles match this view. Register a farmer to start a portfolio.',
        'farms/index': 'No farm records match this view. Farms appear after they are registered.',
        'farm-verification/index': 'There are no farms in this verification queue right now.',
        'farm-activities/index': 'Farm activities will appear here after a field record is saved.',
        'production/index': 'Production records will appear here after they are added to a farm.',
        'harvest/index': 'Harvest records will appear here after a harvest is recorded.',
        'inventory/index': 'Inventory lots will appear here after harvest is received or coffee is processed.',
        'inventory/processing': 'Processing movements will appear here when coffee is processed.',
        'traceability/index': 'Traceability lots will appear here after a lot is created.',
        'activity-types/index': 'No activity types are available in this view.',
    };
    return messages[component] ?? 'There are no records to show in this view.';
}
function moduleIcon(module: string): IconName {
    const icons: Record<string, IconName> = {
        'crop-management': 'cropManagement',
        finance: 'finance',
        insurance: 'insurance',
        'logistics-export': 'logistics',
        cooperatives: 'cooperatives',
        reports: 'reports',
    };
    return icons[module] ?? 'features';
}
function statusStyle(status: string) {
    const key = status.toLowerCase().replaceAll(' ', '_');
    if (['verified', 'active', 'completed', 'approved', 'received'].includes(key)) return styles.statusPositive;
    if (['failed', 'inactive', 'rejected', 'damaged'].includes(key)) return styles.statusNegative;
    if (['needs_review', 'in_progress', 'pending', 'processing', 'draft'].includes(key)) return styles.statusAttention;
    return styles.statusNeutral;
}
function fieldLabel(key: string) {
    const labels: Record<string, string> = {
        farmer_id: 'Farmer ID',
        farm_id: 'Farm ID',
        lot_code: 'Lot code',
        full_name: 'Full name',
        crop_label: 'Crop',
        crop_type: 'Crop',
        declared_area_hectares: 'Declared area (ha)',
        gps_measured_area_hectares: 'GPS measured area (ha)',
        verified_area_hectares: 'Verified area (ha)',
        verified_area: 'Verified area',
        measured_area: 'GPS measured area',
        activity_date: 'Activity date',
        harvest_date: 'Harvest date',
        production_period: 'Production period',
        mobile_number: 'Mobile number',
        government_id: 'Government ID',
        purok_sitio: 'Purok / sitio',
        current_stage_name: 'Processing stage',
        verification_status: 'Verification status',
        status_label: 'Status',
        registered_at: 'Registered',
        updated_at: 'Last updated',
    };
    return labels[key] ?? pretty(key);
}
function displayValue(key: string, value: unknown) {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number' && key.endsWith('_hectares')) return `${value.toLocaleString()} ha`;
    if (typeof value === 'string' && ['status', 'verification_status', 'result', 'quality_grade', 'property_ownership'].includes(key)) {
        return value.replaceAll('_', ' ');
    }
    return String(value);
}
function pretty(value: string) {
    return value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (s) => s.toUpperCase());
}
function recordTitle(row: Record<string, any>) {
    return String(
        row.name ??
            row.full_name ??
            row.farm_name ??
            row.farmer_name ??
            row.activity_type ??
            row.activity ??
            row.lot_code ??
            row.production_period ??
            (row.harvest_date ? `Harvest · ${row.harvest_date}` : null) ??
            (row.farm_id ? `Farm ${row.farm_id}` : null) ??
            (row.farmer_id ? `Farmer ${row.farmer_id}` : null) ??
            (row.id ? `Record #${row.id}` : null) ??
            'Record',
    );
}
function recordSubtitle(row: Record<string, any>) {
    return [
        row.farmer_name ?? row.farmer?.name ?? row.farmer?.full_name,
        row.farm_name ?? row.farm?.farm_name,
        row.cooperative,
        row.location,
        row.crop_label,
        row.declared_area,
        row.measured_area,
        row.variance,
        row.activity_type,
        row.quantity_label,
        row.production_period,
        row.harvest_date,
        row.received_date,
        row.activity_date,
        row.status_label,
    ]
        .filter((x) => x !== undefined && x !== null && x !== '')
        .map(String)
        .join(' · ');
}
function withCollectionQuery(
    path: string,
    search: string,
    filters: Record<string, any>,
) {
    const clean = path.split('?')[0];
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'search' && value !== '' && value !== null && value !== undefined) {
            query.set(key, String(value));
        }
    });
    const serialized = query.toString();
    return serialized ? `${clean}?${serialized}` : clean;
}
function nextPath(url: string) {
    try {
        const parsed = new URL(url, API_URL);
        const root = '/api/mobile';
        return `${parsed.pathname.startsWith(root) ? parsed.pathname.slice(root.length) : parsed.pathname}${parsed.search}`;
    } catch {
        return '/dashboard';
    }
}
function toImageApiUrl(url: string) {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}/api/mobile${parsed.pathname}${parsed.search}`;
    } catch {
        return url;
    }
}
function rowPath(component: string, row: Record<string, any>) {
    const id = row.id;
    if (id === undefined || id === null) return null;
    const routes: Record<string, string> = {
        'farmers/index': `/farmers/${id}`,
        'farms/index': `/farms/${id}`,
        'farm-verification/index': `/farm-verification/${id}`,
        'farm-activities/index': `/farm-activities/${id}`,
        'production/index': `/production/${id}`,
        'harvest/index': `/harvest/${id}`,
        'inventory/index': `/inventory/${id}`,
        'traceability/index': `/traceability/${id}`,
        'activity-types/index': `/settings/activity-types/${id}/edit`,
    };
    return routes[component] ?? null;
}
function detailTitle(component: string) {
    return (
        (
            {
                'farmers/index': 'Farmer details',
                'farms/index': 'Farm details',
                'farm-verification/index': 'Verification record',
                'farm-activities/index': 'Activity details',
                'production/index': 'Production details',
                'harvest/index': 'Harvest details',
                'inventory/index': 'Inventory details',
                'traceability/index': 'Lot journey',
                'activity-types/index': 'Edit activity type',
            } as Record<string, string>
        )[component] ?? 'Details'
    );
}
function createLabel(component: string) {
    return (
        (
            {
                'farmers/index': 'Register farmer',
                'farm-activities/index': 'Record activity',
                'production/index': 'Record production',
                'harvest/index': 'Record harvest',
                'traceability/index': 'Create traceability lot',
                'inventory/processing': 'Process coffee',
            } as Record<string, string>
        )[component] ?? 'Create record'
    );
}
function entityKey(component: string, data: Record<string, any>) {
    const keys: Record<string, string> = {
        'farmers/show': 'farmer',
        'farms/show': 'farm',
        'farm-activities/show': 'activity',
        'production/show': 'production',
        'harvest/show': 'harvest',
        'inventory/show': 'inventory',
        'traceability/show': 'lot',
        'activity-types/edit': 'activityType',
        'farm-financing/edit': 'financing',
        'farm-insurance/edit': 'insurance',
    };
    const key = keys[component];
    return key && data[key]
        ? key
        : Object.keys(data).find(
              (k) =>
                  data[k] &&
                  typeof data[k] === 'object' &&
                  !Array.isArray(data[k]) &&
                  data[k].id !== undefined,
          );
}
function detailActions(
    component: string,
    data: Record<string, any>,
    operations: boolean,
    role: Role,
) {
    const entity = data[entityKey(component, data) ?? ''] ?? {};
    const id = entity.id;
    const actions: {
        title: string;
        path?: string;
        local?: string;
        data?: Record<string, any>;
    }[] = [];
    if (component === 'farmers/show' && id && operations)
        actions.push(
            { title: 'Edit farmer', path: `/farmers/${id}/edit` },
            { title: 'Add farm', path: `/farmers/${id}/farms/create` },
        );
    if (component === 'farms/show' && id && operations)
        actions.push(
            { title: 'Edit farm', path: `/farms/${id}/edit` },
            {
                title: 'Edit farm boundary',
                local: 'farm-boundary/edit',
                data: {
                    farmId: id,
                    hasBoundary: Boolean(data.boundary),
                    boundary: data.boundary,
                },
            },
        );
    if (
        component === 'farms/show' &&
        id &&
        (role === 'field_verifier' || role === 'admin')
    )
        actions.push({
            title: 'Open verification',
            path: `/farm-verification/${id}`,
        });
    if (component === 'farm-activities/show' && id && data.can_edit)
        actions.push({
            title: 'Edit activity',
            path: `/farm-activities/${id}/edit`,
        });
    if (component === 'production/show' && id && data.can_edit)
        actions.push(
            { title: 'Edit production', path: `/production/${id}/edit` },
            {
                title: 'Record harvest',
                path: `/harvest/create?production=${id}`,
            },
        );
    if (component === 'harvest/show' && id && data.can_edit)
        actions.push({ title: 'Edit harvest', path: `/harvest/${id}/edit` });
    if (component === 'harvest/show' && id && data.can_receive)
        actions.push({
            title: 'Receive into inventory',
            path: `/harvest/${id}/receive`,
        });
    if (component === 'inventory/show' && id && operations && data.can_manage)
        actions.push(
            { title: 'Adjust inventory', path: `/inventory/${id}/adjust` },
            { title: 'Record damage', path: `/inventory/${id}/damage` },
            ...(data.can_process
                ? [{ title: 'Process coffee', path: `/inventory/process/create?inventory=${id}` }]
                : []),
            ...(data.can_trace
                ? [{ title: 'Create traceability lot', path: `/traceability/create?inventory=${id}` }]
                : []),
        );
    if (component === 'traceability/show' && id && operations)
        actions.push({
            title: 'Print lot record',
            path: `/traceability/${id}/print`,
        });
    return actions;
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: CANVAS },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: CANVAS,
    },
    header: {
        minHeight: 70,
        paddingHorizontal: 17,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e9eeea',
    },
    backButton: { width: 42, justifyContent: 'center', minHeight: 48 },
    brandButton: { width: 126 },
    headerLogo: { width: 120, height: 36, alignSelf: 'flex-start' },
    logo: {
        width: 39,
        height: 39,
        borderRadius: 14,
        backgroundColor: API_FOREST,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: { color: '#ffffff', fontWeight: '800', fontSize: 20 },
    headerCopy: { flex: 1, marginLeft: 5 },
    headerTitle: { color: INK, fontSize: 16, fontWeight: '800' },
    headerSub: { color: MUTED, fontSize: 10, marginTop: 3 },
    signOut: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#f0f4f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    page: { flex: 1, backgroundColor: CANVAS },
    content: {
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 30,
    },
    welcome: {
        position: 'relative',
        overflow: 'hidden',
        padding: 20,
        borderRadius: 24,
        backgroundColor: API_FOREST,
        shadowColor: '#17392b',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.13,
        shadowRadius: 16,
        elevation: 4,
    },
    welcomeOrb: {
        position: 'absolute',
        pointerEvents: 'none',
        top: -66,
        right: -28,
        width: 178,
        height: 178,
        borderRadius: 90,
        backgroundColor: '#ffffff10',
        borderWidth: 1,
        borderColor: '#ffffff18',
    },
    welcomeOrbSmall: {
        position: 'absolute',
        pointerEvents: 'none',
        top: 33,
        right: 35,
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#ffffff08',
        borderWidth: 1,
        borderColor: '#ffffff12',
    },
    eyebrow: {
        color: '#c0d9c8',
        letterSpacing: 1.5,
        fontSize: 10,
        fontWeight: '700',
    },
    welcomeTitle: {
        color: '#ffffff',
        marginTop: 12,
        fontSize: 26,
        lineHeight: 32,
        fontWeight: '800',
    },
    welcomeBody: {
        maxWidth: 290,
        color: '#d4e3d8',
        marginTop: 8,
        fontSize: 13,
        lineHeight: 20,
    },
    heroAction: {
        minHeight: 45,
        marginTop: 17,
        paddingHorizontal: 14,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
    },
    heroActionText: { color: API_FOREST, fontSize: 12, fontWeight: '800' },
    dashboardHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 23,
        marginBottom: 12,
    },
    dashboardTitle: { color: INK, fontSize: 17, fontWeight: '800' },
    dashboardDate: { color: MUTED, fontSize: 11, marginTop: 4 },
    livePill: {
        minHeight: 28,
        paddingHorizontal: 9,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#e8f2e9',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: GREEN,
    },
    liveText: { color: API_FOREST, fontSize: 9, fontWeight: '800' },
    statTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statCode: {
        width: 29,
        height: 29,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#edf4ee',
    },
    quickCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionHeadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionHint: {
        color: GREEN,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    stat: {
        width: '48%',
        minHeight: 96,
        padding: 12,
        borderRadius: 18,
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e8ede8',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    statValue: {
        color: INK,
        fontSize: 25,
        fontWeight: '900',
        marginTop: 9,
    },
    statLabel: { flex: 1, color: MUTED, fontSize: 10, fontWeight: '700' },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickCard: {
        width: '48%',
        minHeight: 136,
        padding: 14,
        borderRadius: 19,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e8ede8',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    quickIcon: {
        width: 38,
        height: 38,
        borderRadius: 13,
        backgroundColor: '#edf4ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickTitle: { color: INK, marginTop: 9, fontSize: 12, fontWeight: '700' },
    quickDescription: {
        color: MUTED,
        marginTop: 4,
        fontSize: 10,
        lineHeight: 14,
    },
    card: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#e8ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    cardTitle: { color: INK, fontSize: 15, fontWeight: '800', marginBottom: 8 },
    sectionCount: { color: MUTED, fontSize: 11, fontWeight: '600' },
    keyRow: {
        minHeight: 39,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#edf0ed',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    keyLabel: { flex: 1, color: MUTED, fontSize: 11 },
    keyValue: {
        flex: 1.2,
        color: INK,
        textAlign: 'right',
        fontSize: 12,
        fontWeight: '600',
    },
    relatedRow: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#edf0ed',
    },
    recordTitle: { color: INK, fontSize: 13, fontWeight: '700' },
    recordCode: { color: MUTED, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 3 },
    mutedSmall: { color: MUTED, fontSize: 10, lineHeight: 15, marginTop: 4 },
    muted: { color: MUTED, fontSize: 12, lineHeight: 18 },
    recordCard: {
        marginTop: 9,
        padding: 15,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e8ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    recordTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    status: {
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 4,
        marginTop: 8,
        borderRadius: 18,
        backgroundColor: '#edf4ed',
        color: API_FOREST,
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    statusPositive: { color: '#1f6541', backgroundColor: '#e6f3e9' },
    statusAttention: { color: '#805d12', backgroundColor: '#fbf2d9' },
    statusNegative: { color: '#9a3c35', backgroundColor: '#fbe9e7' },
    statusNeutral: { color: '#58655c', backgroundColor: '#edf0ed' },
    featureCard: {
        minHeight: 76,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e8ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    collectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    collectionHeaderIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#e8f0e8', alignItems: 'center', justifyContent: 'center' },
    collectionTitle: { color: INK, fontSize: 19, fontWeight: '800' },
    rowIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#edf4ee', alignItems: 'center', justifyContent: 'center' },
    featureIcon: {
        width: 43,
        height: 43,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#edf4ee',
    },
    bottomBar: {
        minHeight: 68,
        paddingTop: 4,
        paddingBottom: 4,
        borderTopWidth: 1,
        borderTopColor: '#e5eae5',
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    bottomItem: {
        minWidth: 76,
        minHeight: 54,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    bottomIcon: {
        minWidth: 50,
        height: 31,
        paddingHorizontal: 13,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomIconActive: { backgroundColor: '#e8f0e8' },
    bottomLabel: {
        color: MUTED,
        marginTop: 1,
        fontSize: 10,
        fontWeight: '600',
    },
    bottomLabelActive: { color: API_FOREST, fontWeight: '800' },
    primary: {
        minHeight: 47,
        marginTop: 10,
        paddingHorizontal: 15,
        borderRadius: 13,
        backgroundColor: API_FOREST,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    secondary: {
        minHeight: 41,
        marginTop: 6,
        paddingHorizontal: 13,
        borderWidth: 1,
        borderColor: '#dce5dc',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryText: { color: API_FOREST, fontSize: 11, fontWeight: '700' },
    pressed: { opacity: 0.72 },
    notice: {
        marginTop: 10,
        padding: 11,
        borderRadius: 12,
        color: '#52655a',
        backgroundColor: '#e9f0e9',
        fontSize: 11,
        lineHeight: 17,
    },
    summaryStrip: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 9,
        borderRadius: 14,
        backgroundColor: '#ffffff',
    },
    summaryCell: {
        width: '50%',
        padding: 11,
        borderWidth: 0.5,
        borderColor: '#edf0ed',
    },
    summaryNumber: { color: API_FOREST, fontSize: 17, fontWeight: '800' },
    inlineEmpty: { color: MUTED, fontSize: 11, lineHeight: 17, paddingVertical: 10 },
    noticeCard: { marginBottom: 12, padding: 13, borderRadius: 15, backgroundColor: '#edf4ee', flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 8,
    },
    searchInput: { flex: 1, marginBottom: 0 },
    searchBtn: {
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 7,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e6efe6',
    },
    searchText: { color: API_FOREST, fontSize: 12, fontWeight: '700' },
    filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    filterField: { width: '48%', minWidth: 145 },
    filterLabel: { color: MUTED, fontSize: 9, fontWeight: '800', marginBottom: 4 },
    filterPicker: { minHeight: 43, overflow: 'hidden', borderWidth: 1, borderColor: '#dfe6df', borderRadius: 11, backgroundColor: '#ffffff', justifyContent: 'center' },
    filterPickerControl: { height: 45, color: INK, fontSize: 11 },
    formContent: { padding: 16, paddingBottom: 30 },
    formIntro: { padding: 15, marginBottom: 3, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8ede8' },
    reviewCard: { marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#dce8dd', backgroundColor: '#f0f6f1' },
    reviewHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    formTitle: { color: INK, fontSize: 18, fontWeight: '800', marginBottom: 4 },
    gpsAccuracy: { color: API_FOREST, fontSize: 10, fontWeight: '700', marginTop: 6 },
    locationCard: {
        marginTop: 13,
        padding: 13,
        borderRadius: 14,
        backgroundColor: '#e9f0e9',
    },
    locationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    locationIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
    coordinateText: { color: MUTED, fontSize: 10, fontWeight: '600', marginTop: 8 },
    field: { marginTop: 13 },
    fieldLabel: {
        color: '#34443a',
        marginBottom: 6,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    input: {
        minHeight: 46,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#dfe6df',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        color: INK,
        fontSize: 13,
    },
    multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
    pickerBox: {
        minHeight: 48,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#dfe6df',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
    },
    picker: { height: 50, color: INK },
    toggle: {
        minHeight: 50,
        marginTop: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e1e7e1',
        borderRadius: 13,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
    },
    hint: { color: MUTED, fontSize: 10, marginBottom: 6 },
    photoPreview: {
        width: '100%',
        height: 170,
        marginBottom: 7,
        borderRadius: 13,
    },
    imageActions: { flexDirection: 'row', gap: 8 },
    inline: { flexDirection: 'row', gap: 18, marginTop: 8 },
    link: { alignSelf: 'flex-start', paddingVertical: 8 },
    linkText: { color: API_FOREST, fontSize: 11, fontWeight: '700' },
    errorText: { color: '#a33c32', fontSize: 12, marginTop: 10 },
    entity: {
        marginBottom: 12,
        padding: 15,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#e5eae5',
        backgroundColor: '#ffffff',
    },
    entityTitle: {
        color: INK,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 5,
    },
    entityTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    entityPhoto: {
        width: '100%',
        height: 170,
        borderRadius: 13,
        marginBottom: 12,
        backgroundColor: '#e6ece6',
    },
    empty: { alignItems: 'center', padding: 40 },
    setupCard: { marginTop: 17, padding: 19, borderRadius: 22, borderWidth: 1, borderColor: '#e5ebe5', backgroundColor: '#ffffff' },
    setupIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#eaf2eb', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    accountInfo: { minHeight: 44, paddingHorizontal: 11, marginTop: 15, borderRadius: 13, backgroundColor: '#f5f8f5', flexDirection: 'row', alignItems: 'center', gap: 9 },
    accountInfoText: { color: INK, fontSize: 12, fontWeight: '700' },
    setupNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf0ed' },
    setupNoteText: { flex: 1, color: MUTED, fontSize: 10, lineHeight: 15 },
    moduleHero: { alignItems: 'center', padding: 22, borderRadius: 24, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8ede8' },
    moduleIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#e8f0e8', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    moduleEyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
    moduleTitle: { color: INK, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8, marginBottom: 7 },
    comingSoonPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: '#f1f3ee', marginTop: 15 },
    comingSoonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a58d44' },
    comingSoonText: { color: '#71663d', fontSize: 10, fontWeight: '800' },
    progressTrack: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
    progressStep: { flex: 1, alignItems: 'center', gap: 6 },
    progressDot: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: '#dce5dc', backgroundColor: '#f5f7f4', alignItems: 'center', justifyContent: 'center' },
    progressDotDone: { backgroundColor: API_FOREST, borderColor: API_FOREST },
    progressDotActive: { backgroundColor: '#e8f0e8', borderColor: GREEN },
    progressNumber: { color: MUTED, fontSize: 10, fontWeight: '700' },
    progressNumberActive: { color: API_FOREST },
    progressLabel: { color: MUTED, fontSize: 9 },
    progressLabelActive: { color: API_FOREST, fontWeight: '800' },
    boundaryIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#edf4ee', alignItems: 'center', justifyContent: 'center' },
    boundaryPreview: { overflow: 'hidden', marginTop: 10, borderRadius: 14, backgroundColor: '#f7faf7' },
    boundaryFacts: { flexDirection: 'row', paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#edf0ed' },
    boundaryFact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    boundaryValue: { color: INK, fontSize: 11, fontWeight: '800', textAlign: 'center' },
    linkedFarmer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e5eae5', backgroundColor: '#ffffff' },
    linkedFarmerIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#edf4ee', alignItems: 'center', justifyContent: 'center' },
    heading: { color: INK, fontSize: 18, fontWeight: '700', marginBottom: 6 },
    loginSafe: { flex: 1, backgroundColor: CANVAS },
    loginWrap: {
        width: '100%',
        maxWidth: 470,
        flexGrow: 1,
        alignSelf: 'center',
        justifyContent: 'center',
        padding: 22,
    },
    loginBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        marginBottom: 18,
        paddingHorizontal: 3,
    },
    loginLogo: {
        width: 52,
        height: 52,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: API_FOREST,
    },
    loginLogoText: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
    loginLogoImage: { width: 176, height: 48 },
    loginBrandCopy: { flex: 1 },
    loginName: {
        color: INK,
        fontSize: 22,
        fontWeight: '800',
    },
    loginTagline: { color: MUTED, fontSize: 11, marginTop: 3 },
    loginCard: {
        padding: 22,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#e8ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 18,
        elevation: 3,
    },
    loginHeading: { color: INK, fontSize: 21, fontWeight: '800' },
    loginHelp: { color: MUTED, fontSize: 12, marginTop: 6, marginBottom: 8 },
    loginFoot: {
        color: MUTED,
        textAlign: 'center',
        marginTop: 17,
        fontSize: 10,
    },
});
