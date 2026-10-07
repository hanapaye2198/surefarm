import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
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
import { ApiError, apiRequest, API_URL } from './src/api';
import {
    formForPage,
    initialFieldValues,
    optionList,
    type FieldSpec,
    type FormSpec,
} from './src/forms';

type Role = 'admin' | 'operations' | 'field_verifier' | 'farmer';
type User = { id: number; name: string; email: string; role: Role };
type Page = { component: string; data: Record<string, any> };
type Screen = { path: string; title: string };
type Section = {
    key: string;
    title: string;
    description: string;
    path: string;
    glyph: string;
    roles?: Role[];
};

const TOKEN_KEY = 'surefarm.mobile.access-token';

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
const GREEN = '#477958';
const CANVAS = '#f4f7f3';
const INK = '#25342b';
const MUTED = '#738078';

const SECTIONS: Section[] = [
    {
        key: 'dashboard',
        title: 'Dashboard',
        description: 'Farm program overview and recent activity',
        path: '/dashboard',
        glyph: '⌂',
    },
    {
        key: 'farmers',
        title: 'Farmers',
        description: 'Farmer registry and farm portfolios',
        path: '/farmers',
        roles: ['operations', 'field_verifier'],
        glyph: '♙',
    },
    {
        key: 'farms',
        title: 'Farms & map',
        description: 'Farm records, coordinates, and boundaries',
        path: '/farms',
        roles: ['operations', 'field_verifier'],
        glyph: '⌖',
    },
    {
        key: 'farm-verification',
        title: 'Farm verification',
        description: 'Review and record field results',
        path: '/farm-verification',
        roles: ['field_verifier'],
        glyph: '✓',
    },
    {
        key: 'farm-activities',
        title: 'Farm activities',
        description: 'Field work, costs, and history',
        path: '/farm-activities',
        roles: ['operations', 'field_verifier'],
        glyph: '☷',
    },
    {
        key: 'production',
        title: 'Production',
        description: 'Expected output and production periods',
        path: '/production',
        roles: ['operations', 'field_verifier'],
        glyph: '♧',
    },
    {
        key: 'harvest',
        title: 'Harvest',
        description: 'Actual harvest records and receiving',
        path: '/harvest',
        roles: ['operations', 'field_verifier'],
        glyph: '✳',
    },
    {
        key: 'inventory',
        title: 'Inventory',
        description: 'Coffee stock and inventory movements',
        path: '/inventory',
        roles: ['operations', 'field_verifier'],
        glyph: '▤',
    },
    {
        key: 'processing',
        title: 'Coffee processing',
        description: 'Processing stages and movements',
        path: '/inventory/processing',
        roles: ['operations', 'field_verifier'],
        glyph: '⚙',
    },
    {
        key: 'traceability',
        title: 'Traceability',
        description: 'Coffee lots and journey history',
        path: '/traceability',
        roles: ['operations', 'field_verifier'],
        glyph: '▦',
    },
    {
        key: 'cooperatives',
        title: 'Cooperatives',
        description: 'Cooperative directory',
        path: '/modules/cooperatives',
        glyph: '♧',
    },
    {
        key: 'crop-management',
        title: 'Crop management',
        description: 'Crop program workspace',
        path: '/modules/crop-management',
        glyph: '❧',
    },
    {
        key: 'finance',
        title: 'Finance',
        description: 'Farm financing workspace',
        path: '/modules/finance',
        glyph: '₱',
    },
    {
        key: 'insurance',
        title: 'Insurance',
        description: 'Farm insurance workspace',
        path: '/modules/insurance',
        glyph: '◇',
    },
    {
        key: 'logistics-export',
        title: 'Logistics & export',
        description: 'Logistics workspace',
        path: '/modules/logistics-export',
        glyph: '⇢',
    },
    {
        key: 'reports',
        title: 'Reports',
        description: 'Program reporting workspace',
        path: '/modules/reports',
        glyph: '▥',
    },
    {
        key: 'activity-types',
        title: 'Activity types',
        description: 'Configure farm activities',
        path: '/settings/activity-types',
        roles: ['admin'],
        glyph: '☷',
    },
];

