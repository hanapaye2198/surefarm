import {
    createElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentProps,
} from 'react';
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
    Text as NativeText,
    TextInput as NativeTextInput,
    View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import BoundaryMap, { type BoundaryPoint } from './src/BoundaryMap';
import FarmAssignmentMap, { type FarmPin } from './src/FarmAssignmentMap';
import { withoutDemoWordText } from './src/displayText';
import { ApiError, apiRequest, API_URL, SITE_URL } from './src/api';
import {
    formForPage,
    initialFieldValues,
    optionList,
    type FieldSpec,
    type FormSpec,
} from './src/forms';

type Role =
    | 'admin'
    | 'operations'
    | 'field_verifier'
    | 'cooperative_officer'
    | 'farmer';
type User = {
    id: number;
    name: string;
    email: string;
    role: Role;
    farmer_profile_linked?: boolean;
};
type Page = { component: string; data: Record<string, any> };
type Screen = { path: string; title: string };
const ICONS = {
    dashboard: 'view-dashboard-outline',
    farmers: 'account-group-outline',
    farms: 'map-marker-radius-outline',
    verification: 'clipboard-check-outline',
    activities: 'format-list-bulleted',
    production: 'sprout',
    harvest: 'barley',
    inventory: 'package-variant-closed',
    processing: 'factory',
    traceability: 'barcode-scan',
    cooperatives: 'domain',
    cropManagement: 'leaf',
    finance: 'cash-multiple',
    insurance: 'shield-check-outline',
    logistics: 'truck-delivery-outline',
    reports: 'chart-box-outline',
    activityTypes: 'clipboard-list-outline',
    home: 'home-outline',
    features: 'view-grid-outline',
    account: 'account-circle-outline',
    arrowRight: 'arrow-right',
    chevronRight: 'chevron-right',
    empty: 'text-box-search-outline',
    pending: 'clock-outline',
    inProgress: 'progress-clock',
    failed: 'close-circle-outline',
    needsReview: 'alert-circle-outline',
    verified: 'check-decagram-outline',
    back: 'arrow-left',
    signOut: 'logout',
    search: 'magnify',
    leaf: 'leaf',
    location: 'map-marker',
    calendar: 'calendar-month-outline',
    shield: 'shield-check-outline',
    info: 'information-outline',
    lock: 'lock-outline',
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

const APP_FONT_FAMILY = 'Proxima Nova';

type BoundaryDraft = {
    points: [number, number][];
    accuracies: (number | null)[];
    capturedAt: string[];
};

const boundaryDraftWriteQueue = new Map<string, Promise<void>>();
const BOUNDARY_DRAFT_CHUNK_SIZE = 1500;

function isBoundaryDraft(value: unknown): value is BoundaryDraft {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Partial<BoundaryDraft>;
    if (
        !Array.isArray(draft.points) ||
        !Array.isArray(draft.accuracies) ||
        !Array.isArray(draft.capturedAt) ||
        draft.points.length < 1 ||
        draft.points.length > 1000 ||
        draft.accuracies.length !== draft.points.length ||
        draft.capturedAt.length !== draft.points.length
    )
        return false;

    return draft.points.every(
        (point) =>
            Array.isArray(point) &&
            point.length === 2 &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]) &&
            Math.abs(point[0]) <= 180 &&
            Math.abs(point[1]) <= 90,
    ) && draft.accuracies.every(
        (accuracy) =>
            accuracy === null ||
            (typeof accuracy === 'number' &&
                Number.isFinite(accuracy) &&
                accuracy >= 0 &&
                accuracy <= 1000),
    ) && draft.capturedAt.every(
        (capturedAt) =>
            typeof capturedAt === 'string' &&
            !Number.isNaN(Date.parse(capturedAt)),
    );
}

async function getBoundaryDraftItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
        return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
}

async function setBoundaryDraftItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
        if (typeof window === 'undefined') throw new Error('Local storage is unavailable.');
        window.localStorage.setItem(key, value);
        return;
    }

    await SecureStore.setItemAsync(key, value);
}

async function removeBoundaryDraftItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        return;
    }

    await SecureStore.deleteItemAsync(key);
}

async function readBoundaryDraft(key: string): Promise<BoundaryDraft | null> {
    const rawManifest = await getBoundaryDraftItem(`${key}:manifest`);
    if (!rawManifest) return null;

    const manifest = JSON.parse(rawManifest) as {
        generation?: unknown;
        chunks?: unknown;
    };
    if (
        typeof manifest.generation !== 'string' ||
        !Number.isInteger(manifest.chunks) ||
        Number(manifest.chunks) < 1 ||
        Number(manifest.chunks) > 1000
    )
        throw new Error('The saved GPS draft is incomplete.');

    const chunks: string[] = [];
    for (let index = 0; index < Number(manifest.chunks); index += 1) {
        const chunk = await getBoundaryDraftItem(
            `${key}:${manifest.generation}:${index}`,
        );
        if (chunk === null) throw new Error('The saved GPS draft is incomplete.');
        chunks.push(chunk);
    }

    const draft: unknown = JSON.parse(chunks.join(''));
    if (!isBoundaryDraft(draft)) throw new Error('The saved GPS draft is invalid.');
    return draft;
}

async function writeBoundaryDraft(
    key: string,
    draft: BoundaryDraft | null,
): Promise<void> {
    const rawPrevious = await getBoundaryDraftItem(`${key}:manifest`);
    let previous: { generation?: unknown; chunks?: unknown } | null = null;
    try {
        previous = rawPrevious ? JSON.parse(rawPrevious) : null;
    } catch {
        previous = null;
    }
    const previousGeneration =
        typeof previous?.generation === 'string' ? previous.generation : null;
    const previousChunkCount =
        Number.isInteger(previous?.chunks) &&
        Number(previous?.chunks) >= 1 &&
        Number(previous?.chunks) <= 1000
            ? Number(previous?.chunks)
            : 0;

    if (!draft || draft.points.length === 0) {
        await removeBoundaryDraftItem(`${key}:manifest`);
        if (previousGeneration && previousChunkCount > 0) {
            await Promise.all(
                Array.from({ length: previousChunkCount }, (_, index) =>
                    removeBoundaryDraftItem(
                        `${key}:${previousGeneration}:${index}`,
                    ),
                ),
            );
        }
        return;
    }

    const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const serialized = JSON.stringify(draft);
    const chunks: string[] = [];
    for (let index = 0; index < serialized.length; index += BOUNDARY_DRAFT_CHUNK_SIZE) {
        chunks.push(serialized.slice(index, index + BOUNDARY_DRAFT_CHUNK_SIZE));
    }

    for (const [index, chunk] of chunks.entries()) {
        await setBoundaryDraftItem(`${key}:${generation}:${index}`, chunk);
    }
    await setBoundaryDraftItem(
        `${key}:manifest`,
        JSON.stringify({ generation, chunks: chunks.length }),
    );

    if (previousGeneration && previousChunkCount > 0) {
        await Promise.all(
            Array.from({ length: previousChunkCount }, (_, index) =>
                removeBoundaryDraftItem(
                    `${key}:${previousGeneration}:${index}`,
                ).catch(() => undefined),
            ),
        );
    }
}

async function enqueueBoundaryDraftWrite(
    key: string,
    draft: BoundaryDraft | null,
): Promise<void> {
    const previous = boundaryDraftWriteQueue.get(key) ?? Promise.resolve();
    const next = previous
        .catch(() => undefined)
        .then(() => writeBoundaryDraft(key, draft));
    boundaryDraftWriteQueue.set(key, next);

    try {
        await next;
    } finally {
        if (boundaryDraftWriteQueue.get(key) === next)
            boundaryDraftWriteQueue.delete(key);
    }
}

function imageCaptureTimestamp(
    asset: ImagePicker.ImagePickerAsset,
): string | null {
    const metadata = asset.exif;
    if (!metadata || typeof metadata !== 'object') return null;

    const raw =
        metadata.DateTimeOriginal ??
        metadata.DateTimeDigitized ??
        metadata.DateTime;
    if (typeof raw !== 'string') return null;

    const match = raw.match(
        /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    );
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const capturedAt = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    );

    return Number.isNaN(capturedAt.getTime()) ? null : capturedAt.toISOString();
}

function exifNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object' && 'numerator' in value) {
        const rational = value as { numerator?: unknown; denominator?: unknown };
        const numerator = exifNumber(rational.numerator);
        const denominator = exifNumber(rational.denominator);
        return numerator === null || denominator === null || denominator === 0
            ? null
            : numerator / denominator;
    }
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    const fraction = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (fraction) {
        const denominator = Number(fraction[2]);
        return denominator === 0 ? null : Number(fraction[1]) / denominator;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function imageCaptureCoordinates(
    asset: ImagePicker.ImagePickerAsset,
): { latitude: number; longitude: number } | null {
    const metadata = asset.exif;
    if (!metadata || typeof metadata !== 'object') return null;

    const exif = metadata as Record<string, unknown>;
    const coordinate = (value: unknown, reference: unknown): number | null => {
        const parts = Array.isArray(value)
            ? value.map(exifNumber)
            : typeof value === 'string' && value.includes(',')
              ? value.split(',').map(exifNumber)
              : [exifNumber(value)];

        if (parts.some((part) => part === null)) return null;

        const numbers = parts as number[];
        const degrees = numbers.length >= 3
            ? numbers[0] + numbers[1] / 60 + numbers[2] / 3600
            : numbers[0];
        const hemisphere = typeof reference === 'string' ? reference.toUpperCase() : '';
        const signed = hemisphere === 'S' || hemisphere === 'W' ? -degrees : degrees;

        return Number.isFinite(signed) ? signed : null;
    };

    const latitude = coordinate(exif.GPSLatitude, exif.GPSLatitudeRef);
    const longitude = coordinate(exif.GPSLongitude, exif.GPSLongitudeRef);

    return latitude === null || longitude === null
        ? null
        : { latitude, longitude };
}

function withoutDemoWords(
    value: ComponentProps<typeof NativeText>['children'],
): ComponentProps<typeof NativeText>['children'] {
    if (typeof value === 'string') return withoutDemoWordText(value);

    if (Array.isArray(value)) {
        return value.map((child) => withoutDemoWords(child));
    }

    return value;
}

function Text(props: ComponentProps<typeof NativeText>) {
    return (
        <NativeText
            {...props}
            accessibilityHint={withoutDemoWordText(props.accessibilityHint)}
            accessibilityLabel={withoutDemoWordText(props.accessibilityLabel)}
            style={[{ fontFamily: APP_FONT_FAMILY }, props.style]}
        >
            {withoutDemoWords(props.children)}
        </NativeText>
    );
}

function TextInput(props: ComponentProps<typeof NativeTextInput>) {
    return (
        <NativeTextInput
            {...props}
            accessibilityHint={withoutDemoWordText(props.accessibilityHint)}
            accessibilityLabel={withoutDemoWordText(props.accessibilityLabel)}
            defaultValue={withoutDemoWordText(props.defaultValue)}
            placeholder={withoutDemoWordText(props.placeholder)}
            style={[{ fontFamily: APP_FONT_FAMILY }, props.style]}
            value={withoutDemoWordText(props.value)}
        />
    );
}

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
const CANVAS = '#f6f8f6';
const INK = '#1d2c23';
const MUTED = '#6f7d73';

function AppIcon({
    name,
    size = 20,
    color = API_FOREST,
}: {
    name: IconName;
    size?: number;
    color?: string;
}) {
    return (
        <MaterialCommunityIcons name={ICONS[name]} size={size} color={color} />
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
        path: '/cooperatives',
        roles: ['operations', 'cooperative_officer'],
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
    cooperative_officer: 'Cooperative officer',
    farmer: 'Farmer',
};
const COLLECTION: Record<string, string> = {
    'cooperatives/index': 'cooperatives',
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
        {
            key: 'verification_status',
            label: 'Verification',
            source: 'verificationStatuses',
        },
        { key: 'status', label: 'Farm status', source: 'statuses' },
    ],
    'farm-verification/index': [
        {
            key: 'verification_status',
            label: 'Verification',
            source: 'verificationStatuses',
        },
        { key: 'crop', label: 'Crop', source: 'crops' },
        { key: 'province', label: 'Province', source: 'provinces' },
        {
            key: 'municipality',
            label: 'Municipality',
            source: 'municipalities',
        },
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
    'cooperatives/index': 'Cooperatives',
    'cooperatives/show': 'Cooperative details',
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
        Record<string, ImagePicker.ImagePickerAsset | ImagePicker.ImagePickerAsset[]>
    >({});
    const [formError, setFormError] = useState('');
    const [search, setSearch] = useState('');

    const current = stack[stack.length - 1];
    const sections = useMemo(
        () =>
            SECTIONS.filter((item) => {
                if (user?.role === 'farmer')
                    return (
                        item.key === 'dashboard' ||
                        (user.farmer_profile_linked === true &&
                            item.roles?.includes('farmer') === true)
                    );
                if (user?.role === 'field_verifier')
                    return ['dashboard', 'farm-verification'].includes(
                        item.key,
                    );
                if (user?.role === 'cooperative_officer')
                    return ['dashboard', 'cooperatives'].includes(item.key);
                return (
                    !item.roles ||
                    user?.role === 'admin' ||
                    (user && item.roles.includes(user.role))
                );
            }),
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
                if (
                    error instanceof ApiError &&
                    (error.status === 401 ||
                        ['account_suspended', 'two_factor_setup_required'].includes(
                            error.code ?? '',
                        ))
                ) {
                    await removeStoredToken().catch(() => undefined);
                    setToken(null);
                    setUser(null);
                    setPage(null);
                    setAuthError(error.message);
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
                    if (error.status === 403) setAuthError(error.message);
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

    const loadMore = async (
        path: string,
        title: string,
        collection?: string,
    ) => {
        if (!collection) {
            await navigate(path, title);
            return;
        }
        if (!token || !page || busy) return;

        setBusy(true);
        try {
            const nextPage = await apiRequest<Page>(path, token);
            const previousCollection = page.data[collection];
            const incomingCollection = nextPage.data[collection];
            if (
                page.component !== nextPage.component ||
                !Array.isArray(previousCollection?.data) ||
                !Array.isArray(incomingCollection?.data)
            ) {
                return;
            }

            setPage((currentPage) => {
                if (
                    !currentPage ||
                    currentPage.component !== nextPage.component
                ) {
                    return currentPage;
                }
                const currentCollection = currentPage.data[collection];
                if (!Array.isArray(currentCollection?.data)) return currentPage;

                return {
                    ...currentPage,
                    data: {
                        ...currentPage.data,
                        [collection]: {
                            ...incomingCollection,
                            data: [
                                ...currentCollection.data,
                                ...incomingCollection.data,
                            ],
                        },
                    },
                };
            });
        } catch (error) {
            Alert.alert(
                'Could not load more records',
                error instanceof Error ? error.message : 'Try again.',
            );
        } finally {
            setBusy(false);
        }
    };

    const openLocalForm = (component: string, data: Record<string, any>) => {
        const contextualData =
            component === 'farm-verification/inspection' &&
            page?.component === 'farm-verification/show'
                ? {
                      ...data,
                      cropLabel: page.data.farm?.crop_label,
                      boundary_revision:
                          page.data.inspection?.boundary_revision ?? 0,
                      crop_observed:
                          data.crop_observed ??
                          data.coffee_crop_observed ??
                          page.data.inspection?.checklist?.crop_observed ??
                          page.data.inspection?.checklist?.coffee_crop_observed,
                  }
                : data;
        const spec = formForPage(component, contextualData);
        if (!spec) return;
        setStack((previous) => [
            ...previous,
            { path: `local:${component}`, title: spec.title },
        ]);
        setPage({ component, data: contextualData });
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
        setSearch(
            new URLSearchParams(path.split('?')[1] ?? '').get('search') ?? '',
        );
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
                for (const [key, selection] of Object.entries(photos)) {
                    const assets = Array.isArray(selection)
                        ? selection
                        : [selection];
                    assets.forEach((asset, index) => {
                        form.append(key === 'photos' ? 'photos[]' : key, {
                            uri: asset.uri,
                            name: asset.fileName ?? `${key}-${index + 1}.jpg`,
                            type: asset.mimeType ?? 'image/jpeg',
                        } as unknown as Blob);
                    });
                }
                body = form;
            } else {
                body = Object.fromEntries(
                    Object.entries(values)
                        .filter(([key]) => spec.fields.find((field) => field.key === key)?.kind !== 'image')
                        .map(([key, value]) => [
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
            const response = await apiRequest<{ redirect_url?: string }>(
                spec.path,
                token,
                { method: requestMethod, body },
            );
            if (
                page?.data?.verificationCapture === true &&
                page.data.farmId &&
                page.data.verificationReference
            ) {
                const draftKey = `surefarm:boundary-draft:${page.data.farmId}:${page.data.verificationReference}`;
                await enqueueBoundaryDraftWrite(draftKey, null).catch(
                    () => undefined,
                );
            }
            const previousStack = stack.slice(0, -1);
            const destination = response.redirect_url
                ? nextPath(response.redirect_url)
                : null;
            const nextStack = destination
                ? [
                      ...previousStack,
                      { path: destination, title: titleFor(destination) },
                  ]
                : previousStack.length > 0
                  ? previousStack
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
                  ...(page?.component === 'farmer-profile/photo'
                      ? { cameraType: ImagePicker.CameraType.front }
                      : {}),
                  exif: true,
                  quality: 0.8,
              })
            : await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  exif: true,
                  quality: 0.8,
                  allowsMultipleSelection: field === 'photos',
                  ...(field === 'photos' ? { selectionLimit: 6 } : {}),
              });
        if (result.canceled || !result.assets[0]) return;

        const pickedAssets = field === 'photos'
            ? result.assets
            : result.assets.slice(0, 1);
        const currentSelection = photos[field];
        const currentAssets = Array.isArray(currentSelection)
            ? currentSelection
            : currentSelection
              ? [currentSelection]
              : [];
        const nextAssets = field === 'photos'
            ? [...currentAssets, ...pickedAssets].slice(0, 6)
            : pickedAssets;
        if (field === 'photos' && currentAssets.length + pickedAssets.length > 6) {
            Alert.alert('Photo limit', 'A harvest can include up to six photos.');
        }
        setPhotos((old) => ({
            ...old,
            [field]: field === 'photos' ? nextAssets : nextAssets[0],
        }));

        if (field === 'photos') {
            let oldMetadata: Record<string, unknown>[] = [];
            try {
                const parsed = JSON.parse(String(values.photos_metadata ?? '[]'));
                if (Array.isArray(parsed)) oldMetadata = parsed;
            } catch {
                oldMetadata = [];
            }
            const retainedCount = Math.min(currentAssets.length, nextAssets.length);
            const addedCount = Math.max(0, nextAssets.length - retainedCount);
            const metadata = oldMetadata.slice(0, Math.max(0, retainedCount));
            let fallbackCoordinates: { latitude: number; longitude: number } | null = null;

            if (
                camera &&
                pickedAssets.some((asset) => imageCaptureCoordinates(asset) === null)
            ) {
                try {
                    const locationPermission =
                        await Location.requestForegroundPermissionsAsync();
                    if (locationPermission.granted) {
                        const position = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.High,
                        });
                        fallbackCoordinates = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        };
                    }
                } catch {
                    // The photo is kept if device location is unavailable.
                }
            }

            for (const asset of pickedAssets.slice(0, addedCount)) {
                const coordinates =
                    imageCaptureCoordinates(asset) ??
                    (camera ? fallbackCoordinates : null);
                metadata.push({
                    captured_at:
                        imageCaptureTimestamp(asset) ??
                        (camera ? new Date().toISOString() : null),
                    latitude: coordinates?.latitude ?? null,
                    longitude: coordinates?.longitude ?? null,
                });
            }

            setValues((old) => ({
                ...old,
                photos_metadata: JSON.stringify(metadata.slice(0, nextAssets.length)),
            }));
        }

        const asset = pickedAssets[0];
        if (
            page?.component === 'farm-verification/inspection' &&
            field === 'evidence_photo'
        ) {
            const capturedAt =
                imageCaptureTimestamp(asset) ??
                (camera ? new Date().toISOString() : '');
            let coordinates = imageCaptureCoordinates(asset);

            if (coordinates === null && camera) {
                try {
                    const locationPermission =
                        await Location.requestForegroundPermissionsAsync();
                    if (locationPermission.granted) {
                        const position = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.High,
                        });
                        coordinates = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        };
                    }
                } catch {
                    // Keep the photo if location metadata is unavailable.
                }
            }

            setValues((old) => ({
                ...old,
                captured_at: capturedAt,
                ...(coordinates === null
                    ? {}
                    : {
                          latitude: coordinates.latitude.toFixed(7),
                          longitude: coordinates.longitude.toFixed(7),
                      }),
            }));
        }
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
                    style={[
                        styles.backButton,
                        stack.length === 1 && styles.brandButton,
                    ]}
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
                    <Text numberOfLines={1} style={styles.headerSub}>
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
                    key={`${current.path}:${page.data.farmId ?? ''}:${page.data.verificationReference ?? ''}`}
                    spec={spec}
                    data={page.data}
                    token={token ?? ''}
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
                    onClearImages={() => setPhotos({})}
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
                    onLocalForm={openLocalForm}
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
                    onLoadMore={(path, title, collection) =>
                        void loadMore(path, title, collection)
                    }
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
                            panel === 'page' && current.path === '/farmer/farms'
                        }
                        icon="farms"
                        onPress={() =>
                            void navigate('/farmer/farms', 'My farms')
                        }
                    />
                ) : user.role === 'farmer' ? (
                    <BottomItem
                        label="Security"
                        active={
                            panel === 'page' &&
                            current.path === '/settings/security'
                        }
                        icon="lock"
                        onPress={() =>
                            void navigate(
                                '/settings/security',
                                'Security settings',
                            )
                        }
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
                            <Text style={styles.loginTagline}>
                                Coffee farm operations
                            </Text>
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
    onLocalForm,
}: {
    page: Page;
    user: User | null;
    sections: Section[];
    onOpen: (item: Section) => void;
    onLocalForm: (component: string, data: Record<string, any>) => void;
}) {
    if (page.data.mobile_dashboard_mode === 'farmer_account_not_linked') {
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
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
                    <Text style={styles.cardTitle}>
                        Finish setting up your farm access
                    </Text>
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
                            Your sign-in is active. No other farmer’s
                            information is shown on this screen.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        );
    }

    if (page.data.mobile_dashboard_mode === 'farmer_dashboard') {
        const summary = page.data.summary ?? {};
        const farmsSection = sections.find(
            (section) => section.key === 'farmer-farms',
        );
        const activitySection = sections.find(
            (section) => section.key === 'farmer-activities',
        );
        const notificationSection = sections.find(
            (section) => section.key === 'farmer-notifications',
        );

        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <View style={styles.welcome}>
                    {page.data.farmer?.photo_url ? (
                        <Image
                            source={{ uri: page.data.farmer.photo_url }}
                            style={[
                                styles.profilePhoto,
                                { borderRadius: 36, marginBottom: 14 },
                            ]}
                            accessibilityLabel="Farmer face photo"
                        />
                    ) : (
                        <View
                            style={[
                                styles.profilePhotoPlaceholder,
                                { borderRadius: 36, marginBottom: 14 },
                            ]}
                        >
                            <AppIcon name="account" size={31} color={GREEN} />
                        </View>
                    )}
                    <Text style={styles.eyebrow}>SUREFARM · FARMER PORTAL</Text>
                    <Text style={styles.welcomeTitle}>
                        Hello,{' '}
                        {(page.data.farmer?.name ?? user?.name)?.split(
                            ' ',
                        )[0] ?? 'farmer'}
                    </Text>
                    <Text style={styles.welcomeBody}>
                        Your farms and verification updates, in one place.
                    </Text>
                    <Text
                        style={[
                            styles.recordCode,
                            { color: '#d4e3d8', marginTop: 8 },
                        ]}
                    >
                        Farmer ID /{' '}
                        {page.data.farmer?.farmer_id ?? 'Not assigned'}
                    </Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Farm verification</Text>
                    <SummaryRow
                        label="Registered farms"
                        value={summary.registered_farms ?? 0}
                    />
                    <SummaryRow
                        label="Pending"
                        value={summary.pending_verification ?? 0}
                    />
                    <SummaryRow
                        label="In progress"
                        value={summary.in_progress ?? 0}
                    />
                    <SummaryRow
                        label="Verified"
                        value={summary.verified_farms ?? 0}
                    />
                    <SummaryRow
                        label="Needs review"
                        value={summary.needs_review ?? 0}
                    />
                    <SummaryRow label="Failed" value={summary.failed ?? 0} />
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Farm area</Text>
                    <SummaryRow
                        label="Declared area"
                        value={`${Number(summary.declared_area_hectares ?? 0).toFixed(2)} ha`}
                    />
                    <SummaryRow
                        label="Verified area"
                        value={`${Number(summary.verified_area_hectares ?? 0).toFixed(2)} ha`}
                    />
                </View>
                <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                        notificationSection && onOpen(notificationSection)
                    }
                    style={({ pressed }) => [
                        styles.noticeCard,
                        pressed && styles.pressed,
                    ]}
                >
                    <AppIcon name="info" size={18} color={GREEN} />
                    <View style={styles.flex}>
                        <Text style={styles.recordTitle}>Notifications</Text>
                        <Text style={styles.mutedSmall}>
                            {page.data.unread_notifications ?? 0} unread update
                            {page.data.unread_notifications === 1 ? '' : 's'}
                        </Text>
                    </View>
                    <AppIcon name="chevronRight" size={17} color={GREEN} />
                </Pressable>
                {(page.data.recent_notifications ?? []).length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Recent updates</Text>
                        {page.data.recent_notifications.map((item: any) => (
                            <View key={item.id} style={styles.relatedRow}>
                                {item.kind === 'announcement' && (
                                    <Text style={styles.status}>
                                        Announcement
                                    </Text>
                                )}
                                <Text style={styles.recordTitle}>
                                    {item.title}
                                    {item.read ? '' : ' · New'}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.message}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.farm_name
                                        ? `${item.farm_name} · `
                                        : ''}
                                    {item.created_at}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Recent farm activities</Text>
                    {(page.data.recent_activities ?? []).length ? (
                        page.data.recent_activities.map((item: any) => (
                            <View key={item.id} style={styles.relatedRow}>
                                <Text style={styles.recordTitle}>
                                    {item.activity ?? 'Farm activity'}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.farm_name} · {item.activity_date} ·{' '}
                                    {item.status_label}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.inlineEmpty}>
                            Farm activity updates will appear here.
                        </Text>
                    )}
                </View>
                {(page.data.recent_productions ?? []).length > 0 && (
                    <Related
                        title="Recent production"
                        rows={page.data.recent_productions}
                    />
                )}
                {(page.data.recent_harvests ?? []).length > 0 && (
                    <Related
                        title="Recent harvest"
                        rows={page.data.recent_harvests}
                    />
                )}
                {farmsSection && (
                    <Primary
                        title="View my farms"
                        onPress={() => onOpen(farmsSection)}
                    />
                )}
                {activitySection && (
                    <Secondary
                        title="Activities & harvest"
                        onPress={() => onOpen(activitySection)}
                    />
                )}
            </ScrollView>
        );
    }

    const summary = page.data.summary ?? {};
    const operationsStats: {
        icon: IconName;
        label: string;
        value: string | number;
    }[] = [
        {
            icon: 'farmers',
            label: 'Farmers',
            value: summary.registered_farmers ?? 0,
        },
        { icon: 'farms', label: 'Farms', value: summary.registered_farms ?? 0 },
    ];
    const verifierStats: {
        icon: IconName;
        label: string;
        value: string | number;
    }[] = [
        {
            icon: 'farms',
            label: 'Assigned farms',
            value: summary.assigned_farms ?? 0,
        },
        {
            icon: 'calendar',
            label: 'Scheduled today',
            value: summary.scheduled_today ?? 0,
        },
        {
            icon: 'verified',
            label: 'Completed',
            value: summary.completed_farms ?? 0,
        },
        {
            icon: 'verified',
            label: 'Verified today',
            value: summary.verified_today ?? 0,
        },
    ];
    const stats =
        user?.role === 'field_verifier' ? verifierStats : operationsStats;
    const verificationStats: {
        icon: IconName;
        label: string;
        value: string | number;
        color: string;
        background: string;
    }[] = [
        {
            icon: 'pending',
            label: 'Pending',
            value: summary.pending_verification ?? 0,
            color: '#9a6810',
            background: '#fbf4e5',
        },
        {
            icon: 'inProgress',
            label: 'In progress',
            value: summary.in_progress ?? 0,
            color: '#3975ad',
            background: '#edf4fb',
        },
        {
            icon: 'verified',
            label: 'Verified',
            value: summary.verified_farms ?? 0,
            color: '#33845a',
            background: '#eaf5ee',
        },
        {
            icon: 'needsReview',
            label: 'Needs review',
            value: summary.needs_review ?? 0,
            color: '#a76522',
            background: '#fbf0e5',
        },
        {
            icon: 'failed',
            label: 'Failed',
            value: summary.failed ?? 0,
            color: '#b54740',
            background: '#fbebea',
        },
    ];
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
                {(user?.role === 'admin' || user?.role === 'operations') && (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => onLocalForm('announcements/create', {})}
                        style={({ pressed }) => [
                            styles.heroAction,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text style={styles.heroActionText}>
                            Publish farmer announcement
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
            <View style={styles.verificationSummaryCard}>
                <View style={styles.verificationSummaryHeader}>
                    <View>
                        <Text style={styles.cardTitle}>Farm verification</Text>
                        <Text style={styles.verificationSummaryHint}>
                            {user?.role === 'field_verifier'
                                ? 'Current status across assigned farms'
                                : 'Current status across registered farms'}
                        </Text>
                    </View>
                    <View style={styles.verificationSummaryIcon}>
                        <AppIcon name="verified" size={18} color={API_FOREST} />
                    </View>
                </View>
                <View style={styles.verificationSummaryGrid}>
                    {verificationStats.map(
                        ({ icon, label, value, color, background }) => (
                            <View key={label} style={styles.verificationMetric}>
                                <View
                                    style={[
                                        styles.verificationMetricIcon,
                                        { backgroundColor: background },
                                    ]}
                                >
                                    <AppIcon
                                        name={icon}
                                        size={15}
                                        color={color}
                                    />
                                </View>
                                <View style={styles.verificationMetricCopy}>
                                    <Text
                                        style={styles.verificationMetricLabel}
                                    >
                                        {label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.verificationMetricValue,
                                            { color },
                                        ]}
                                    >
                                        {String(value)}
                                    </Text>
                                </View>
                            </View>
                        ),
                    )}
                </View>
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
            {user?.role !== 'field_verifier' &&
                (page.data.boundary_update_requests ?? []).length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            Boundary review requests
                        </Text>
                        {page.data.boundary_update_requests.map((item: any) => (
                            <Pressable
                                key={item.id}
                                onPress={() =>
                                    onOpen({
                                        key: 'farms',
                                        title: item.farm_name ?? 'Farm record',
                                        path: `/farms/${item.farm_id}`,
                                        icon: 'farms',
                                        description: '',
                                    })
                                }
                                style={({ pressed }) => [
                                    styles.relatedRow,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.recordTitle}>
                                    {item.farm_name} · {item.farm_code}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.farmer_name} · {item.created_at}
                                </Text>
                                <Text style={styles.muted}>{item.reason}</Text>
                                <Text style={styles.status}>
                                    Open farm record
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            {user?.role === 'field_verifier' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Today’s scheduled farms</Text>
                    {(page.data.today_assignments ?? []).length ? (
                        page.data.today_assignments.map((farm: any) => (
                            <Pressable
                                key={farm.id}
                                onPress={() =>
                                    onOpen({
                                        key: 'farm-verification',
                                        title: farm.farm_name,
                                        path: `/farm-verification/${farm.id}`,
                                        icon: 'verification',
                                        description: '',
                                    })
                                }
                                style={({ pressed }) => [
                                    styles.relatedRow,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.recordTitle}>
                                    {farm.farm_name}
                                </Text>
                                <Text style={styles.recordCode}>
                                    {farm.farm_id} · {farm.scheduled_for}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {farm.farmer_name ?? 'Farmer'} · {farm.location}
                                </Text>
                                <VerificationProgress
                                    status={farm.verification_status}
                                />
                            </Pressable>
                        ))
                    ) : (
                        <Text style={styles.inlineEmpty}>
                            No farm visits are scheduled for today.
                        </Text>
                    )}
                </View>
            )}
            {user?.role === 'field_verifier' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Assigned farm map</Text>
                    <Text style={styles.mutedSmall}>
                        Tap a marker to open its verification record.
                    </Text>
                    <FarmAssignmentMap
                        farms={page.data.assigned_farms_map ?? []}
                        apiKey={page.data.google_maps_api_key}
                        onSelect={(farm: FarmPin) =>
                            onOpen({
                                key: 'farm-verification',
                                title: farm.farm_name,
                                path: `/farm-verification/${farm.id}`,
                                icon: 'verification',
                                description: '',
                            })
                        }
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        {[
                            ['Pending', '#d69219'],
                            ['In progress', '#4384d5'],
                            ['Verified', '#348758'],
                            ['Failed', '#c74848'],
                            ['Needs review', '#bd6c25'],
                        ].map(([label, color]) => (
                            <View
                                key={label}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                }}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: color,
                                    }}
                                />
                                <Text style={styles.mutedSmall}>{label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            {user?.role === 'field_verifier' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Assigned farms</Text>
                    {(page.data.assigned_farms_preview ?? []).length ? (
                        page.data.assigned_farms_preview.map((farm: any) => (
                            <Pressable
                                key={farm.id}
                                onPress={() =>
                                    onOpen({
                                        key: 'farm-verification',
                                        title: farm.farm_name,
                                        path: `/farm-verification/${farm.id}`,
                                        icon: 'verification',
                                        description: '',
                                    })
                                }
                                style={({ pressed }) => [
                                    styles.relatedRow,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.recordTitle}>
                                    {farm.farm_name}
                                </Text>
                                <Text style={styles.recordCode}>
                                    {farm.farm_id}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {farm.farmer_name} · {farm.location}
                                </Text>
                                <VerificationProgress
                                    status={farm.verification_status}
                                />
                            </Pressable>
                        ))
                    ) : (
                        <Text style={styles.inlineEmpty}>
                            Assigned farms will appear here.
                        </Text>
                    )}
                    {verificationWorkspace && (
                        <Secondary
                            title="Open assigned-farm queue"
                            onPress={() => onOpen(verificationWorkspace)}
                        />
                    )}
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
    onLoadMore: (path: string, title: string, collection?: string) => void;
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

    if (page.component === 'cooperatives/show') {
        const cooperative = page.data.cooperative ?? {};
        const stats = page.data.stats ?? {};
        const memberships = page.data.memberships ?? {};
        const members: any[] = Array.isArray(memberships.data)
            ? memberships.data
            : [];
        const officers: any[] = Array.isArray(page.data.officers)
            ? page.data.officers
            : [];
        const history: any[] = Array.isArray(page.data.history)
            ? page.data.history
            : [];

        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {cooperative.name ?? 'Cooperative'}
                    </Text>
                    <Text style={styles.mutedSmall}>
                        {[cooperative.code, cooperative.status_label]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Overview</Text>
                    <SummaryRow
                        label="Active members"
                        value={stats.active_members ?? 0}
                    />
                    <SummaryRow
                        label="Suspended memberships"
                        value={stats.suspended_members ?? 0}
                    />
                    <SummaryRow
                        label="Ended memberships"
                        value={stats.ended_members ?? 0}
                    />
                    <SummaryRow label="Farms" value={stats.farms ?? 0} />
                    <SummaryRow
                        label="Verified farms"
                        value={stats.verified_farms ?? 0}
                    />
                    <SummaryRow
                        label="Activities in period"
                        value={stats.activities ?? 0}
                    />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Completed harvest</Text>
                    {(page.data.harvests ?? []).length === 0 ? (
                        <Text style={styles.mutedSmall}>
                            No completed harvest is recorded for this period.
                        </Text>
                    ) : (
                        (page.data.harvests as any[]).map((harvest, index) => (
                            <Text
                                key={`${harvest.unit}-${index}`}
                                style={styles.muted}
                            >
                                {harvest.label}
                            </Text>
                        ))
                    )}
                    <Text style={[styles.mutedSmall, { marginTop: 8 }]}>
                        Quantities remain in their recorded units.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Members</Text>
                    {members.length === 0 ? (
                        <Text style={styles.mutedSmall}>
                            No memberships match this view.
                        </Text>
                    ) : (
                        members.map((member) => (
                            <View key={member.id} style={styles.relatedRow}>
                                <Text style={styles.recordTitle}>
                                    {member.farmer_name}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {[
                                        member.farmer_code,
                                        member.province,
                                        member.status_label,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {member.joined_on
                                        ? `Joined ${member.joined_on}`
                                        : member.origin}
                                </Text>
                            </View>
                        ))
                    )}
                    {memberships.next_page_url && (
                        <Secondary
                            title="Load more members"
                            onPress={() =>
                                props.onLoadMore(
                                    nextPath(memberships.next_page_url),
                                    'Cooperative details',
                                    'memberships',
                                )
                            }
                        />
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Officers</Text>
                    {officers.length === 0 ? (
                        <Text style={styles.mutedSmall}>
                            No active officers are assigned.
                        </Text>
                    ) : (
                        officers.map((officer) => (
                            <View key={officer.id} style={styles.relatedRow}>
                                <Text style={styles.recordTitle}>
                                    {officer.name}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    Assigned {officer.assigned_on}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

                {history.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Recent history</Text>
                        {history.map((event) => (
                            <View key={event.id} style={styles.relatedRow}>
                                <Text style={styles.muted}>{event.summary}</Text>
                                <Text style={styles.mutedSmall}>
                                    {[event.actor, event.created_at]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-farms') {
        const farms: any[] = page.data.farms ?? [];
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>My registered farms</Text>
                    <Text style={styles.mutedSmall}>
                        Declared, GPS measured, and verified area are shown
                        separately.
                    </Text>
                </View>
                {farms.length === 0 ? (
                    <EmptyState
                        title="No farms linked yet"
                        message="Your registered farms will appear here."
                    />
                ) : (
                    farms.map((farm) => (
                        <Pressable
                            key={farm.id}
                            onPress={() =>
                                props.onOpen(
                                    `/farmer/farms/${farm.id}`,
                                    farm.farm_name,
                                )
                            }
                            style={({ pressed }) => [
                                styles.card,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.recordTitle}>
                                {farm.farm_name}
                            </Text>
                            <Text style={styles.recordCode}>
                                {farm.farm_id} · {farm.crop}
                            </Text>
                            <SummaryRow
                                label="Declared"
                                value={farm.declared_area}
                            />
                            <SummaryRow
                                label="GPS measured"
                                value={farm.measured_area ?? 'Not measured'}
                            />
                            <SummaryRow
                                label="Verified area"
                                value={farm.verified_area ?? 'Not verified'}
                            />
                            <SummaryRow
                                label="Farm status"
                                value={String(
                                    farm.status ?? 'unknown',
                                ).replaceAll('_', ' ')}
                            />
                            <VerificationProgress
                                status={farm.verification_status}
                            />
                            <Text style={styles.mutedSmall}>
                                {farm.location}
                            </Text>
                        </Pressable>
                    ))
                )}
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-farm') {
        const farm = page.data.farm ?? {};
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <View style={styles.card}>
                    <Text style={styles.recordTitle}>{farm.farm_name}</Text>
                    <Text style={styles.recordCode}>
                        {farm.farm_id} · {farm.crop}
                    </Text>
                    <Text style={styles.muted}>{farm.location}</Text>
                    <VerificationProgress status={farm.verification_status} />
                    <SummaryRow
                        label="Farm status"
                        value={String(farm.status ?? 'unknown').replaceAll(
                            '_',
                            ' ',
                        )}
                    />
                    <SummaryRow
                        label="Declared area"
                        value={farm.declared_area}
                    />
                    <SummaryRow
                        label="GPS measured area"
                        value={farm.measured_area ?? 'Not measured'}
                    />
                    <SummaryRow
                        label="Verified area"
                        value={farm.verified_area ?? 'Not verified'}
                    />
                </View>
                {farm.drone_image_url && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Farm photo</Text>
                        <Image
                            source={{ uri: farm.drone_image_url }}
                            style={{
                                width: '100%',
                                height: 210,
                                borderRadius: 14,
                                backgroundColor: '#e6ece6',
                            }}
                            resizeMode="cover"
                            accessibilityLabel="Farm aerial photo"
                        />
                    </View>
                )}
                {page.data.comparison && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Area comparison</Text>
                        <SummaryRow
                            label="Declared"
                            value={page.data.comparison.declared}
                        />
                        <SummaryRow
                            label="Measured"
                            value={page.data.comparison.measured}
                        />
                        <SummaryRow
                            label="Difference"
                            value={page.data.comparison.difference}
                        />
                        <SummaryRow
                            label="Variance"
                            value={page.data.comparison.variance}
                        />
                    </View>
                )}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Declared area history</Text>
                    {(page.data.area_declarations ?? []).length > 0 ? (
                        page.data.area_declarations.map((entry: any) => {
                            const title =
                                entry.event_type === 'legacy_baseline'
                                    ? 'Baseline at history rollout'
                                    : entry.event_type === 'initial'
                                      ? 'Initial declaration'
                                      : 'Declared area updated';
                            const previous =
                                entry.previous_area_hectares == null
                                    ? 'No earlier value recorded'
                                    : `${Number(entry.previous_area_hectares).toFixed(2)} ha`;

                            return (
                                <View
                                    key={`area-declaration-${entry.id}`}
                                    style={styles.relatedRow}
                                >
                                    <Text style={styles.recordTitle}>{title}</Text>
                                    <Text style={styles.mutedSmall}>
                                        {previous} {'→'}{' '}
                                        {Number(entry.declared_area_hectares).toFixed(2)} ha
                                    </Text>
                                    <Text style={styles.mutedSmall}>
                                        {entry.recorded_at ?? 'Date not recorded'}
                                        {' · '}
                                        {entry.recorded_by ?? 'System baseline'}
                                    </Text>
                                </View>
                            );
                        })
                    ) : (
                        <Text style={styles.inlineEmpty}>
                            No declared area changes have been recorded.
                        </Text>
                    )}
                </View>
                {page.data.boundary && (
                    <BoundaryCard
                        boundary={page.data.boundary}
                        apiKey={page.data.google_maps_api_key}
                        title={
                            farm.verification_status === 'verified'
                                ? 'Official verified boundary'
                                : 'Saved GPS boundary'
                        }
                    />
                )}
                {farm.verification_status === 'verified' &&
                    page.data.boundary && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>
                                Boundary correction
                            </Text>
                            {page.data.boundary_update_request?.status ===
                            'pending' ? (
                                <Text style={styles.mutedSmall}>
                                    Your review request was submitted on{' '}
                                    {
                                        page.data.boundary_update_request
                                            .created_at
                                    }
                                    . SureFarm staff will review it.
                                </Text>
                            ) : (
                                <>
                                    {page.data.boundary_update_request
                                        ?.status === 'addressed' && (
                                        <Text style={styles.mutedSmall}>
                                            Your previous request was addressed
                                            on{' '}
                                            {
                                                page.data
                                                    .boundary_update_request
                                                    .resolved_at
                                            }
                                            .
                                        </Text>
                                    )}
                                    <Text style={styles.mutedSmall}>
                                        Ask SureFarm staff to review the
                                        official boundary. This will not change
                                        the saved boundary.
                                    </Text>
                                    <Secondary
                                        title="Request boundary review"
                                        onPress={() =>
                                            props.onLocalForm(
                                                'farmer-boundary-update/request',
                                                {
                                                    farmId: farm.id,
                                                    farmName: farm.farm_name,
                                                },
                                            )
                                        }
                                    />
                                </>
                            )}
                        </View>
                    )}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Recent farm activities</Text>
                    {(page.data.activities ?? []).length > 0 ? (
                        page.data.activities.map((item: any) => (
                            <View
                                key={`farm-activity-${item.id}`}
                                style={styles.relatedRow}
                            >
                                <Text style={styles.recordTitle}>
                                    {item.activity_type ??
                                        item.description ??
                                        'Farm activity'}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.activity_date ?? 'Date not recorded'}{' '}
                                    · {item.status_label ?? item.status}
                                </Text>
                                {item.remarks ? (
                                    <Text style={styles.mutedSmall}>
                                        {item.remarks}
                                    </Text>
                                ) : null}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.inlineEmpty}>
                            No activities recorded for this farm yet.
                        </Text>
                    )}
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Recent harvests</Text>
                    {(page.data.harvests ?? []).length > 0 ? (
                        page.data.harvests.map((item: any) => (
                            <View
                                key={`farm-harvest-${item.id}`}
                                style={styles.relatedRow}
                            >
                                <Text style={styles.recordTitle}>
                                    {item.quantity_label ??
                                        `${item.quantity ?? 0} ${item.unit ?? ''}`}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.harvest_date ?? 'Date not recorded'} ·{' '}
                                    {item.status_label ?? item.status}
                                    {item.quality_grade
                                        ? ` · ${item.quality_grade}`
                                        : ''}
                                </Text>
                                {item.coffee_variety ? (
                                    <SummaryRow
                                        label="Coffee variety"
                                        value={item.coffee_variety}
                                    />
                                ) : null}
                                {item.estimated_green_bean_quantity_kg != null ? (
                                    <SummaryRow
                                        label="Estimated green beans"
                                        value={`${item.estimated_green_bean_quantity_kg} kg`}
                                    />
                                ) : null}
                                {(item.photos ?? []).length > 0 && (
                                    <ScrollView horizontal style={styles.evidenceGrid}>
                                        {item.photos.map((photo: any) => (
                                            <View key={photo.id} style={styles.evidenceItem}>
                                                <Image
                                                    source={{ uri: photo.url }}
                                                    style={[styles.evidenceImage, { width: 112, height: 92 }]}
                                                />
                                                {photo.captured_at ? (
                                                    <Text style={styles.mutedSmall}>
                                                        {new Date(photo.captured_at).toLocaleDateString()}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                                {item.notes ? (
                                    <Text style={styles.mutedSmall}>
                                        {item.notes}
                                    </Text>
                                ) : null}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.inlineEmpty}>
                            No harvest records for this farm yet.
                        </Text>
                    )}
                </View>
                <VerificationHistory
                    title="Verification history"
                    rows={page.data.history ?? []}
                    token={props.token}
                />
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-activities') {
        const activitiesPage = page.data.activities;
        const harvestsPage = page.data.harvests;
        const productionsPage = page.data.productions;
        const activities: any[] = collectionRows(activitiesPage);
        const harvests: any[] = collectionRows(harvestsPage);
        const productions: any[] = collectionRows(productionsPage);
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <Text style={styles.cardTitle}>Farm activities</Text>
                {page.data.farms?.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.mutedSmall}>
                            Keep your farm records up to date.
                        </Text>
                        <Primary
                            title="Record an activity"
                            onPress={() =>
                                props.onLocalForm('farmer/activity', {
                                    farms: page.data.farms,
                                    activityTypes: page.data.activityTypes ?? [],
                                    activityStatuses:
                                        page.data.activityStatuses ?? [],
                                    units: page.data.units ?? [],
                                    today: page.data.today,
                                })
                            }
                        />
                        <Secondary
                            title="Record a harvest"
                            onPress={() =>
                                props.onLocalForm('farmer/harvest', {
                                    farms: page.data.farms,
                                    harvestStatuses:
                                        page.data.harvestStatuses ?? [],
                                    units: page.data.units ?? [],
                                    today: page.data.today,
                                })
                            }
                        />
                    </View>
                )}
                {activities.length ? (
                    activities.map((item) => (
                        <View key={`activity-${item.id}`} style={styles.card}>
                            <Text style={styles.recordTitle}>
                                {item.activity ??
                                    item.description ??
                                    'Farm activity'}
                            </Text>
                            <Text style={styles.mutedSmall}>
                                {item.farm_name} · {item.activity_date ?? ''}
                            </Text>
                            <Text style={styles.muted}>
                                {item.status_label ?? item.status}
                            </Text>
                        </View>
                    ))
                ) : (
                    <EmptyState
                        title="No activities yet"
                        message="Farm activity records will appear here."
                    />
                )}
                {activitiesPage?.next_page_url && (
                    <Secondary
                        title={props.busy ? 'Loading…' : 'Load more activities'}
                        onPress={() =>
                            props.onLoadMore(
                                nextPath(activitiesPage.next_page_url),
                                'Farm activities',
                                'activities',
                            )
                        }
                    />
                )}
                <Text style={[styles.cardTitle, { marginTop: 12 }]}>
                    Harvest
                </Text>
                {harvests.length ? (
                    harvests.map((item) => (
                        <View key={`harvest-${item.id}`} style={styles.card}>
                            <Text style={styles.recordTitle}>
                                {item.farm_name}
                            </Text>
                            <SummaryRow
                                label="Harvested"
                                value={item.quantity_label ?? item.quantity}
                            />
                            <Text style={styles.mutedSmall}>
                                {item.harvest_date ?? ''} ·{' '}
                                {item.status_label ?? item.status}
                            </Text>
                            {item.coffee_variety ? (
                                <SummaryRow
                                    label="Coffee variety"
                                    value={item.coffee_variety}
                                />
                            ) : null}
                            {item.estimated_green_bean_quantity_kg != null ? (
                                <SummaryRow
                                    label="Estimated green beans"
                                    value={`${item.estimated_green_bean_quantity_kg} kg`}
                                />
                            ) : null}
                            {(item.photos ?? []).length > 0 && (
                                <ScrollView horizontal style={styles.evidenceGrid}>
                                    {item.photos.map((photo: any) => (
                                        <View key={photo.id} style={styles.evidenceItem}>
                                            <Image
                                                source={{ uri: photo.url }}
                                                style={[styles.evidenceImage, { width: 112, height: 92 }]}
                                            />
                                            {photo.captured_at ? (
                                                <Text style={styles.mutedSmall}>
                                                    {new Date(photo.captured_at).toLocaleDateString()}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    ))
                ) : (
                    <EmptyState
                        title="No harvest records yet"
                        message="Harvest records will appear here."
                    />
                )}
                {harvestsPage?.next_page_url && (
                    <Secondary
                        title={props.busy ? 'Loading…' : 'Load more harvests'}
                        onPress={() =>
                            props.onLoadMore(
                                nextPath(harvestsPage.next_page_url),
                                'Harvest',
                                'harvests',
                            )
                        }
                    />
                )}
                <Text style={[styles.cardTitle, { marginTop: 12 }]}>
                    Production
                </Text>
                {productions.length ? (
                    productions.map((item) => (
                        <View key={`production-${item.id}`} style={styles.card}>
                            <Text style={styles.recordTitle}>
                                {item.farm?.farm_name ?? 'Farm production'}
                            </Text>
                            <Text style={styles.mutedSmall}>
                                {item.crop_label} · {item.production_period}
                            </Text>
                            <SummaryRow
                                label="Expected"
                                value={item.expected_label ?? 'Not recorded'}
                            />
                            <SummaryRow
                                label="Harvested"
                                value={item.harvested_label ?? 'Not recorded'}
                            />
                            <SummaryRow
                                label="Remaining"
                                value={item.remaining_label ?? 'Not recorded'}
                            />
                            <Text style={styles.mutedSmall}>
                                {item.status_label ?? item.status}
                            </Text>
                        </View>
                    ))
                ) : (
                    <EmptyState
                        title="No production records yet"
                        message="Expected production and season records will appear here."
                    />
                )}
                {productionsPage?.next_page_url && (
                    <Secondary
                        title={props.busy ? 'Loading…' : 'Load more production'}
                        onPress={() =>
                            props.onLoadMore(
                                nextPath(productionsPage.next_page_url),
                                'Production',
                                'productions',
                            )
                        }
                    />
                )}
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-notifications') {
        const notificationsPage = page.data.notifications;
        const notifications: any[] = collectionRows(notificationsPage);
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                {notifications.length ? (
                    notifications.map((item) => (
                        <Pressable
                            key={item.id}
                            onPress={async () => {
                                if (item.read) return;
                                await apiRequest(
                                    `/farmer/notifications/${item.id}/read`,
                                    props.token,
                                    { method: 'POST' },
                                );
                                props.onOpen(
                                    '/farmer/notifications',
                                    'Notifications',
                                );
                            }}
                            style={({ pressed }) => [
                                styles.card,
                                pressed && styles.pressed,
                            ]}
                        >
                            {item.kind === 'announcement' && (
                                <Text style={styles.status}>Announcement</Text>
                            )}
                            <Text style={styles.recordTitle}>
                                {item.title}
                                {item.read ? '' : ' · New'}
                            </Text>
                            <Text style={styles.muted}>{item.message}</Text>
                            {item.farm_name ? (
                                <Text style={styles.mutedSmall}>
                                    {item.farm_name} · {item.status ?? ''}
                                </Text>
                            ) : null}
                            <Text style={styles.mutedSmall}>
                                {item.created_at}
                            </Text>
                        </Pressable>
                    ))
                ) : (
                    <EmptyState
                        title="No updates yet"
                        message="Verification updates will appear here."
                    />
                )}
                {notificationsPage?.next_page_url && (
                    <Secondary
                        title={props.busy ? 'Loading…' : 'Load more updates'}
                        onPress={() =>
                            props.onLoadMore(
                                nextPath(notificationsPage.next_page_url),
                                'Notifications',
                                'notifications',
                            )
                        }
                    />
                )}
            </ScrollView>
        );
    }

    if (page.component === 'mobile/farmer-profile') {
        const farmer = page.data.farmer ?? {};
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <View style={styles.card}>
                    <View style={styles.profileHeading}>
                        {farmer.photo_url ? (
                            <Image
                                source={{
                                    uri: farmer.photo_url,
                                    headers: {
                                        Authorization: `Bearer ${props.token}`,
                                    },
                                }}
                                style={styles.profilePhoto}
                                accessibilityLabel="Farmer face photo"
                            />
                        ) : (
                            <View style={styles.profilePhotoPlaceholder}>
                                <AppIcon
                                    name="account"
                                    size={31}
                                    color={GREEN}
                                />
                            </View>
                        )}
                        <View style={styles.flex}>
                            <Text style={styles.cardTitle}>
                                {farmer.name ?? 'Farmer profile'}
                            </Text>
                            <Text style={styles.recordCode}>
                                {farmer.farmer_id}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.sectionEyebrow}>PERSONAL DETAILS</Text>
                    <SummaryRow
                        label="First name"
                        value={farmer.first_name ?? 'Not recorded'}
                    />
                    <SummaryRow
                        label="Middle name"
                        value={farmer.middle_name ?? 'Not recorded'}
                    />
                    <SummaryRow
                        label="Last name"
                        value={farmer.last_name ?? 'Not recorded'}
                    />
                    <SummaryRow label="Suffix" value={farmer.suffix ?? '—'} />
                    <SummaryRow
                        label="Date of birth"
                        value={farmer.date_of_birth ?? 'Not recorded'}
                    />
                    <SummaryRow
                        label="Government ID"
                        value={farmer.government_id ?? 'Not recorded'}
                    />
                    <Text style={[styles.sectionEyebrow, { marginTop: 14 }]}>
                        CONTACT & LOCATION
                    </Text>
                    <SummaryRow
                        label="Email"
                        value={farmer.email ?? 'Not provided'}
                    />
                    <SummaryRow
                        label="Mobile"
                        value={farmer.mobile_number ?? 'Not provided'}
                    />
                    <SummaryRow
                        label="Address"
                        value={farmer.address ?? 'Not provided'}
                    />
                    <SummaryRow
                        label="Cooperative"
                        value={farmer.cooperative ?? 'Not linked'}
                    />
                    <SummaryRow
                        label="Spouse"
                        value={farmer.spouse ?? 'Not recorded'}
                    />
                    <Text style={[styles.sectionEyebrow, { marginTop: 14 }]}>
                        REGISTRATION CODES
                    </Text>
                    <SummaryRow
                        label="Sitio / purok"
                        value={farmer.sitio_purok_code ?? 'Not assigned'}
                    />
                    <SummaryRow
                        label="Barangay"
                        value={farmer.barangay_code ?? 'Not assigned'}
                    />
                    <SummaryRow
                        label="LGU"
                        value={farmer.lgu_code ?? 'Not assigned'}
                    />
                    <SummaryRow
                        label="Security control"
                        value={farmer.security_control_code ?? 'Not assigned'}
                    />
                    <Secondary
                        title="Update face photo"
                        onPress={() =>
                            props.onLocalForm('farmer-profile/photo', {})
                        }
                    />
                </View>
            </ScrollView>
        );
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
                                    withCollectionQuery(
                                        props.path,
                                        props.search,
                                        filterValues,
                                    ),
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
                                    withCollectionQuery(
                                        props.path,
                                        props.search,
                                        filterValues,
                                    ),
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
                                <Text style={styles.filterLabel}>
                                    {filter.label}
                                </Text>
                                <View style={styles.filterPicker}>
                                    <Picker
                                        selectedValue={String(
                                            filterValues[filter.key] ?? '',
                                        )}
                                        onValueChange={(value) =>
                                            applyFilter(
                                                filter.key,
                                                String(value),
                                            )
                                        }
                                        style={styles.filterPickerControl}
                                    >
                                        <Picker.Item
                                            label={`All ${filter.label.toLowerCase()}`}
                                            value=""
                                        />
                                        {filter.options.map((option, index) => (
                                            <Picker.Item
                                                key={`${option.value}-${index}`}
                                                label={option.label}
                                                value={option.value}
                                            />
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
                        title={
                            props.search.trim()
                                ? 'No matching records'
                                : 'No records yet'
                        }
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
                                                name={collectionIcon(
                                                    page.component,
                                                )}
                                                size={16}
                                                color={GREEN}
                                            />
                                        </View>
                                        <View style={styles.flex}>
                                            <Text style={styles.recordTitle}>
                                                {recordTitle(row)}
                                            </Text>
                                            {row.farm_id ||
                                            row.farmer_id ||
                                            row.lot_code ? (
                                                <Text style={styles.recordCode}>
                                                    {String(
                                                        row.farm_id ??
                                                            row.farmer_id ??
                                                            row.lot_code,
                                                    )}
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
                                    <Text
                                        style={[
                                            styles.status,
                                            statusStyle(
                                                String(
                                                    row.status_label ??
                                                        row.verification_status,
                                                ),
                                            ),
                                        ]}
                                    >
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
        const canVerify = ['field_verifier', 'admin'].includes(props.user.role);
        const canVerifierManageBoundary =
            canVerify &&
            ['pending', 'needs_review', 'failed', 'in_progress'].includes(
                farm.verification_status,
            );
        const inspection = page.data.inspection;
        const cropObserved =
            inspection?.checklist?.crop_observed ??
            (farm.crop_label === 'Coffee'
                ? inspection?.checklist?.coffee_crop_observed
                : undefined);
        const inspectionChecks = [
            'farm_exists',
            'location_matches',
            'crop_observed',
            'boundary_captured',
            'area_checked',
            'farmer_or_representative_met',
        ];
        const hasCompleteChecklist = inspectionChecks.every(
            (key) =>
                typeof (key === 'crop_observed'
                    ? cropObserved
                    : inspection?.checklist?.[key]) === 'boolean',
        );
        const hasFreshBoundary =
            inspection?.boundary_captured_for_attempt === true;
        const hasInspection = Boolean(
            hasFreshBoundary &&
                hasCompleteChecklist &&
                inspection?.photos?.some(
                    (photo) =>
                        photo.boundary_revision === inspection.boundary_revision,
                ),
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
                        {page.data.boundary
                            ? farm.verification_status === 'in_progress'
                                ? hasFreshBoundary
                                    ? 'Complete the field checks, attach evidence, then submit a result.'
                                    : 'Capture and save a fresh GPS boundary for this verification before completing field checks.'
                                : 'Start the field visit to open a verification session.'
                            : farm.verification_status === 'in_progress'
                              ? 'Capture and save the GPS boundary to continue this verification.'
                              : 'Start the field visit first. You can capture the GPS boundary during the session.'}
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
                            label="Difference"
                            value={page.data.comparison.difference}
                        />
                        <SummaryRow
                            label="Variance"
                            value={page.data.comparison.variance}
                        />
                    </View>
                )}
                {page.data.boundary ? (
                    <BoundaryCard
                        boundary={page.data.boundary}
                        apiKey={page.data.google_maps_api_key}
                    />
                ) : (
                    <View style={styles.noticeCard}>
                        <AppIcon name="location" size={18} color={GREEN} />
                        <View style={styles.flex}>
                            <Text style={styles.recordTitle}>
                                No GPS boundary saved
                            </Text>
                            <Text style={styles.mutedSmall}>
                                Capture the farm perimeter to calculate its
                                measured area.
                            </Text>
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
                                freshBoundaryCapture: true,
                                google_maps_api_key:
                                    page.data.google_maps_api_key,
                            })
                        }
                    />
                )}
                {canVerifierManageBoundary &&
                    farm.verification_status === 'in_progress' &&
                    (page.data.boundary ? (
                        <Secondary
                            title={
                                hasFreshBoundary
                                    ? 'Update GPS boundary'
                                    : 'Capture fresh GPS boundary'
                            }
                            onPress={() =>
                                props.onLocalForm('farm-boundary/edit', {
                                    farmId: farm.id,
                                    hasBoundary: true,
                                    boundary: page.data.boundary,
                                    freshBoundaryCapture: true,
                                    verificationCapture: true,
                                    verificationReference:
                                        page.data.inspection?.verification_reference,
                                    google_maps_api_key:
                                        page.data.google_maps_api_key,
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
                                    freshBoundaryCapture: true,
                                    verificationCapture: true,
                                    verificationReference:
                                        page.data.inspection?.verification_reference,
                                    google_maps_api_key:
                                        page.data.google_maps_api_key,
                                })
                            }
                        />
                    ))}
                {canVerify &&
                    farm.verification_status === 'verified' && (
                        <View style={styles.noticeCard}>
                            <AppIcon name="lock" size={17} color={API_FOREST} />
                            <Text style={[styles.mutedSmall, styles.flex]}>
                                The saved boundary is read-only until a new
                                verification is started.
                            </Text>
                        </View>
                    )}
                {canVerify &&
                    ['pending', 'needs_review', 'failed'].includes(
                        farm.verification_status,
                    ) && (
                        <Primary
                            title={
                                farm.verification_status === 'failed'
                                    ? 'Start follow-up verification'
                                    : 'Start field verification'
                            }
                            busy={props.busy}
                            onPress={() => props.onStartVerification(farm.id)}
                        />
                    )}
                {canVerify &&
                    farm.verification_status === 'verified' && (
                        <Primary
                            title="Start re-verification"
                            busy={props.busy}
                            onPress={() => props.onStartVerification(farm.id)}
                        />
                    )}
                {canVerify &&
                    farm.verification_status === 'in_progress' && (
                        <>
                            {page.data.boundary &&
                                hasFreshBoundary &&
                                !hasInspection &&
                                canVerify && (
                                    <Primary
                                        title="Complete inspection & add evidence"
                                        onPress={() =>
                                            props.onLocalForm(
                                                'farm-verification/inspection',
                                                {
                                                    farmId: farm.id,
                                                    farmName: farm.farm_name,
                                                    farmCode: farm.farm_id,
                                                    farmerName:
                                                        farm.farmer_name,
                                                    declaredArea:
                                                        page.data.comparison
                                                            ?.declared_area,
                                                    measuredArea:
                                                        page.data.comparison
                                                            ?.measured_area,
                                                    difference:
                                                        page.data.comparison
                                                            ?.difference,
                                                    variance:
                                                        page.data.comparison
                                                            ?.variance,
                                                },
                                            )
                                        }
                                    />
                                )}
                            {page.data.boundary && hasInspection && (
                                <>
                                    <Secondary
                                        title="Add another evidence photo"
                                        onPress={() =>
                                            props.onLocalForm(
                                                'farm-verification/inspection',
                                                {
                                                    farmId: farm.id,
                                                    farmName: farm.farm_name,
                                                    farmCode: farm.farm_id,
                                                    farmerName:
                                                        farm.farmer_name,
                                                    declaredArea:
                                                        page.data.comparison
                                                            ?.declared_area,
                                                    measuredArea:
                                                        page.data.comparison
                                                            ?.measured_area,
                                                    difference:
                                                        page.data.comparison
                                                            ?.difference,
                                                    variance:
                                                        page.data.comparison
                                                            ?.variance,
                                                    farm_exists:
                                                        inspection.checklist
                                                            .farm_exists,
                                                    location_matches:
                                                        inspection.checklist
                                                            .location_matches,
                                                    coffee_crop_observed:
                                                        inspection.checklist
                                                            .coffee_crop_observed,
                                                    boundary_captured:
                                                        inspection.checklist
                                                            .boundary_captured,
                                                    area_checked:
                                                        inspection.checklist
                                                            .area_checked,
                                                    farmer_or_representative_met:
                                                        inspection.checklist
                                                            .farmer_or_representative_met,
                                                    remarks:
                                                        inspection.checklist
                                                            .observations,
                                                },
                                            )
                                        }
                                    />
                                    <Primary
                                        title="Record verification result"
                                        onPress={() =>
                                            props.onLocalForm(
                                                'farm-verification/decision',
                                                {
                                                    farmId: farm.id,
                                                    farmName: farm.farm_name,
                                                    farmCode: farm.farm_id,
                                                    farmerName:
                                                        farm.farmer_name,
                                                    declaredArea:
                                                        page.data.comparison
                                                            ?.declared_area,
                                                    measuredArea:
                                                        page.data.comparison
                                                            ?.measured_area,
                                                    difference:
                                                        page.data.comparison
                                                            ?.difference,
                                                    variance:
                                                        page.data.comparison
                                                            ?.variance,
                                                    gpsPoints:
                                                        boundaryPointCount(
                                                            page.data.boundary,
                                                        ),
                                                    evidencePhotos:
                                                        inspection.photos
                                                            .length,
                                                    requiredChecksPassed:
                                                        inspectionChecks
                                                            .slice(0, 6)
                                                            .filter(
                                                                (key) =>
                                                                    inspection
                                                                        .checklist?.[
                                                                        key
                                                                    ] === true,
                                                            ).length,
                                                },
                                            )
                                        }
                                    />
                                </>
                            )}
                            {page.data.boundary && hasInspection && (
                                <Secondary
                                    title="Add another evidence photo"
                                    onPress={() =>
                                        props.onLocalForm(
                                            'farm-verification/inspection',
                                            {
                                                farmId: farm.id,
                                                farmName: farm.farm_name,
                                                farmCode: farm.farm_id,
                                                farmerName: farm.farmer_name,
                                                declaredArea:
                                                    page.data.comparison
                                                        ?.declared_area,
                                                measuredArea:
                                                    page.data.comparison
                                                        ?.measured_area,
                                                farm_exists:
                                                    inspection.checklist
                                                        ?.farm_exists,
                                                location_matches:
                                                    inspection.checklist
                                                        ?.location_matches,
                                                coffee_crop_observed:
                                                    inspection.checklist
                                                        ?.coffee_crop_observed,
                                                boundary_captured:
                                                    inspection.checklist
                                                        ?.boundary_captured,
                                                area_checked:
                                                    inspection.checklist
                                                        ?.area_checked,
                                                farmer_or_representative_met:
                                                    inspection.checklist
                                                        ?.farmer_or_representative_met,
                                                remarks:
                                                    inspection.checklist
                                                        ?.observations,
                                                evidence_type:
                                                    inspection.photos?.at(-1)
                                                        ?.type ?? '',
                                            },
                                        )
                                    }
                                />
                            )}
                            {inspection && hasFreshBoundary && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>
                                        Field inspection
                                    </Text>
                                    <SummaryRow
                                        label="Farm physically exists"
                                        value={checklistAnswer(
                                            inspection.checklist?.farm_exists,
                                        )}
                                    />
                                    <SummaryRow
                                        label="Location matches registration"
                                        value={checklistAnswer(
                                            inspection.checklist
                                                ?.location_matches,
                                        )}
                                    />
                                    <SummaryRow
                                        label={`${farm.crop_label ?? 'Registered crop'} observed`}
                                        value={checklistAnswer(
                                            inspection.checklist?.crop_observed ??
                                                inspection.checklist
                                                    ?.coffee_crop_observed,
                                        )}
                                    />
                                    <SummaryRow
                                        label="GPS boundary captured"
                                        value={checklistAnswer(
                                            inspection.checklist
                                                ?.boundary_captured,
                                        )}
                                    />
                                    <SummaryRow
                                        label="Farm area checked"
                                        value={checklistAnswer(
                                            inspection.checklist?.area_checked,
                                        )}
                                    />
                                    <SummaryRow
                                        label="Evidence photos"
                                        value={`${inspection.photos?.length ?? 0} uploaded`}
                                    />
                                    <SummaryRow
                                        label="Farmer or representative met"
                                        value={checklistAnswer(
                                            inspection.checklist
                                                ?.farmer_or_representative_met,
                                        )}
                                    />
                                    {inspection.checklist?.observations ? (
                                        <Text style={styles.muted}>
                                            {inspection.checklist.observations}
                                        </Text>
                                    ) : null}
                                    <View style={styles.evidenceGrid}>
                                        {(inspection.photos ?? []).map(
                                            (photo: any) => (
                                                <View
                                                    key={photo.id}
                                                    style={styles.evidenceItem}
                                                >
                                                    <Image
                                                        source={{
                                                            uri: photo.url,
                                                            headers: {
                                                                Authorization: `Bearer ${props.token}`,
                                                            },
                                                        }}
                                                        style={
                                                            styles.evidenceImage
                                                        }
                                                        accessibilityLabel={withoutDemoWordText(
                                                            `Inspection evidence: ${photo.name}`,
                                                        )}
                                                    />
                                                    <Text
                                                        style={
                                                            styles.mutedSmall
                                                        }
                                                    >
                                                        {String(
                                                            photo.type ??
                                                                'field_inspection',
                                                        ).replaceAll('_', ' ')}
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.mutedSmall
                                                        }
                                                    >
                                                        {photo.name}
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.mutedSmall
                                                        }
                                                    >
                                                        {photo.captured_at
                                                            ? new Date(
                                                                  photo.captured_at,
                                                              ).toLocaleString()
                                                            : 'Capture time unavailable'}
                                                    </Text>
                                                    {photo.uploaded_at ? (
                                                        <Text
                                                            style={
                                                                styles.mutedSmall
                                                            }
                                                        >
                                                            Uploaded{' '}
                                                            {new Date(
                                                                photo.uploaded_at,
                                                            ).toLocaleString()}
                                                        </Text>
                                                    ) : null}
                                                    {photo.latitude != null &&
                                                    photo.longitude != null ? (
                                                        <Text
                                                            style={
                                                                styles.mutedSmall
                                                            }
                                                        >
                                                            {photo.latitude},{' '}
                                                            {photo.longitude}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            ),
                                        )}
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                <VerificationHistory
                    title="Verification history"
                    rows={page.data.history ?? []}
                    token={props.token}
                />
            </ScrollView>
        );
    }

    if (page.component === 'modules/placeholder')
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <View style={styles.moduleHero}>
                    <View style={styles.moduleIcon}>
                        <AppIcon
                            name={moduleIcon(page.data.module)}
                            size={28}
                            color={API_FOREST}
                        />
                    </View>
                    <Text style={styles.moduleEyebrow}>SUREFARM WORKSPACE</Text>
                    <Text style={styles.moduleTitle}>
                        {page.data.title ?? 'Workspace'}
                    </Text>
                    <Text style={styles.muted}>
                        {page.data.description ??
                            'This workspace is part of the SureFarm program.'}
                    </Text>
                    <View style={styles.comingSoonPill}>
                        <View style={styles.comingSoonDot} />
                        <Text style={styles.comingSoonText}>
                            In development
                        </Text>
                    </View>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>What you can do now</Text>
                    <Text style={styles.muted}>
                        This workspace does not have working record screens yet.
                        SureFarm will show live tools here when they are ready.
                    </Text>
                    {['finance', 'insurance'].includes(page.data.module) && (
                        <>
                            <Text style={[styles.muted, { marginTop: 10 }]}>
                                Existing farm financing and insurance records
                                can be reviewed from a farm profile.
                            </Text>
                            <Primary
                                title="Browse farm records"
                                onPress={() =>
                                    props.onOpen('/farms', 'Farms & map')
                                }
                            />
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
                {page.component === 'farmers/show' &&
                    page.data.farmer?.farm_summary && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Farm portfolio</Text>
                            <SummaryRow
                                label="Registered farms"
                                value={
                                    page.data.farmer.farm_summary
                                        .registered_farms
                                }
                            />
                            <SummaryRow
                                label="Declared area"
                                value={`${page.data.farmer.farm_summary.declared_area_hectares} ha`}
                            />
                            <SummaryRow
                                label="Verified area"
                                value={`${page.data.farmer.farm_summary.total_verified_hectares} ha`}
                            />
                            <SummaryRow
                                label="Verified farms"
                                value={
                                    page.data.farmer.farm_summary.verified_farms
                                }
                            />
                            <SummaryRow
                                label="Pending verification"
                                value={
                                    page.data.farmer.farm_summary
                                        .pending_verification
                                }
                            />
                        </View>
                    )}
                {page.component === 'farmers/show' &&
                    page.data.farmer?.spouse && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Spouse</Text>
                            <SummaryRow
                                label="Name"
                                value={page.data.farmer.spouse.full_name}
                            />
                        </View>
                    )}
                {page.component === 'farmers/show' &&
                    page.data.farmer?.bank_account && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Bank account</Text>
                            <SummaryRow
                                label="Bank"
                                value={page.data.farmer.bank_account.bank_name}
                            />
                            <SummaryRow
                                label="Account name"
                                value={
                                    page.data.farmer.bank_account.account_name
                                }
                            />
                            <SummaryRow
                                label="Account number"
                                value={
                                    page.data.farmer.bank_account.account_number
                                }
                            />
                            <SummaryRow
                                label="Verification"
                                value={
                                    page.data.farmer.bank_account.status_label
                                }
                            />
                        </View>
                    )}
                {page.component === 'inventory/show' && entity.stage && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            Current processing stage
                        </Text>
                        <SummaryRow label="Stage" value={entity.stage.name} />
                        <SummaryRow
                            label="Stage code"
                            value={entity.stage.code}
                        />
                    </View>
                )}
                {page.component !== 'farms/show' && entity.farm?.id && (
                    <LinkedRecord
                        row={entity.farm}
                        kind="farm"
                        onOpen={props.onOpen}
                    />
                )}
                {page.component !== 'farmers/show' && entity.farmer?.id && (
                    <LinkedRecord
                        row={entity.farmer}
                        kind="farmer"
                        onOpen={props.onOpen}
                    />
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
                    <LinkedFarmer
                        farmer={page.data.farm.farmer}
                        onOpen={props.onOpen}
                    />
                )}
                {page.component === 'farms/show' && (
                    <FarmLocationCard farm={page.data.farm} />
                )}
                {page.component === 'farms/show' && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Area records</Text>
                        <SummaryRow
                            label="Declared area"
                            value={`${page.data.farm.declared_area_hectares} ha`}
                        />
                        <SummaryRow
                            label="GPS measured"
                            value={
                                page.data.farm.measured_area ??
                                'Not yet measured'
                            }
                        />
                        <SummaryRow
                            label="Verified area"
                            value={
                                page.data.farm.verified_area ??
                                'Not yet verified'
                            }
                        />
                        <SummaryRow
                            label="Difference"
                            value={page.data.farm.difference ?? '—'}
                        />
                        <SummaryRow
                            label="Variance"
                            value={page.data.farm.variance ?? '—'}
                        />
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
                    <Related
                        title="Inventory movements"
                        rows={page.data.movements}
                    />
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
                {page.component === 'farms/show' &&
                    page.data.farm?.can_manage_coverage && (
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
                    <BoundaryCard
                        boundary={page.data.boundary ?? page.data.farm.boundary}
                        apiKey={page.data.google_maps_api_key}
                    />
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
                const done =
                    index < activeStep || (completed && index === activeStep);
                const active = index === activeStep && !completed;
                return (
                    <View key={label} style={styles.progressStep}>
                        <View
                            style={[
                                styles.progressDot,
                                done && styles.progressDotDone,
                                active && styles.progressDotActive,
                            ]}
                        >
                            {done ? (
                                <AppIcon
                                    name="verified"
                                    size={13}
                                    color="#ffffff"
                                />
                            ) : (
                                <Text
                                    style={[
                                        styles.progressNumber,
                                        active && styles.progressNumberActive,
                                    ]}
                                >
                                    {index + 1}
                                </Text>
                            )}
                        </View>
                        <Text
                            style={[
                                styles.progressLabel,
                                (done || active) && styles.progressLabelActive,
                            ]}
                        >
                            {label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

function FarmLocationCard({ farm }: { farm: Record<string, any> }) {
    const [distance, setDistance] = useState<{
        meters: number;
        accuracy: number | null;
    } | null>(null);
    const [measuringDistance, setMeasuringDistance] = useState(false);
    const [distanceMessage, setDistanceMessage] = useState<{
        text: string;
        isError: boolean;
    } | null>(null);
    const farmLatitude = Number(farm.latitude);
    const farmLongitude = Number(farm.longitude);
    const hasCoordinates =
        farm.latitude !== null &&
        farm.latitude !== undefined &&
        farm.longitude !== null &&
        farm.longitude !== undefined &&
        Number.isFinite(farmLatitude) &&
        farmLatitude >= -90 &&
        farmLatitude <= 90 &&
        Number.isFinite(farmLongitude) &&
        farmLongitude >= -180 &&
        farmLongitude <= 180;
    const address =
        farm.location ??
        [farm.purok_sitio, farm.barangay, farm.municipality, farm.province]
            .filter((part) => typeof part === 'string' && part.trim())
            .join(', ');
    const openMap = async () => {
        if (!hasCoordinates) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${farm.latitude},${farm.longitude}`)}`;
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert(
                'Could not open map',
                'Check that a maps app or browser is available.',
            );
        }
    };
    const measureDistance = async () => {
        if (measuringDistance) return;
        setMeasuringDistance(true);
        setDistance(null);
        setDistanceMessage(null);
        try {
            let latitude: number;
            let longitude: number;
            let accuracy: number | null;

            if (Platform.OS === 'web') {
                if (!globalThis.isSecureContext) {
                    throw new Error(
                        'Location access requires a secure HTTPS connection.',
                    );
                }

                if (!navigator.geolocation) {
                    throw new Error(
                        'This browser does not provide location access.',
                    );
                }

                const position = await new Promise<GeolocationPosition>(
                    (resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(
                            resolve,
                            reject,
                            {
                                enableHighAccuracy: true,
                                maximumAge: 0,
                                timeout: 20000,
                            },
                        );
                    },
                );
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
                accuracy = position.coords.accuracy;
            } else {
                const permission =
                    await Location.requestForegroundPermissionsAsync();
                if (!permission.granted) {
                    throw new Error(
                        'Allow location access in your device settings, then try again.',
                    );
                }

                const position = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
                accuracy = position.coords.accuracy;
            }

            const radians = (degrees: number) => (degrees * Math.PI) / 180;
            const latitudeDelta = radians(farmLatitude - latitude);
            const longitudeDelta = radians(farmLongitude - longitude);
            const startLatitude = radians(latitude);
            const endLatitude = radians(farmLatitude);
            const earthRadiusMeters = 6_371_000;
            const a =
                Math.sin(latitudeDelta / 2) ** 2 +
                Math.cos(startLatitude) *
                    Math.cos(endLatitude) *
                    Math.sin(longitudeDelta / 2) ** 2;
            const meters =
                earthRadiusMeters *
                2 *
                Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            setDistance({
                meters,
                accuracy,
            });
            setDistanceMessage({
                text: 'Distance measured from your current location.',
                isError: false,
            });
        } catch (error) {
            const code = (error as { code?: number } | null)?.code;
            const message =
                code === 1
                    ? 'Location permission is blocked. Allow it in your browser or device settings, then try again.'
                    : code === 2
                      ? 'Your location is unavailable. Turn on GPS and try again outdoors.'
                      : code === 3
                        ? 'Getting your location took too long. Check GPS reception and try again.'
                        : error instanceof Error
                          ? error.message
                          : 'Could not read your location. Turn on GPS and try again.';
            setDistanceMessage({ text: message, isError: true });
        } finally {
            setMeasuringDistance(false);
        }
    };

    return (
        <View style={styles.locationCard}>
            <View style={styles.locationTitleRow}>
                <View style={styles.locationIcon}>
                    <AppIcon name="location" size={18} color={API_FOREST} />
                </View>
                <View style={styles.flex}>
                    <Text style={styles.recordTitle}>Farm location</Text>
                    <Text style={styles.mutedSmall}>
                        {address || 'Location not provided'}
                    </Text>
                </View>
            </View>
            {hasCoordinates ? (
                <>
                    <Text style={styles.coordinateText}>
                        Lat {farm.latitude} · Lng {farm.longitude}
                    </Text>
                    <Secondary
                        title="Open directions in Maps"
                        onPress={() => void openMap()}
                    />
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: measuringDistance }}
                        disabled={measuringDistance}
                        onPress={() => void measureDistance()}
                        style={({ pressed }) => [
                            styles.secondary,
                            styles.locationMeasureButton,
                            pressed && styles.pressed,
                            measuringDistance && styles.locationMeasureDisabled,
                        ]}
                    >
                        {measuringDistance ? (
                            <>
                                <ActivityIndicator size="small" color={GREEN} />
                                <Text style={styles.secondaryText}>
                                    Getting your location…
                                </Text>
                            </>
                        ) : (
                            <>
                                <AppIcon
                                    name="location"
                                    size={16}
                                    color={GREEN}
                                />
                                <Text style={styles.secondaryText}>
                                    Measure distance from my location
                                </Text>
                            </>
                        )}
                    </Pressable>
                    {distanceMessage && (
                        <Text
                            accessibilityLiveRegion="polite"
                            style={[
                                styles.gpsAccuracy,
                                distanceMessage.isError &&
                                    styles.locationMeasureError,
                                !distanceMessage.isError &&
                                    styles.locationMeasureSuccess,
                            ]}
                        >
                            {distanceMessage.text}
                        </Text>
                    )}
                    {distance && (
                        <Text style={styles.gpsAccuracy}>
                            About {(distance.meters / 1000).toFixed(2)} km away
                            {distance.accuracy === null
                                ? ''
                                : ` Â· GPS accuracy Â±${Math.round(distance.accuracy)} m`}
                        </Text>
                    )}
                </>
            ) : (
                <Text style={styles.gpsAccuracy}>
                    GPS coordinates have not been recorded.
                </Text>
            )}
        </View>
    );
}

function BoundaryCard({
    boundary,
    apiKey,
    title = 'Saved GPS boundary',
}: {
    boundary: Record<string, any>;
    apiKey?: string;
    title?: string;
}) {
    const mapHost = useRef<HTMLDivElement | null>(null);
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const geometry = useMemo(() => {
        try {
            const parsed =
                typeof boundary.geojson === 'string'
                    ? JSON.parse(boundary.geojson)
                    : boundary.geojson;
            if (parsed?.type === 'Polygon') return parsed.coordinates?.[0];
            if (parsed?.type === 'MultiPolygon')
                return parsed.coordinates?.[0]?.[0];
        } catch {
            return null;
        }
        return null;
    }, [boundary.geojson]);
    const points = useMemo(
        () =>
            Array.isArray(geometry)
                ? geometry.filter(
                      (point: any) =>
                          Array.isArray(point) &&
                          Number.isFinite(Number(point[0])) &&
                          Number.isFinite(Number(point[1])),
                  )
                : [],
        [geometry],
    );
    const openPoints = useMemo(
        () =>
            points.length > 1 &&
            points[0][0] === points[points.length - 1][0] &&
            points[0][1] === points[points.length - 1][1]
                ? points.slice(0, -1)
                : points,
        [points],
    );
    const previewPoints = (() => {
        if (openPoints.length < 3) return '';
        const xs = openPoints.map((point: any) => Number(point[0]));
        const ys = openPoints.map((point: any) => Number(point[1]));
        const minX = Math.min(...xs),
            maxX = Math.max(...xs);
        const minY = Math.min(...ys),
            maxY = Math.max(...ys);
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(250 / width, 105 / height);
        const offsetX = (320 - width * scale) / 2;
        const offsetY = (140 - height * scale) / 2;
        return openPoints
            .map(
                (point: any) =>
                    `${(offsetX + (Number(point[0]) - minX) * scale).toFixed(1)},${(offsetY + 8 + (maxY - Number(point[1])) * scale).toFixed(1)}`,
            )
            .join(' ');
    })();

    useEffect(() => {
        if (
            Platform.OS !== 'web' ||
            typeof window === 'undefined' ||
            !apiKey ||
            openPoints.length < 3 ||
            !mapHost.current
        )
            return;

        const browserWindow = window as any;
        let cancelled = false;
        let loadTimeout: ReturnType<typeof setTimeout> | undefined;
        setMapUnavailable(false);
        const previousAuthFailure = browserWindow.gm_authFailure;
        const handleAuthFailure = () => {
            if (!cancelled) setMapUnavailable(true);
            if (typeof previousAuthFailure === 'function') {
                try {
                    previousAuthFailure();
                } catch (error) {
                    console.error(
                        'A previous Google Maps authentication handler failed.',
                        error,
                    );
                }
            }
        };
        const handleScriptError = () => {
            if (!cancelled) setMapUnavailable(true);
        };
        browserWindow.gm_authFailure = handleAuthFailure;
        const renderMap = () => {
            if (cancelled || !mapHost.current || !browserWindow.google?.maps)
                return;
            try {
                const map = new browserWindow.google.maps.Map(mapHost.current, {
                    mapTypeId: 'hybrid',
                    mapTypeControl: true,
                    streetViewControl: false,
                    fullscreenControl: true,
                    gestureHandling: 'greedy',
                });
                const path = openPoints.map((point: any) => ({
                    lat: Number(point[1]),
                    lng: Number(point[0]),
                }));
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
                setMapUnavailable(false);
            } catch (error) {
                console.error(
                    'Could not render the saved farm boundary map.',
                    error,
                );
                setMapUnavailable(true);
            }
        };

        if (browserWindow.google?.maps) {
            renderMap();
        } else {
            let script = document.querySelector<HTMLScriptElement>(
                '#surefarm-google-maps',
            );
            if (!script) {
                script = document.createElement('script');
                script.id = 'surefarm-google-maps';
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
            script.addEventListener('load', renderMap);
            script.addEventListener('error', handleScriptError);
            loadTimeout = setTimeout(handleScriptError, 15000);
        }

        return () => {
            cancelled = true;
            if (loadTimeout) clearTimeout(loadTimeout);
            const script = document.querySelector<HTMLScriptElement>(
                '#surefarm-google-maps',
            );
            script?.removeEventListener('load', renderMap);
            script?.removeEventListener('error', handleScriptError);
            if (browserWindow.gm_authFailure === handleAuthFailure) {
                browserWindow.gm_authFailure = previousAuthFailure;
            }
        };
    }, [apiKey, openPoints]);

    return (
        <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
                <View>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.mutedSmall}>
                        {Platform.OS === 'web' && apiKey && !mapUnavailable
                            ? 'Google satellite map · saved GPS boundary'
                            : mapUnavailable
                              ? 'Satellite map unavailable · GPS outline shown'
                              : 'Boundary outline preview'}
                    </Text>
                </View>
                <View style={styles.boundaryIcon}>
                    <AppIcon name="location" size={17} color={API_FOREST} />
                </View>
            </View>
            {Platform.OS === 'web' &&
            apiKey &&
            openPoints.length >= 3 &&
            !mapUnavailable ? (
                createElement('div', {
                    ref: mapHost,
                    style: {
                        width: '100%',
                        height: 220,
                        borderRadius: 14,
                        overflow: 'hidden',
                    },
                })
            ) : Platform.OS !== 'web' ? (
                <BoundaryMap
                    points={openPoints.map((point: any) => ({
                        latitude: Number(point[1]),
                        longitude: Number(point[0]),
                    }))}
                    height={220}
                />
            ) : (
                <View style={styles.boundaryPreview}>
                    <Svg width="100%" height={140} viewBox="0 0 320 140">
                        <Path
                            d="M0 35H320 M0 70H320 M0 105H320 M80 0V140 M160 0V140 M240 0V140"
                            stroke="#e6eee7"
                            strokeWidth={1}
                        />
                        {previewPoints ? (
                            <Polygon
                                points={previewPoints}
                                fill="#88b89555"
                                stroke={GREEN}
                                strokeWidth={3}
                                strokeLinejoin="round"
                            />
                        ) : (
                            <Circle cx={160} cy={70} r={5} fill={GREEN} />
                        )}
                    </Svg>
                </View>
            )}
            <View style={styles.boundaryFacts}>
                <View style={styles.boundaryFact}>
                    <Text style={styles.boundaryValue}>
                        {boundary.gps_measured_area_hectares ?? '—'}
                    </Text>
                    <Text style={styles.mutedSmall}>Measured ha</Text>
                </View>
                <View style={styles.boundaryFact}>
                    <Text style={styles.boundaryValue}>
                        {openPoints.length || '—'}
                    </Text>
                    <Text style={styles.mutedSmall}>GPS points</Text>
                </View>
                <View style={styles.boundaryFact}>
                    <Text style={styles.boundaryValue}>
                        {boundary.captured_at ?? '—'}
                    </Text>
                    <Text style={styles.mutedSmall}>Captured</Text>
                </View>
            </View>
            <Text style={styles.mutedSmall}>
                Reported capture method: {boundary.capture_method === 'device_gps'
                    ? 'Device GPS'
                    : boundary.capture_method === 'map_manual'
                      ? 'Web map edit'
                      : 'Not recorded'}
            </Text>
            <Text style={styles.mutedSmall}>
                GPS source and capture times are reported by the app and are
                not independently verified by the server.
            </Text>
            {Array.isArray(boundary.gps_point_accuracies) &&
                boundary.gps_point_accuracies.length > 0 && (
                    <View style={styles.boundaryAccuracyList}>
                        {boundary.gps_point_accuracies.map(
                            (accuracy: number | null, index: number) => (
                                <Text
                                    key={`gps-accuracy-${index}`}
                                    style={styles.mutedSmall}
                                >
                                    Point {index + 1}:{' '}
                                    {accuracy == null
                                        ? 'accuracy unavailable'
                                        : `±${Number(accuracy).toFixed(0)} m`}
                                </Text>
                            ),
                        )}
                    </View>
                )}
            {Array.isArray(boundary.gps_point_captured_at) &&
                boundary.gps_point_captured_at.length > 0 && (
                    <View style={styles.boundaryAccuracyList}>
                        {boundary.gps_point_captured_at.map(
                            (capturedAt: string, index: number) => (
                                <Text
                                    key={`gps-captured-at-${index}`}
                                    style={styles.mutedSmall}
                                >
                                    Point {index + 1} device-reported time:{' '}
                                    {new Date(capturedAt).toLocaleString()}
                                </Text>
                            ),
                        )}
                    </View>
                )}
        </View>
    );
}

function LinkedFarmer({
    farmer,
    onOpen,
}: {
    farmer: Record<string, any>;
    onOpen: (path: string, title: string) => void;
}) {
    return (
        <Pressable
            onPress={() => onOpen(`/farmers/${farmer.id}`, 'Farmer details')}
            style={({ pressed }) => [
                styles.linkedFarmer,
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.linkedFarmerIcon}>
                <AppIcon name="farmers" size={18} color={API_FOREST} />
            </View>
            <View style={styles.flex}>
                <Text style={styles.mutedSmall}>REGISTERED FARMER</Text>
                <Text style={styles.recordTitle}>
                    {farmer.full_name ?? 'Farmer profile'}
                </Text>
                <Text style={styles.recordCode}>{farmer.farmer_id}</Text>
            </View>
            <AppIcon name="chevronRight" size={18} color={GREEN} />
        </Pressable>
    );
}

function LinkedRecord({
    row,
    kind,
    onOpen,
}: {
    row: Record<string, any>;
    kind: 'farm' | 'farmer';
    onOpen: (path: string, title: string) => void;
}) {
    const farmer = kind === 'farmer';
    const title = farmer
        ? (row.full_name ?? row.name ?? 'Farmer profile')
        : (row.farm_name ?? 'Farm profile');
    const code = farmer ? row.farmer_id : row.farm_id;
    return (
        <Pressable
            onPress={() =>
                onOpen(
                    `/${farmer ? 'farmers' : 'farms'}/${row.id}`,
                    farmer ? 'Farmer details' : 'Farm details',
                )
            }
            style={({ pressed }) => [
                styles.linkedFarmer,
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.linkedFarmerIcon}>
                <AppIcon
                    name={farmer ? 'farmers' : 'farms'}
                    size={18}
                    color={API_FOREST}
                />
            </View>
            <View style={styles.flex}>
                <Text style={styles.mutedSmall}>
                    {farmer ? 'FARMER PROFILE' : 'FARM RECORD'}
                </Text>
                <Text style={styles.recordTitle}>{title}</Text>
                {code ? (
                    <Text style={styles.recordCode}>{String(code)}</Text>
                ) : null}
            </View>
            <AppIcon name="chevronRight" size={18} color={GREEN} />
        </Pressable>
    );
}

function FormView(props: {
    spec: FormSpec;
    data: Record<string, any>;
    token: string;
    values: Record<string, any>;
    photos: Record<string, ImagePicker.ImagePickerAsset | ImagePicker.ImagePickerAsset[]>;
    error: string;
    busy: boolean;
    onChange: (key: string, value: any) => void;
    onClearImages: () => void;
    onImage: (key: string, camera: boolean) => void;
    onOpen: (path: string, title: string) => void;
    onSubmit: () => void;
}) {
    const [boundaryPoints, setBoundaryPoints] = useState<[number, number][]>(
        [],
    );
    const [boundaryPointAccuracies, setBoundaryPointAccuracies] = useState<
        (number | null)[]
    >(() =>
        !props.data.freshBoundaryCapture && !props.data.verificationCapture &&
        Array.isArray(props.data.boundary?.gps_point_accuracies)
            ? props.data.boundary.gps_point_accuracies.map(
                  (accuracy: unknown) =>
                      typeof accuracy === 'number' && Number.isFinite(accuracy)
                          ? accuracy
                          : null,
              )
            : [],
    );
    const [boundaryPointCapturedAt, setBoundaryPointCapturedAt] = useState<
        string[]
    >(() =>
        !props.data.freshBoundaryCapture && !props.data.verificationCapture &&
        Array.isArray(props.data.boundary?.gps_point_captured_at)
            ? props.data.boundary.gps_point_captured_at.map(String)
            : [],
    );
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [gpsCoordinate, setGpsCoordinate] = useState<BoundaryPoint | null>(
        null,
    );
    const [measuredBoundaryPreview, setMeasuredBoundaryPreview] = useState<
        string | null
    >(() => {
        const existingArea = props.data.freshBoundaryCapture || props.data.verificationCapture
            ? null
            : props.data.boundary?.gps_measured_area_hectares;
        return existingArea == null
            ? null
            : typeof existingArea === 'string'
              ? existingArea
              : `${Number(existingArea).toFixed(2)} ha`;
    });
    const boundaryField = props.spec.fields.find(
        (field) => field.kind === 'geojson',
    );
    const verificationCapture = props.data.verificationCapture === true;
    const boundaryDraftKey =
        verificationCapture &&
        props.data.farmId &&
        typeof props.data.verificationReference === 'string' &&
        props.data.verificationReference.length > 0
            ? `surefarm:boundary-draft:${props.data.farmId}:${props.data.verificationReference}`
            : null;
    const [boundaryDraftReady, setBoundaryDraftReady] = useState(
        () => !verificationCapture,
    );
    const [boundaryDraftMessage, setBoundaryDraftMessage] = useState('');
    const [boundaryDraftError, setBoundaryDraftError] = useState('');
    const persistedBoundarySnapshot = useRef('');
    const gpsCaptureInProgress = useRef(false);
    const onChangeRef = useRef(props.onChange);
    onChangeRef.current = props.onChange;

    useEffect(() => {
        let cancelled = false;

        if (!verificationCapture || !boundaryDraftKey || !boundaryField) {
            if (verificationCapture && !boundaryDraftKey) {
                setBoundaryDraftError(
                    'This verification is missing its reference, so its GPS draft cannot be safely restored. Reload the verification before capturing points.',
                );
            }
            setBoundaryDraftReady(true);
            return;
        }

        setBoundaryDraftReady(false);
        void readBoundaryDraft(boundaryDraftKey)
            .then((draft) => {
                if (cancelled) return;
                if (draft) {
                    persistedBoundarySnapshot.current = JSON.stringify(draft);
                    setBoundaryPoints(draft.points);
                    setBoundaryPointAccuracies(draft.accuracies);
                    setBoundaryPointCapturedAt(draft.capturedAt);
                    onChangeRef.current(
                        boundaryField.key,
                        JSON.stringify({
                            type: 'Polygon',
                            coordinates: [draft.points],
                        }),
                    );
                    onChangeRef.current('gps_point_accuracies', draft.accuracies);
                    onChangeRef.current('gps_point_captured_at', draft.capturedAt);
                    onChangeRef.current('capture_method', 'device_gps');
                    setBoundaryDraftMessage(
                        'Restored GPS points saved on this device.',
                    );
                } else {
                    setBoundaryDraftMessage(
                        'GPS points are saved on this device as you add them.',
                    );
                }
            })
            .catch(() => {
                if (cancelled) return;
                setBoundaryDraftError(
                    'Could not restore the saved GPS draft. Keep this screen open while recording the boundary.',
                );
            })
            .finally(() => {
                if (!cancelled) setBoundaryDraftReady(true);
            });

        return () => {
            cancelled = true;
        };
    }, [boundaryDraftKey, boundaryField?.key, verificationCapture]);

    useEffect(() => {
        if (!verificationCapture || !boundaryDraftKey || !boundaryDraftReady)
            return;

        const draft: BoundaryDraft | null = boundaryPoints.length
            ? {
                  points: boundaryPoints,
                  accuracies: boundaryPoints.map(
                      (_, index) => boundaryPointAccuracies[index] ?? null,
                  ),
                  capturedAt: boundaryPoints.map(
                      (_, index) => boundaryPointCapturedAt[index] ?? '',
                  ),
              }
            : null;
        const snapshot = draft ? JSON.stringify(draft) : '';
        if (snapshot === persistedBoundarySnapshot.current) return;

        void enqueueBoundaryDraftWrite(boundaryDraftKey, draft)
            .then(() => {
                persistedBoundarySnapshot.current = snapshot;
                if (draft) {
                    setBoundaryDraftError('');
                    setBoundaryDraftMessage('GPS draft saved on this device.');
                }
            })
            .catch(() => {
                setBoundaryDraftError(
                    'Could not save the GPS draft on this device. Keep this screen open until the boundary is submitted.',
                );
            });
    }, [
        boundaryDraftKey,
        boundaryDraftReady,
        boundaryPointAccuracies,
        boundaryPointCapturedAt,
        boundaryPoints,
        verificationCapture,
    ]);

    const hasCoordinates =
        props.spec.fields.some((field) => field.key === 'latitude') &&
        props.spec.fields.some((field) => field.key === 'longitude');
    const currentBoundaryPoints = useMemo<BoundaryPoint[]>(() => {
        const raw = props.values[boundaryField?.key ?? ''];
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const geometry = JSON.parse(raw);
                const ring =
                    geometry?.type === 'Polygon'
                        ? geometry.coordinates?.[0]
                        : null;
                if (Array.isArray(ring)) {
                    const points = ring
                        .filter(
                            (coordinate: any) =>
                                Array.isArray(coordinate) &&
                                Number.isFinite(Number(coordinate[0])) &&
                                Number.isFinite(Number(coordinate[1])),
                        )
                        .map((coordinate: any) => ({
                            latitude: Number(coordinate[1]),
                            longitude: Number(coordinate[0]),
                        }));
                    const first = points[0];
                    const last = points[points.length - 1];
                    if (
                        first &&
                        last &&
                        first.latitude === last.latitude &&
                        first.longitude === last.longitude
                    )
                        points.pop();
                    return points;
                }
            } catch {
                // Keep any points captured during this edit if the GeoJSON is being corrected.
            }
        }
        return boundaryPoints.map(([longitude, latitude]) => ({
            latitude,
            longitude,
        }));
    }, [boundaryField?.key, boundaryPoints, props.values]);

    const captureLocation = async () => {
        if (gpsCaptureInProgress.current) return;
        if (verificationCapture && !boundaryDraftReady) {
            Alert.alert(
                'Restoring GPS draft',
                'Wait for saved boundary points to load before adding another point.',
            );
            return;
        }

        gpsCaptureInProgress.current = true;

        try {
            const permission =
                await Location.requestForegroundPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(
                    'Location permission needed',
                    'Allow location access while using SureFarm to record farm coordinates.',
                );
                return;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setGpsAccuracy(position.coords.accuracy);
            const point: [number, number] = [
                position.coords.longitude,
                position.coords.latitude,
            ];
            setGpsCoordinate({ latitude: point[1], longitude: point[0] });

            if (boundaryField) {
                const existingAccuracies = currentBoundaryPoints.map(
                    (_, index) => boundaryPointAccuracies[index] ?? null,
                );
                const nextPoints: [number, number][] = [
                    ...currentBoundaryPoints.map((item): [number, number] => [
                        item.longitude,
                        item.latitude,
                    ]),
                    point,
                ];
                const nextAccuracies = [
                    ...existingAccuracies,
                    position.coords.accuracy,
                ];
                const existingCaptureTimes = currentBoundaryPoints.map(
                    (_, index) => boundaryPointCapturedAt[index] ?? '',
                );
                const positionTimestamp = Number(position.timestamp);
                const nextCaptureTimes = [
                    ...existingCaptureTimes,
                    new Date(
                        Number.isFinite(positionTimestamp)
                            ? positionTimestamp
                            : Date.now(),
                    ).toISOString(),
                ];
                if (verificationCapture && boundaryDraftKey) {
                    const draft = {
                        points: nextPoints,
                        accuracies: nextAccuracies,
                        capturedAt: nextCaptureTimes,
                    };
                    try {
                        await enqueueBoundaryDraftWrite(boundaryDraftKey, draft);
                        persistedBoundarySnapshot.current = JSON.stringify(draft);
                        setBoundaryDraftError('');
                        setBoundaryDraftMessage(
                            'GPS draft saved on this device.',
                        );
                    } catch {
                        setBoundaryDraftError(
                            'Could not save the GPS draft on this device. Keep this screen open until the boundary is submitted.',
                        );
                    }
                }
                setBoundaryPoints(nextPoints);
                setBoundaryPointAccuracies(nextAccuracies);
                setBoundaryPointCapturedAt(nextCaptureTimes);
                props.onChange('gps_point_accuracies', nextAccuracies);
                props.onChange('gps_point_captured_at', nextCaptureTimes);
                props.onChange('capture_method', 'device_gps');
                setMeasuredBoundaryPreview(null);
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
        } finally {
            gpsCaptureInProgress.current = false;
        }
    };

    const closeBoundary = async () => {
        if (gpsCaptureInProgress.current) {
            Alert.alert(
                'GPS point in progress',
                'Wait for the current location reading before closing the boundary.',
            );
            return;
        }

        if (verificationCapture && !boundaryDraftReady) {
            Alert.alert(
                'Restoring GPS draft',
                'Wait for saved boundary points to load before closing the boundary.',
            );
            return;
        }

        const points: [number, number][] = currentBoundaryPoints.map(
            (item): [number, number] => [item.longitude, item.latitude],
        );

        if (points.length < 3 || !boundaryField) {
            Alert.alert(
                'Add more points',
                'Walk to and record at least three farm corners first.',
            );
            return;
        }

        const ring = [...points, points[0]];
        const geojson = { type: 'Polygon', coordinates: [ring] };
        props.onChange(boundaryField.key, JSON.stringify(geojson, null, 2));
        const accuracies = points.map(
            (_, index) => boundaryPointAccuracies[index] ?? null,
        );
        const capturedAt = points.map(
            (_, index) => boundaryPointCapturedAt[index] ?? '',
        );
        if (capturedAt.some((timestamp) => timestamp === '')) {
            Alert.alert(
                'GPS capture details missing',
                'Undo the affected point and capture it again with device GPS.',
            );
            return;
        }
        setBoundaryPointAccuracies(accuracies);
        setBoundaryPointCapturedAt(capturedAt);
        props.onChange('gps_point_accuracies', accuracies);
        props.onChange('gps_point_captured_at', capturedAt);
        props.onChange('capture_method', 'device_gps');
        setBoundaryPoints(points);
        setMeasuredBoundaryPreview(null);
        try {
            const preview = await apiRequest<{ measured_area: string }>(
                `/farms/${props.data.farmId}/boundary-preview`,
                props.token,
                { method: 'POST', body: { boundary_geojson: geojson } },
            );
            setMeasuredBoundaryPreview(preview.measured_area);
            Alert.alert(
                'Boundary ready',
                `${points.length} GPS points · estimated measured area ${preview.measured_area}. Review the outline before saving.`,
            );
        } catch (error) {
            Alert.alert(
                'Boundary needs attention',
                error instanceof Error
                    ? error.message
                    : 'The boundary could not be measured. Review the points and try again.',
            );
        }
    };

    const undoBoundaryPoint = async () => {
        if (gpsCaptureInProgress.current) {
            Alert.alert(
                'GPS point in progress',
                'Wait for the current location reading before undoing a point.',
            );
            return;
        }

        if (!boundaryField || currentBoundaryPoints.length === 0) return;
        const next = currentBoundaryPoints.slice(0, -1);
        const nextAccuracies = boundaryPointAccuracies.slice(0, -1);
        const nextCaptureTimes = boundaryPointCapturedAt.slice(0, -1);
        if (verificationCapture && boundaryDraftKey) {
            const draft: BoundaryDraft | null = next.length
                ? {
                      points: next.map((point): [number, number] => [
                          point.longitude,
                          point.latitude,
                      ]),
                      accuracies: nextAccuracies,
                      capturedAt: nextCaptureTimes,
                  }
                : null;
            try {
                await enqueueBoundaryDraftWrite(boundaryDraftKey, draft);
                persistedBoundarySnapshot.current = draft
                    ? JSON.stringify(draft)
                    : '';
                setBoundaryDraftError('');
            } catch {
                setBoundaryDraftError(
                    'Could not update the saved GPS draft. Keep this screen open until the boundary is submitted.',
                );
            }
        }
        setBoundaryPoints(
            next.map((point): [number, number] => [
                point.longitude,
                point.latitude,
            ]),
        );
        setBoundaryPointAccuracies(nextAccuracies);
        setBoundaryPointCapturedAt(nextCaptureTimes);
        props.onChange('gps_point_accuracies', nextAccuracies);
        props.onChange('gps_point_captured_at', nextCaptureTimes);
        setMeasuredBoundaryPreview(null);
        props.onChange(
            boundaryField.key,
            JSON.stringify(
                {
                    type: 'Polygon',
                    coordinates: [
                        next.map((point) => [point.longitude, point.latitude]),
                    ],
                },
                null,
                2,
            ),
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
                        Complete the fields below. SureFarm checks the values
                        before saving.
                    </Text>
                </View>
                {props.spec.path.includes('/farm-verification/') && (
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeading}>
                            <AppIcon
                                name="shield"
                                size={17}
                                color={API_FOREST}
                            />
                            <Text style={styles.recordTitle}>
                                Verification review
                            </Text>
                        </View>
                        <SummaryRow
                            label="Farmer"
                            value={props.data.farmerName ?? '—'}
                        />
                        <SummaryRow
                            label="Farm"
                            value={
                                props.data.farmName ??
                                props.data.farmCode ??
                                '—'
                            }
                        />
                        {props.data.declaredArea && (
                            <SummaryRow
                                label="Declared area"
                                value={props.data.declaredArea}
                            />
                        )}
                        {props.data.measuredArea && (
                            <SummaryRow
                                label="GPS measured"
                                value={props.data.measuredArea}
                            />
                        )}
                        {props.data.difference && (
                            <SummaryRow
                                label="Difference"
                                value={props.data.difference}
                            />
                        )}
                        {props.data.variance && (
                            <SummaryRow
                                label="Variance"
                                value={props.data.variance}
                            />
                        )}
                        {props.spec.method === 'PUT' && (
                            <>
                                <SummaryRow
                                    label="GPS points"
                                    value={props.data.gpsPoints ?? 0}
                                />
                                <SummaryRow
                                    label="Evidence photos"
                                    value={props.data.evidencePhotos ?? 0}
                                />
                                <SummaryRow
                                    label="Required checks passed"
                                    value={`${props.data.requiredChecksPassed ?? 0} / 6`}
                                />
                            </>
                        )}
                    </View>
                )}
                {hasCoordinates && (
                    <View style={styles.locationCard}>
                        <Text style={styles.recordTitle}>
                            {props.spec.path.includes('/farm-verification/')
                                ? 'Evidence location'
                                : 'Farm location'}
                        </Text>
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
                                Last GPS reading accuracy: about{' '}
                                {Math.round(gpsAccuracy)} m
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
                            at least three corners, review the map, then close
                            the polygon. Undo removes the most recent point
                            before you submit.
                        </Text>
                        {verificationCapture && !boundaryDraftReady && (
                            <Text style={styles.mutedSmall}>
                                Restoring saved GPS points from this device…
                            </Text>
                        )}
                        {verificationCapture && boundaryDraftMessage ? (
                            <Text style={styles.mutedSmall}>
                                {boundaryDraftMessage}
                            </Text>
                        ) : null}
                        {verificationCapture && boundaryDraftError ? (
                            <Text style={styles.errorText}>
                                {boundaryDraftError}
                            </Text>
                        ) : null}
                        <BoundaryMap
                            points={currentBoundaryPoints}
                            height={210}
                            apiKey={props.data.google_maps_api_key}
                        />
                        <Secondary
                            title="Add GPS point"
                            onPress={() => void captureLocation()}
                        />
                        {currentBoundaryPoints.length > 0 && (
                            <Secondary
                                title="Undo last point"
                                onPress={undoBoundaryPoint}
                            />
                        )}
                        <Secondary
                            title="Close boundary"
                            onPress={closeBoundary}
                        />
                        <Text style={styles.mutedSmall}>
                            {currentBoundaryPoints.length} GPS point
                            {currentBoundaryPoints.length === 1 ? '' : 's'} on
                            this boundary
                        </Text>
                        {currentBoundaryPoints.map((_, index) => (
                            <Text
                                key={`captured-point-${index}`}
                                style={styles.mutedSmall}
                            >
                                Point {index + 1}:{' '}
                                {boundaryPointAccuracies[index] == null
                                    ? 'accuracy unavailable'
                                    : `±${Math.round(boundaryPointAccuracies[index] as number)} m`}
                            </Text>
                        ))}
                        {boundaryPointCapturedAt.map((capturedAt, index) => (
                            <Text
                                key={`captured-point-time-${index}`}
                                style={styles.mutedSmall}
                            >
                                Point {index + 1} device-reported time:{' '}
                                {new Date(capturedAt).toLocaleTimeString()}
                            </Text>
                        ))}
                        {gpsCoordinate && (
                            <Text style={styles.coordinateText}>
                                Latest: {gpsCoordinate.latitude.toFixed(6)},{' '}
                                {gpsCoordinate.longitude.toFixed(6)}
                            </Text>
                        )}
                        {gpsAccuracy !== null && (
                            <Text style={styles.gpsAccuracy}>
                                Last point accuracy: about{' '}
                                {Math.round(gpsAccuracy)} m
                            </Text>
                        )}
                        {measuredBoundaryPreview && (
                            <SummaryRow
                                label="Measured area preview"
                                value={measuredBoundaryPreview}
                            />
                        )}
                    </View>
                )}
                {props.spec.fields.map((field) => {
                    if (field.kind === 'hidden') return null;
                    if (
                        field.key === 'boundary_geojson' &&
                        props.spec.path.includes('/boundary')
                    ) return null;
                    const selectedFarm = (props.data.farms ?? []).find(
                        (farm: any) => String(farm.id) === String(props.values.farm_id ?? ''),
                    ) ?? props.data.harvest?.farm;
                    if (
                        (field.key === 'coffee_variety' || field.key === 'estimated_green_bean_quantity_kg') &&
                        selectedFarm?.crop_type !== 'coffee'
                    ) return null;

                    const displayField = field.key === 'quantity' && selectedFarm
                        ? { ...field, label: selectedFarm?.crop_type === 'coffee' ? 'Coffee cherry quantity' : 'Harvest quantity' }
                        : field;
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
                            field={displayField}
                            value={props.values[field.key]}
                            options={options}
                            photo={props.photos[field.key]}
                            captureTime={
                                field.key === 'evidence_photo'
                                    ? props.values.captured_at
                                    : undefined
                            }
                            onChange={(value) => {
                                if (field.kind === 'geojson')
                                    setMeasuredBoundaryPreview(null);
                                if (field.key === 'farm_id') {
                                    props.onChange('coffee_variety', '');
                                    props.onChange(
                                        'estimated_green_bean_quantity_kg',
                                        '',
                                    );
                                    props.onChange('photos_metadata', '');
                                    props.onClearImages();
                                }
                                props.onChange(field.key, value);
                            }}
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
                    onPress={() => {
                        if (verificationCapture && !boundaryDraftReady) {
                            Alert.alert(
                                'Restoring GPS draft',
                                'Wait for saved boundary points to load before submitting.',
                            );
                            return;
                        }
                        props.onSubmit();
                    }}
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
    photo?: ImagePicker.ImagePickerAsset | ImagePicker.ImagePickerAsset[];
    captureTime?: string;
    onChange: (value: any) => void;
    onImage: (camera: boolean) => void;
}) {
    const { field } = props;
    const selectedPhotos = Array.isArray(props.photo)
        ? props.photo
        : props.photo
          ? [props.photo]
          : [];
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
                {field.hint && <Text style={styles.hint}>{field.hint}</Text>}
                {selectedPhotos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`}>
                        <Image
                            source={{ uri: photo.uri }}
                            style={styles.photoPreview}
                        />
                        <Text style={styles.mutedSmall}>
                            {field.multiple
                                ? `Photo ${index + 1} selected`
                                : props.captureTime
                                ? `Captured ${new Date(props.captureTime).toLocaleString()}`
                                : 'Capture time unavailable. The upload time will be recorded.'}
                        </Text>
                    </View>
                ))}
                <View style={styles.imageActions}>
                    {field.cameraOnly ? (
                        <Secondary
                            title={
                                selectedPhotos.length > 0
                                    ? 'Retake face photo'
                                    : 'Capture face photo'
                            }
                            onPress={() => props.onImage(true)}
                        />
                    ) : (
                        <>
                            <Secondary
                                title={field.multiple ? 'Choose photos' : 'Choose photo'}
                                onPress={() => props.onImage(false)}
                            />
                            <Secondary
                                title="Take photo"
                                onPress={() => props.onImage(true)}
                            />
                        </>
                    )}
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
            {recordCode ? (
                <Text style={styles.recordCode}>{String(recordCode)}</Text>
            ) : null}
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
                    <Text style={styles.keyValue}>
                        {displayValue(key, value)}
                    </Text>
                </View>
            ))}
        </View>
    );
}

function Related({ title, rows }: { title: string; rows: any[] }) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>
                {title} <Text style={styles.sectionCount}>{rows.length}</Text>
            </Text>
            {rows.length === 0 ? (
                <Text style={styles.inlineEmpty}>
                    Nothing has been recorded here yet.
                </Text>
            ) : (
                rows.map((item, i) => (
                    <View key={item.id ?? i} style={styles.relatedRow}>
                        <Text style={styles.recordTitle}>
                            {recordTitle(item)}
                        </Text>
                        <Text style={styles.mutedSmall}>
                            {recordSubtitle(item)}
                        </Text>
                    </View>
                ))
            )}
        </View>
    );
}

function VerificationHistory({
    title,
    rows,
    token,
}: {
    title: string;
    rows: any[];
    token: string;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>
                {title} <Text style={styles.sectionCount}>{rows.length}</Text>
            </Text>
            {rows.length === 0 ? (
                <Text style={styles.inlineEmpty}>
                    No inspection history has been recorded.
                </Text>
            ) : (
                rows.map((item: any) => (
                    <View key={item.id} style={styles.historyItem}>
                        <View style={styles.historyHeading}>
                            <View style={styles.flex}>
                                <Text style={styles.recordTitle}>
                                    {item.reference ??
                                        `Verification ${item.id}`}
                                </Text>
                                <Text style={styles.mutedSmall}>
                                    {item.date}
                                    {item.verified_by
                                        ? ` · ${item.verified_by}`
                                        : ''}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.status,
                                    statusStyle(
                                        String(item.result ?? 'in_progress'),
                                    ),
                                ]}
                            >
                                {String(
                                    item.result ?? 'In progress',
                                ).replaceAll('_', ' ')}
                            </Text>
                        </View>
                        <SummaryRow
                            label="Declared area"
                            value={item.declared_area ?? '—'}
                        />
                        <SummaryRow
                            label="Measured area"
                            value={item.measured_area ?? 'Not measured'}
                        />
                        <SummaryRow
                            label="Verified area"
                            value={item.verified_area ?? 'Not verified'}
                        />
                        <SummaryRow
                            label="Difference"
                            value={item.difference ?? '—'}
                        />
                        <SummaryRow
                            label="Variance"
                            value={item.variance ?? '—'}
                        />
                        {item.remarks ? (
                            <Text style={styles.muted}>{item.remarks}</Text>
                        ) : null}
                        {item.inspection_checklist?.observations ? (
                            <Text style={styles.muted}>
                                {item.inspection_checklist.observations}
                            </Text>
                        ) : null}
                        {(item.photos ?? []).length > 0 && (
                            <View style={styles.evidenceGrid}>
                                {item.photos.map((photo: any) => (
                                    <View
                                        key={photo.id}
                                        style={styles.evidenceItem}
                                    >
                                        <Image
                                            source={{
                                                uri: photo.url,
                                                headers: {
                                                    Authorization: `Bearer ${token}`,
                                                },
                                            }}
                                            style={styles.evidenceImage}
                                            accessibilityLabel={withoutDemoWordText(
                                                `Verification evidence: ${photo.name}`,
                                            )}
                                        />
                                        <Text style={styles.mutedSmall}>
                                            {String(
                                                photo.type ??
                                                    'field_inspection',
                                            ).replaceAll('_', ' ')}
                                        </Text>
                                        <Text style={styles.mutedSmall}>
                                            {photo.name}
                                        </Text>
                                        <Text style={styles.mutedSmall}>
                                            {photo.captured_at
                                                ? new Date(
                                                      photo.captured_at,
                                                  ).toLocaleString()
                                                : 'Capture time unavailable'}
                                        </Text>
                                        {photo.latitude != null &&
                                        photo.longitude != null ? (
                                            <Text style={styles.mutedSmall}>
                                                {photo.latitude},{' '}
                                                {photo.longitude}
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))
            )}
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
            <Text style={styles.cardTitle}>
                {title} <Text style={styles.sectionCount}>{rows.length}</Text>
            </Text>
            {rows.length === 0 ? (
                <Text style={styles.inlineEmpty}>
                    No records are linked to this item yet.
                </Text>
            ) : (
                rows.map((row, index) => (
                    <Pressable
                        key={row.id ?? index}
                        onPress={() => onOpen(pathFor(row), recordTitle(row))}
                        style={styles.relatedRow}
                    >
                        <Text style={styles.recordTitle}>
                            {recordTitle(row)}
                        </Text>
                        <Text style={styles.mutedSmall}>
                            {recordSubtitle(row)}
                        </Text>
                    </Pressable>
                ))
            )}
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
    if (/^cooperatives\/\d+$/.test(clean)) return TITLES['cooperatives/show'];
    return (
        TITLES[clean] ??
        TITLES[`${clean}/index`] ??
        clean.split('/').map(pretty).join(' · ')
    );
}
function collectionIcon(component: string): IconName {
    const icons: Record<string, IconName> = {
        'cooperatives/index': 'cooperatives',
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
        'cooperatives/index': 'Cooperative directory and membership totals',
        'farmers/index': 'Farmer profiles and registered farm portfolios',
        'farms/index':
            'Registered land, declared area, and verification status',
        'farm-verification/index':
            'Field assignments and farm verification status',
        'farm-activities/index': 'Recorded work across registered farms',
        'production/index': 'Expected crop output by farm and season',
        'harvest/index': 'Harvest quantities, dates, and receiving status',
        'inventory/index': 'Coffee stock and its current processing stage',
        'inventory/processing': 'Processing activity and coffee movements',
        'traceability/index': 'Coffee lots and their traceable journeys',
        'activity-types/index':
            'Configured activities available to field teams',
    };
    return descriptions[component] ?? 'Live records from SureFarm';
}
function emptyCollectionDescription(component: string) {
    const messages: Record<string, string> = {
        'cooperatives/index': 'Cooperatives will appear here when they are registered.',
        'farmers/index':
            'No farmer profiles match this view. Register a farmer to start a portfolio.',
        'farms/index':
            'No farm records match this view. Farms appear after they are registered.',
        'farm-verification/index':
            'There are no farms in this verification queue right now.',
        'farm-activities/index':
            'Farm activities will appear here after a field record is saved.',
        'production/index':
            'Production records will appear here after they are added to a farm.',
        'harvest/index':
            'Harvest records will appear here after a harvest is recorded.',
        'inventory/index':
            'Inventory lots will appear here after harvest is received or coffee is processed.',
        'inventory/processing':
            'Processing movements will appear here when coffee is processed.',
        'traceability/index':
            'Traceability lots will appear here after a lot is created.',
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
    if (
        ['verified', 'active', 'completed', 'approved', 'received'].includes(
            key,
        )
    )
        return styles.statusPositive;
    if (['failed', 'inactive', 'rejected', 'damaged'].includes(key))
        return styles.statusNegative;
    if (
        [
            'needs_review',
            'in_progress',
            'pending',
            'processing',
            'draft',
        ].includes(key)
    )
        return styles.statusAttention;
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
    if (typeof value === 'number' && key.endsWith('_hectares'))
        return `${value.toLocaleString()} ha`;
    if (
        typeof value === 'string' &&
        [
            'status',
            'verification_status',
            'result',
            'quality_grade',
            'property_ownership',
        ].includes(key)
    ) {
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
        row.farmer_id ? `Farmer ID ${row.farmer_id}` : null,
        row.farm_name ?? row.farm?.farm_name,
        row.cooperative,
        row.location,
        row.crop_label,
        row.declared_area,
        row.measured_area,
        row.boundary_saved != null
            ? row.boundary_saved
                ? 'Boundary saved'
                : 'Boundary not captured'
            : null,
        row.variance,
        row.activity_type,
        row.quantity_label,
        row.production_period,
        row.harvest_date,
        row.received_date,
        row.activity_date,
        row.status_label,
        row.code ? `Code ${row.code}` : null,
        row.active_members_count != null
            ? `${row.active_members_count} active members`
            : null,
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
        if (
            key !== 'search' &&
            value !== '' &&
            value !== null &&
            value !== undefined
        ) {
            query.set(key, String(value));
        }
    });
    const serialized = query.toString();
    return serialized ? `${clean}?${serialized}` : clean;
}
function nextPath(url: string) {
    try {
        const parsed = new URL(url, SITE_URL);
        if (parsed.origin !== new URL(SITE_URL).origin) return '/dashboard';
        const root = '/api/mobile';
        return `${parsed.pathname.startsWith(root) ? parsed.pathname.slice(root.length) : parsed.pathname}${parsed.search}`;
    } catch {
        return '/dashboard';
    }
}
function collectionRows(value: any): any[] {
    if (Array.isArray(value)) return value;
    return Array.isArray(value?.data) ? value.data : [];
}
function checklistAnswer(value: unknown): string {
    return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 'Not recorded';
}
function boundaryPointCount(boundary: any): number {
    const savedAccuracies = boundary?.gps_point_accuracies;
    if (Array.isArray(savedAccuracies) && savedAccuracies.length > 0)
        return savedAccuracies.length;

    try {
        const geometry =
            typeof boundary?.geojson === 'string'
                ? JSON.parse(boundary.geojson)
                : boundary?.geojson;
        const ring =
            geometry?.type === 'Polygon'
                ? geometry.coordinates?.[0]
                : geometry?.type === 'MultiPolygon'
                  ? geometry.coordinates?.[0]?.[0]
                  : null;
        if (!Array.isArray(ring)) return 0;
        const isClosed =
            ring.length > 1 &&
            ring[0]?.[0] === ring[ring.length - 1]?.[0] &&
            ring[0]?.[1] === ring[ring.length - 1]?.[1];
        return Math.max(0, ring.length - (isClosed ? 1 : 0));
    } catch {
        return 0;
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
        'cooperatives/index': `/cooperatives/${id}`,
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
        actions.push({ title: 'Edit farm', path: `/farms/${id}/edit` });
    if (
        component === 'farms/show' &&
        id &&
        operations &&
        data.can_manage_boundary
    )
        actions.push({
            title: 'Edit farm boundary',
            local: 'farm-boundary/edit',
            data: {
                farmId: id,
                hasBoundary: Boolean(data.boundary),
                boundary: data.boundary,
                freshBoundaryCapture: true,
                google_maps_api_key: data.google_maps_api_key,
            },
        });
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
                ? [
                      {
                          title: 'Process coffee',
                          path: `/inventory/process/create?inventory=${id}`,
                      },
                  ]
                : []),
            ...(data.can_trace
                ? [
                      {
                          title: 'Create traceability lot',
                          path: `/traceability/create?inventory=${id}`,
                      },
                  ]
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
        minHeight: 66,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e9efea',
    },
    backButton: {
        width: 42,
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: 48,
    },
    brandButton: { width: 112 },
    headerLogo: { width: 108, height: 32 },
    logo: {
        width: 39,
        height: 39,
        borderRadius: 14,
        backgroundColor: API_FOREST,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: { color: '#ffffff', fontWeight: '800', fontSize: 20 },
    headerCopy: { flex: 1, minWidth: 0, marginLeft: 4 },
    headerTitle: { color: INK, fontSize: 16, fontWeight: '700' },
    headerSub: { color: MUTED, fontSize: 11, marginTop: 3 },
    signOut: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#f1f5f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    page: { flex: 1, backgroundColor: CANVAS },
    content: {
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 28,
    },
    welcome: {
        position: 'relative',
        overflow: 'hidden',
        padding: 21,
        borderRadius: 22,
        backgroundColor: API_FOREST,
        shadowColor: '#17392b',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 2,
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
        fontSize: 27,
        lineHeight: 34,
        fontWeight: '800',
    },
    welcomeBody: {
        maxWidth: 290,
        color: '#d4e3d8',
        marginTop: 8,
        fontSize: 14,
        lineHeight: 21,
    },
    heroAction: {
        minHeight: 48,
        marginTop: 19,
        paddingHorizontal: 14,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
    },
    heroActionText: { color: API_FOREST, fontSize: 13, fontWeight: '700' },
    dashboardHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 25,
        marginBottom: 13,
    },
    dashboardTitle: { color: INK, fontSize: 18, fontWeight: '700' },
    dashboardDate: { color: MUTED, fontSize: 12, marginTop: 4 },
    livePill: {
        minHeight: 30,
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
    liveText: { color: API_FOREST, fontSize: 10, fontWeight: '700' },
    statTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    statCode: {
        width: 32,
        height: 32,
        borderRadius: 11,
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
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    verificationSummaryCard: {
        marginTop: 18,
        padding: 16,
        borderRadius: 21,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e4ebe5',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.055,
        shadowRadius: 14,
        elevation: 2,
    },
    verificationSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    verificationSummaryHint: {
        color: MUTED,
        fontSize: 11,
        marginTop: 3,
    },
    verificationSummaryIcon: {
        width: 38,
        height: 38,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#eaf3eb',
    },
    verificationSummaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 9,
    },
    verificationMetric: {
        width: '48.5%',
        minHeight: 60,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: '#f7f9f7',
    },
    verificationMetricIcon: {
        width: 32,
        height: 32,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verificationMetricCopy: { flex: 1, gap: 2 },
    verificationMetricLabel: {
        color: MUTED,
        fontSize: 10,
        fontWeight: '600',
    },
    verificationMetricValue: {
        fontSize: 20,
        lineHeight: 23,
        fontWeight: '800',
    },
    stat: {
        width: '47%',
        minHeight: 102,
        padding: 13,
        borderRadius: 17,
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e7ede8',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.025,
        shadowRadius: 6,
        elevation: 0.5,
    },
    statValue: {
        color: INK,
        fontSize: 25,
        fontWeight: '800',
        marginTop: 9,
    },
    statLabel: { flex: 1, color: MUTED, fontSize: 11, fontWeight: '600' },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    quickCard: {
        width: '47%',
        minHeight: 142,
        padding: 14,
        borderRadius: 17,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e7ede8',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.025,
        shadowRadius: 6,
        elevation: 0.5,
    },
    quickIcon: {
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: '#edf4ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickTitle: { color: INK, marginTop: 10, fontSize: 13, fontWeight: '700' },
    quickDescription: {
        color: MUTED,
        marginTop: 4,
        fontSize: 11,
        lineHeight: 16,
    },
    card: {
        marginBottom: 13,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e7ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.025,
        shadowRadius: 6,
        elevation: 0.5,
    },
    cardTitle: { color: INK, fontSize: 16, fontWeight: '700', marginBottom: 9 },
    sectionCount: { color: MUTED, fontSize: 11, fontWeight: '600' },
    sectionEyebrow: {
        color: GREEN,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 6,
    },
    profileHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        marginBottom: 15,
    },
    profilePhoto: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: '#edf4ee',
    },
    profilePhotoPlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: '#edf4ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyItem: {
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#edf0ed',
    },
    historyHeading: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    evidenceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 9,
    },
    evidenceItem: { width: '47%', minWidth: 120, gap: 3 },
    evidenceImage: {
        width: '100%',
        height: 132,
        borderRadius: 12,
        backgroundColor: '#e6ece6',
    },
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
    keyLabel: { flex: 1, color: MUTED, fontSize: 12 },
    keyValue: {
        flex: 1.2,
        color: INK,
        textAlign: 'right',
        fontSize: 13,
        fontWeight: '600',
    },
    relatedRow: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#edf0ed',
    },
    recordTitle: { color: INK, fontSize: 14, fontWeight: '700' },
    recordCode: {
        color: MUTED,
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.35,
        marginTop: 4,
    },
    mutedSmall: { color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 4 },
    muted: { color: MUTED, fontSize: 13, lineHeight: 19 },
    recordCard: {
        marginTop: 10,
        padding: 15,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#e7ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.025,
        shadowRadius: 6,
        elevation: 0.5,
    },
    recordTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    status: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginTop: 8,
        borderRadius: 20,
        backgroundColor: '#edf4ed',
        color: API_FOREST,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    statusPositive: { color: '#1f6541', backgroundColor: '#e6f3e9' },
    statusAttention: { color: '#805d12', backgroundColor: '#fbf2d9' },
    statusNegative: { color: '#9a3c35', backgroundColor: '#fbe9e7' },
    statusNeutral: { color: '#58655c', backgroundColor: '#edf0ed' },
    featureCard: {
        minHeight: 78,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#e7ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.025,
        shadowRadius: 6,
        elevation: 0.5,
    },
    collectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
    },
    collectionHeaderIcon: {
        width: 46,
        height: 46,
        borderRadius: 15,
        backgroundColor: '#e8f0e8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    collectionTitle: { color: INK, fontSize: 20, fontWeight: '700' },
    rowIdentity: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
    },
    rowIcon: {
        width: 38,
        height: 38,
        borderRadius: 13,
        backgroundColor: '#edf4ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureIcon: {
        width: 43,
        height: 43,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#edf4ee',
    },
    bottomBar: {
        minHeight: 72,
        paddingTop: 5,
        paddingBottom: 5,
        borderTopWidth: 1,
        borderTopColor: '#e7ece7',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    bottomItem: {
        flex: 1,
        minHeight: 58,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    bottomIcon: {
        minWidth: 50,
        height: 32,
        paddingHorizontal: 13,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomIconActive: { backgroundColor: '#e8f0e8' },
    bottomLabel: {
        color: MUTED,
        marginTop: 1,
        fontSize: 11,
        fontWeight: '600',
    },
    bottomLabelActive: { color: API_FOREST, fontWeight: '800' },
    primary: {
        minHeight: 49,
        marginTop: 10,
        paddingHorizontal: 17,
        borderRadius: 14,
        backgroundColor: API_FOREST,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    secondary: {
        minHeight: 44,
        marginTop: 6,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#dce5dc',
        borderRadius: 13,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationMeasureButton: {
        minHeight: 48,
        marginTop: 9,
        flexDirection: 'row',
        gap: 8,
    },
    locationMeasureDisabled: { opacity: 0.7 },
    secondaryText: { color: API_FOREST, fontSize: 12, fontWeight: '700' },
    pressed: { opacity: 0.72 },
    notice: {
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        color: '#52655a',
        backgroundColor: '#e9f0e9',
        fontSize: 12,
        lineHeight: 18,
    },
    summaryStrip: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
        gap: 8,
        borderRadius: 15,
        backgroundColor: '#ffffff',
    },
    summaryCell: {
        flex: 1,
        minWidth: '44%',
        padding: 12,
        borderRadius: 13,
        backgroundColor: '#f7f9f7',
    },
    summaryNumber: { color: API_FOREST, fontSize: 19, fontWeight: '700' },
    inlineEmpty: {
        color: MUTED,
        fontSize: 12,
        lineHeight: 18,
        paddingVertical: 10,
    },
    noticeCard: {
        marginBottom: 12,
        padding: 13,
        borderRadius: 15,
        backgroundColor: '#edf4ee',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 8,
    },
    searchInput: { flex: 1, marginBottom: 0 },
    searchBtn: {
        minHeight: 49,
        paddingHorizontal: 14,
        borderRadius: 14,
        flexDirection: 'row',
        gap: 7,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e6efe6',
    },
    searchText: { color: API_FOREST, fontSize: 12, fontWeight: '700' },
    filterGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 9,
        marginBottom: 9,
    },
    filterField: { flex: 1, minWidth: 145 },
    filterLabel: {
        color: MUTED,
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 5,
    },
    filterPicker: {
        minHeight: 46,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e1e8e2',
        borderRadius: 13,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
    },
    filterPickerControl: { height: 47, color: INK, fontSize: 12 },
    formContent: { padding: 16, paddingBottom: 30 },
    formIntro: {
        padding: 17,
        marginBottom: 4,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e7ede8',
    },
    reviewCard: {
        marginTop: 13,
        padding: 15,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#dce8dd',
        backgroundColor: '#eff5f0',
    },
    reviewHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 3,
    },
    formTitle: { color: INK, fontSize: 20, fontWeight: '700', marginBottom: 5 },
    gpsAccuracy: {
        color: API_FOREST,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 7,
    },
    locationMeasureError: { color: '#a23b34' },
    locationMeasureSuccess: { color: '#28724c' },
    locationCard: {
        marginTop: 13,
        padding: 13,
        borderRadius: 14,
        backgroundColor: '#e9f0e9',
    },
    locationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    locationIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    coordinateText: {
        color: MUTED,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 8,
    },
    field: { marginTop: 13 },
    fieldLabel: {
        color: '#34443a',
        marginBottom: 6,
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    input: {
        minHeight: 49,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#dfe7e0',
        borderRadius: 13,
        backgroundColor: '#ffffff',
        color: INK,
        fontSize: 14,
    },
    multiline: { minHeight: 100, paddingTop: 13, textAlignVertical: 'top' },
    pickerBox: {
        minHeight: 50,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#dfe7e0',
        borderRadius: 13,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
    },
    picker: { height: 52, color: INK },
    toggle: {
        minHeight: 54,
        marginTop: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e1e7e1',
        borderRadius: 14,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
    },
    hint: { color: MUTED, fontSize: 11, marginBottom: 6 },
    photoPreview: {
        width: '100%',
        height: 180,
        marginBottom: 7,
        borderRadius: 15,
    },
    imageActions: { flexDirection: 'row', gap: 8 },
    inline: { flexDirection: 'row', gap: 18, marginTop: 8 },
    link: { alignSelf: 'flex-start', paddingVertical: 8 },
    linkText: { color: API_FOREST, fontSize: 12, fontWeight: '700' },
    errorText: { color: '#a33c32', fontSize: 13, marginTop: 10 },
    entity: {
        marginBottom: 13,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e7ede8',
        backgroundColor: '#ffffff',
    },
    entityTitle: {
        color: INK,
        fontSize: 19,
        fontWeight: '700',
        marginBottom: 5,
    },
    entityTitleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    entityPhoto: {
        width: '100%',
        height: 180,
        borderRadius: 15,
        marginBottom: 12,
        backgroundColor: '#e6ece6',
    },
    empty: { alignItems: 'center', padding: 36, gap: 8 },
    setupCard: {
        marginTop: 17,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e7ede8',
        backgroundColor: '#ffffff',
    },
    setupIcon: {
        width: 50,
        height: 50,
        borderRadius: 17,
        backgroundColor: '#eaf2eb',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    accountInfo: {
        minHeight: 46,
        paddingHorizontal: 12,
        marginTop: 16,
        borderRadius: 14,
        backgroundColor: '#f5f8f5',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    accountInfoText: { color: INK, fontSize: 13, fontWeight: '600' },
    setupNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 13,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#edf0ed',
    },
    setupNoteText: { flex: 1, color: MUTED, fontSize: 11, lineHeight: 16 },
    moduleHero: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 22,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e7ede8',
    },
    moduleIcon: {
        width: 68,
        height: 68,
        borderRadius: 22,
        backgroundColor: '#e8f0e8',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    moduleEyebrow: {
        color: GREEN,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.2,
    },
    moduleTitle: {
        color: INK,
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 7,
    },
    comingSoonPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 15,
        backgroundColor: '#f1f3ee',
        marginTop: 15,
    },
    comingSoonDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#a58d44',
    },
    comingSoonText: { color: '#71663d', fontSize: 11, fontWeight: '700' },
    progressTrack: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 12,
    },
    progressStep: { flex: 1, alignItems: 'center', gap: 6 },
    progressDot: {
        width: 27,
        height: 27,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#dce5dc',
        backgroundColor: '#f5f7f4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressDotDone: { backgroundColor: API_FOREST, borderColor: API_FOREST },
    progressDotActive: { backgroundColor: '#e8f0e8', borderColor: GREEN },
    progressNumber: { color: MUTED, fontSize: 10, fontWeight: '700' },
    progressNumberActive: { color: API_FOREST },
    progressLabel: { color: MUTED, fontSize: 10 },
    progressLabelActive: { color: API_FOREST, fontWeight: '800' },
    boundaryIcon: {
        width: 36,
        height: 36,
        borderRadius: 13,
        backgroundColor: '#edf4ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    boundaryPreview: {
        overflow: 'hidden',
        marginTop: 11,
        borderRadius: 15,
        backgroundColor: '#f7faf7',
    },
    boundaryFacts: {
        flexDirection: 'row',
        paddingTop: 12,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#edf0ed',
    },
    boundaryFact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    boundaryAccuracyList: {
        marginTop: 8,
        paddingTop: 7,
        borderTopWidth: 1,
        borderTopColor: '#edf0ed',
    },
    boundaryValue: {
        color: INK,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    linkedFarmer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 13,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5eae5',
        backgroundColor: '#ffffff',
    },
    linkedFarmerIcon: {
        width: 39,
        height: 39,
        borderRadius: 13,
        backgroundColor: '#edf4ee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heading: { color: INK, fontSize: 19, fontWeight: '700', marginBottom: 6 },
    loginSafe: { flex: 1, backgroundColor: CANVAS },
    loginWrap: {
        width: '100%',
        maxWidth: 480,
        flexGrow: 1,
        alignSelf: 'center',
        justifyContent: 'center',
        padding: 24,
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
        padding: 23,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#e7ede8',
        backgroundColor: '#ffffff',
        shadowColor: '#20392a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 15,
        elevation: 2,
    },
    loginHeading: { color: INK, fontSize: 22, fontWeight: '700' },
    loginHelp: { color: MUTED, fontSize: 13, marginTop: 7, marginBottom: 10 },
    loginFoot: {
        color: MUTED,
        textAlign: 'center',
        marginTop: 17,
        fontSize: 11,
    },
});