const ROLE_LABEL: Record<Role, string> = {
    admin: 'Administrator',
    operations: 'Operations',
    field_verifier: 'Field verifier',
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
                (item) =>
                    !item.roles ||
                    user?.role === 'admin' ||
                    (user && item.roles.includes(user.role)),
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
        setSearch('');
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
        setSearch('');
        const path = previous[previous.length - 1].path;
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
                    style={styles.backButton}
                    onPress={() => void back()}
                >
                    {stack.length > 1 ? (
                        <Text style={styles.backGlyph}>‹</Text>
                    ) : (
                        <View style={styles.logo}>
                            <Text style={styles.logoText}>S</Text>
                        </View>
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
                    <Text style={styles.signOutText}>↗</Text>
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
                    glyph="⌂"
                    onPress={() => {
                        setPanel('page');
                        setStack([{ path: '/dashboard', title: 'Dashboard' }]);
                        void loadPage('/dashboard');
                    }}
                />
                <BottomItem
                    label="Features"
                    active={panel === 'features'}
                    glyph="▦"
                    onPress={() => setPanel('features')}
                />
                <BottomItem
                    label="Account"
                    active={
                        panel === 'page' &&
                        current.path.startsWith('/settings/')
                    }
                    glyph="◉"
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
                        <View style={styles.loginLogo}>
                            <Text style={styles.loginLogoText}>S</Text>
                        </View>
                        <Text style={styles.loginName}>SureFarm</Text>
                        <Text style={styles.loginTagline}>
                            Coffee farm operations
                        </Text>
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
    const summary = page.data.summary ?? {};
    const stats = [
        { label: 'Registered farmers', value: summary.registered_farmers ?? 0 },
        { label: 'Registered farms', value: summary.registered_farms ?? 0 },
        { label: 'Pending', value: summary.pending_verification ?? 0 },
        { label: 'In progress', value: summary.in_progress ?? 0 },
        { label: 'Verified', value: summary.verified_farms ?? 0 },
        { label: 'Needs review', value: summary.needs_review ?? 0 },
    ];
    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? 'Good morning'
            : hour < 18
              ? 'Good afternoon'
              : 'Good evening';
    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
            <View style={styles.welcome}>
                <Text style={styles.eyebrow}>
                    SUREFARM · {ROLE_LABEL[user?.role ?? 'admin'].toUpperCase()}
                </Text>
                <Text style={styles.welcomeTitle}>
                    {greeting}
                    {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </Text>
                <Text style={styles.welcomeBody}>
                    Your live overview of farmer registrations, farm
                    verification, and harvest activity.
                </Text>
            </View>
            <Heading title="Program snapshot" />
            <View style={styles.stats}>
                {stats.map(({ label, value }) => (
                    <View key={label} style={styles.stat}>
                        <Text style={styles.statLabel}>{label}</Text>
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
                <Heading title="Workspaces" />
                <Text style={styles.sectionHint}>Open a workspace</Text>
            </View>
            <View style={styles.quickGrid}>
                {sections
                    .filter((s) => s.key !== 'dashboard')
                    .slice(0, 6)
                    .map((item) => (
                        <Pressable
                            key={item.key}
                            onPress={() => onOpen(item)}
                            style={styles.quickCard}
                        >
                            <View style={styles.quickIcon}>
                                <Text style={styles.quickGlyph}>
                                    {item.glyph}
                                </Text>
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
                            glyph: '✳',
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
                            glyph: '▦',
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
                        style={styles.featureCard}
                    >
                        <View style={styles.featureIcon}>
                            <Text style={styles.quickGlyph}>{item.glyph}</Text>
                        </View>
                        <View style={styles.flex}>
                            <Text style={styles.recordTitle}>{item.title}</Text>
                            <Text style={styles.mutedSmall}>
                                {item.description}
                            </Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
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
    const collectionName = COLLECTION[page.component];
    const collection = collectionName ? page.data[collectionName] : null;
    const rows: any[] = Array.isArray(collection)
        ? collection
        : Array.isArray(collection?.data)
          ? collection.data
          : [];

    if (collectionName) {
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
                                    withSearch(props.path, props.search),
                                    titleFor(props.path),
                                )
                            }
                            returnKeyType="search"
                        />
                        <Pressable
                            style={styles.searchBtn}
                            onPress={() =>
                                props.onOpen(
                                    withSearch(props.path, props.search),
                                    titleFor(props.path),
                                )
                            }
                        >
                            <Text style={styles.searchText}>Search</Text>
                        </Pressable>
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
                        title="No records found"
                        detail="Try changing your search or filters."
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
                                style={styles.recordCard}
                            >
                                <View style={styles.recordTop}>
                                    <Text style={styles.recordTitle}>
                                        {recordTitle(row)}
                                    </Text>
                                    <Text style={styles.chevron}>›</Text>
                                </View>
                                <Text style={styles.mutedSmall}>
                                    {recordSubtitle(row)}
                                </Text>
                                {(row.status_label ||
                                    row.verification_status) && (
                                    <Text style={styles.status}>
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
        return (
            <ScrollView
                style={styles.page}
                contentContainerStyle={styles.content}
            >
                <Entity
                    data={farm}
                    title={farm.farm_name ?? 'Farm verification'}
                />
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
                {page.data.boundary && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            Saved farm boundary
                        </Text>
                        <Text style={styles.mutedSmall}>
                            {page.data.boundary.gps_measured_area_hectares}{' '}
                            hectares · {page.data.boundary.captured_at}
                        </Text>
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
                {(props.user.role === 'field_verifier' ||
                    props.user.role === 'admin') &&
                    farm.verification_status === 'pending' && (
                        <Primary
                            title="Start verification"
                            busy={props.busy}
                            onPress={() => props.onStartVerification(farm.id)}
                        />
                    )}
                {(props.user.role === 'field_verifier' ||
                    props.user.role === 'admin') &&
                    farm.verification_status === 'in_progress' && (
                        <Primary
                            title="Record verification result"
                            onPress={() =>
                                props.onLocalForm(
                                    'farm-verification/decision',
                                    { farmId: farm.id },
                                )
                            }
                        />
                    )}
                {page.data.history?.length > 0 && (
                    <Related
                        title="Verification history"
                        rows={page.data.history}
                    />
                )}
            </ScrollView>
        );
    }

    if (page.component === 'modules/placeholder')
        return (
            <View style={styles.center}>
                <Text style={styles.emptyGlyph}>⌑</Text>
                <Text style={styles.heading}>
                    {page.data.title ?? 'Workspace'}
                </Text>
                <Text style={styles.muted}>
                    {page.data.description ??
                        'This workspace is part of the SureFarm program.'}
                </Text>
            </View>
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
                {page.component === 'farmers/show' &&
                    page.data.farmer?.farms?.length > 0 && (
                        <RelatedLinks
                            title="Farms"
                            rows={page.data.farmer.farms}
                            pathFor={(row) => `/farms/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farmers/show' &&
                    page.data.farmer?.recent_activities?.length > 0 && (
                        <Related
                            title="Recent activities"
                            rows={page.data.farmer.recent_activities}
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.activities?.length > 0 && (
                        <RelatedLinks
                            title="Farm activities"
                            rows={page.data.farm.activities}
                            pathFor={(row) => `/farm-activities/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.productions?.length > 0 && (
                        <RelatedLinks
                            title="Production records"
                            rows={page.data.farm.productions}
                            pathFor={(row) => `/production/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.harvests?.length > 0 && (
                        <RelatedLinks
                            title="Harvest records"
                            rows={page.data.farm.harvests}
                            pathFor={(row) => `/harvest/${row.id}`}
                            onOpen={props.onOpen}
                        />
                    )}
                {page.component === 'farms/show' &&
                    page.data.farm?.traceability_lots?.length > 0 && (
                        <RelatedLinks
                            title="Traceability lots"
                            rows={page.data.farm.traceability_lots}
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
                {page.data.events && (
                    <Related title="Lot journey" rows={page.data.events} />
                )}
                {page.data.farm_coverage?.length > 0 && (
                    <CoverageActions
                        rows={page.data.farm_coverage}
                        onOpen={props.onOpen}
                    />
                )}
                {page.component === 'farms/show' && page.data.farm && (
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
                {page.data.boundary?.boundary_geojson && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Farm boundary</Text>
                        <Text style={styles.mutedSmall}>
                            Measured area:{' '}
                            {page.data.boundary.gps_measured_area_hectares}{' '}
                            hectares
                        </Text>
                    </View>
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
                <Text style={styles.muted}>
                    Enter the record details. Laravel will validate them before
                    saving.
                </Text>
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
            <Text style={styles.entityTitle}>{title}</Text>
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
                    <Text style={styles.keyLabel}>{pretty(key)}</Text>
                    <Text style={styles.keyValue}>{String(value)}</Text>
                </View>
            ))}
        </View>
    );
}

function Related({ title, rows }: { title: string; rows: any[] }) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            {rows.map((item, i) => (
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
            <Text style={styles.cardTitle}>{title}</Text>
            {rows.map((row, index) => (
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

function Heading({ title }: { title: string }) {
    return <Text style={styles.sectionTitle}>{title}</Text>;
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
        <Pressable onPress={onPress} style={styles.secondary}>
            <Text style={styles.secondaryText}>{title}</Text>
        </Pressable>
    );
}
function Empty({ title, detail }: { title: string; detail: string }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>⌑</Text>
            <Text style={styles.heading}>{title}</Text>
            <Text style={styles.muted}>{detail}</Text>
        </View>
    );
}
function BottomItem({
    label,
    glyph,
    active,
    onPress,
}: {
    label: string;
    glyph: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.bottomItem}
        >
            <View
                style={[styles.bottomIcon, active && styles.bottomIconActive]}
            >
                <Text
                    style={[
                        styles.bottomGlyph,
                        active && styles.bottomGlyphActive,
                    ]}
                >
                    {glyph}
                </Text>
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
            row.activity ??
            row.lot_code ??
            row.farm_id ??
            row.farmer_id ??
            row.id ??
            'Record',
    );
}
function recordSubtitle(row: Record<string, any>) {
    return [
        row.farmer_name,
        row.cooperative,
        row.location,
        row.crop_label,
        row.quantity_label,
        row.production_period,
        row.harvest_date,
        row.activity_date,
        row.lot_code,
    ]
        .filter((x) => x !== undefined && x !== null && x !== '')
        .map(String)
        .join(' · ');
}
function withSearch(path: string, search: string) {
    const clean = path.split('?')[0];
    return search.trim()
        ? `${clean}?search=${encodeURIComponent(search.trim())}`
        : clean;
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
    if (component === 'inventory/show' && id && operations)
        actions.push(
            { title: 'Adjust inventory', path: `/inventory/${id}/adjust` },
            { title: 'Record damage', path: `/inventory/${id}/damage` },
            {
                title: 'Process coffee',
                path: `/inventory/process/create?inventory=${id}`,
            },
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
        height: 64,
        paddingHorizontal: 14,
        backgroundColor: API_FOREST,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: { width: 42, justifyContent: 'center' },
    backGlyph: { color: '#ffffff', fontSize: 35, lineHeight: 39 },
    logo: {
        width: 34,
        height: 34,
        borderRadius: 11,
        backgroundColor: '#dcebdd',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: { color: API_FOREST, fontWeight: '800', fontSize: 20 },
    headerCopy: { flex: 1, marginLeft: 4 },
    headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    headerSub: { color: '#cad9cd', fontSize: 10, marginTop: 3 },
    signOut: {
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: '#ffffff1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    signOutText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
    page: { flex: 1, backgroundColor: CANVAS },
    content: { padding: 16, paddingBottom: 25 },
    welcome: { padding: 18, borderRadius: 20, backgroundColor: API_FOREST },
    eyebrow: {
        color: '#b8d0bd',
        letterSpacing: 1.3,
        fontSize: 10,
        fontWeight: '700',
    },
    welcomeTitle: {
        color: '#ffffff',
        marginTop: 10,
        fontSize: 23,
        fontWeight: '700',
    },
    welcomeBody: {
        color: '#d0dfd2',
        marginTop: 6,
        fontSize: 12,
        lineHeight: 18,
    },
    sectionTitle: {
        color: INK,
        fontSize: 15,
        fontWeight: '700',
        marginTop: 21,
        marginBottom: 10,
    },
    sectionHeadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionHint: { color: MUTED, fontSize: 10, marginTop: 11 },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    stat: {
        width: '48%',
        minHeight: 82,
        padding: 13,
        borderRadius: 16,
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5eae5',
    },
    statValue: {
        color: API_FOREST,
        fontSize: 23,
        fontWeight: '800',
        marginTop: 5,
    },
    statLabel: { color: MUTED, fontSize: 10, fontWeight: '600' },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    quickCard: {
        width: '48%',
        minHeight: 127,
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5eae5',
    },
    quickIcon: {
        width: 32,
        height: 32,
        borderRadius: 11,
        backgroundColor: '#e8f0e8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickGlyph: { color: API_FOREST, fontSize: 19, fontWeight: '700' },
    quickTitle: { color: INK, marginTop: 9, fontSize: 12, fontWeight: '700' },
    quickDescription: {
        color: MUTED,
        marginTop: 4,
        fontSize: 10,
        lineHeight: 14,
    },
    card: {
        marginBottom: 12,
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5eae5',
        backgroundColor: '#ffffff',
    },
    cardTitle: { color: INK, fontSize: 15, fontWeight: '700', marginBottom: 8 },
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
    mutedSmall: { color: MUTED, fontSize: 10, lineHeight: 15, marginTop: 4 },
    muted: { color: MUTED, fontSize: 12, lineHeight: 18 },
    recordCard: {
        marginTop: 9,
        padding: 14,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#e5eae5',
        backgroundColor: '#ffffff',
    },
    recordTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    chevron: { color: '#97a39a', fontSize: 24 },
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
    featureCard: {
        minHeight: 70,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#e5eae5',
        backgroundColor: '#ffffff',
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e8f0e8',
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
    bottomGlyph: { color: MUTED, fontSize: 19, lineHeight: 23 },
    bottomGlyphActive: { color: API_FOREST },
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e6efe6',
    },
    searchText: { color: API_FOREST, fontSize: 12, fontWeight: '700' },
    formContent: { padding: 16, paddingBottom: 30 },
    locationCard: {
        marginTop: 13,
        padding: 13,
        borderRadius: 14,
        backgroundColor: '#e9f0e9',
    },
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
    entityPhoto: {
        width: '100%',
        height: 170,
        borderRadius: 13,
        marginBottom: 12,
        backgroundColor: '#e6ece6',
    },
    empty: { alignItems: 'center', padding: 40 },
    emptyGlyph: { color: '#9aab9d', fontSize: 36 },
    heading: { color: INK, fontSize: 18, fontWeight: '700', marginBottom: 6 },
    loginSafe: { flex: 1, backgroundColor: API_FOREST },
    loginWrap: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    loginBrand: { alignItems: 'center', marginBottom: 25 },
    loginLogo: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0ede1',
    },
    loginLogoText: { color: API_FOREST, fontSize: 32, fontWeight: '800' },
    loginName: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '800',
        marginTop: 12,
    },
    loginTagline: { color: '#cad9cd', fontSize: 12, marginTop: 3 },
    loginCard: { padding: 18, borderRadius: 21, backgroundColor: '#ffffff' },
    loginHeading: { color: INK, fontSize: 19, fontWeight: '700' },
    loginHelp: { color: MUTED, fontSize: 12, marginTop: 6, marginBottom: 8 },
    loginFoot: {
        color: '#cad9cd',
        textAlign: 'center',
        marginTop: 17,
        fontSize: 10,
    },
});
