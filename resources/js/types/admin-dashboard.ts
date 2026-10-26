export type RegistryOption = {
    value: string;
    label: string;
    reference?: string;
};

export type RegistryFilters = {
    search: string;
    province: string;
    municipality: string;
    barangay: string;
    farmer: string;
    farm: string;
    crop: string;
    verification_status: string;
    status: string;
    boundary: string;
    location: string;
    area: string;
    registered_from: string;
    registered_to: string;
    updated_from: string;
    updated_to: string;
    layer: string;
    rank: string;
    trend: string;
    trend_from: string;
    trend_to: string;
    sort: string;
    direction: string;
    per_page: number;
};

export type RegistryMetric = {
    key: string;
    label: string;
    display: string;
    detail: string;
    href: string | null;
};

export type GeographyRow = {
    label: string;
    farms: number;
    declared_hectares: number;
    verified_hectares: number;
    href: string;
};

export type OwnerRow = {
    farmer_id: number;
    farmer_name: string;
    farmer_reference: string;
    farms: number;
    declared_hectares: number;
    verified_hectares: number;
    verified_farms: number;
    pending_farms: number;
    profile_href: string | null;
    filter_href: string;
};

export type CropRow = {
    crop: string;
    label: string;
    farms: number;
    declared_hectares: number;
    verified_hectares: number;
};

export type StatusRow = {
    status: string;
    label: string;
    farms: number;
    declared_hectares: number;
    href: string;
};

export type TrendPoint = {
    label: string;
    farmers: number;
    farms: number;
    verified: number;
};

export type MapFeature = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_id: number;
    farmer_name: string;
    farmer_reference: string;
    province: string | null;
    municipality: string | null;
    barangay: string | null;
    crop_label: string;
    declared_area_hectares: number;
    measured_area_hectares: number | null;
    verified_area_hectares: number | null;
    verification_status: string;
    verification_label: string;
    status: string;
    status_label: string;
    boundary_status: 'mapped' | 'missing';
    tenure: string | null;
    updated_at: string | null;
    latitude: number | null;
    longitude: number | null;
    boundary: {
        type: string;
        coordinates: [number, number][][];
    } | null;
    farm_href: string;
    farmer_href: string;
};

export type RegistryFarm = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_id: number;
    farmer_name: string;
    farmer_reference: string;
    province: string | null;
    municipality: string | null;
    barangay: string | null;
    crop_label: string;
    declared_area_hectares: number;
    verified_area_hectares: number | null;
    verification_status: string;
    status: string;
    boundary_status: 'mapped' | 'missing';
    tenure: string | null;
    updated_at: string | null;
    farm_href: string;
    farmer_href: string;
};

export type RegistryPayload = {
    scope: string;
    timezone: string;
    filters: RegistryFilters;
    active_filters: { label: string; href: string }[];
    options: {
        provinces: RegistryOption[];
        municipalities: RegistryOption[];
        barangays: RegistryOption[];
        farmers: RegistryOption[];
        farmers_limited: boolean;
        farms: RegistryOption[];
        crops: RegistryOption[];
        verification_statuses: RegistryOption[];
        statuses: RegistryOption[];
        boundaries: RegistryOption[];
        layers: RegistryOption[];
        ranks: RegistryOption[];
        trends: RegistryOption[];
    };
    metrics: RegistryMetric[];
    charts: {
        comparison: { label: string; hectares: number }[];
        geography: { level: string; rows: GeographyRow[] };
        owners: OwnerRow[];
        crops: CropRow[];
        statuses: StatusRow[];
        trend: {
            window: string;
            monthly: boolean;
            note: string;
            points: TrendPoint[];
        };
    };
    map: {
        layer: string;
        matched: number;
        drawn: number;
        truncated: boolean;
        undrawn: number;
        features: MapFeature[];
    };
    farms: {
        data: RegistryFarm[];
        total: number;
        from: number | null;
        to: number | null;
        current_page: number;
        last_page: number;
        per_page: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    insights: {
        tone: 'action' | 'review' | 'info';
        title: string;
        detail: string;
        count: number;
        href: string;
    }[];
    operations: {
        harvest: {
            expected_label: string;
            actual_label: string;
            remaining_label: string;
            exceeds: boolean;
            message: string | null;
            progress: number | null;
            has_records: boolean;
            harvesting_farms: number;
        };
        inventory: {
            stages: {
                id: number;
                name: string;
                code: string;
                sequence: number;
                quantity: number;
                unit: string;
                label: string;
            }[];
            total_label: string;
            has_records: boolean;
            chart: {
                name: string;
                quantity: number;
                unit: string;
                share: number;
            }[];
        };
        activities: {
            id: number;
            activity_date: string | null;
            farm_id: number;
            farm_name: string;
            activity: string | null;
            status: string;
            status_label: string;
            href: string;
        }[];
        registrations: {
            id: number;
            farm_id: string;
            farm_name: string;
            farmer_name: string;
            verification_status: string;
            verification_label: string;
            registered_at: string | null;
            href: string;
        }[];
    };
    administration: {
        users: { role: string; label: string; count: number }[];
        suspended_users: number;
        open_invitations: number;
        cooperatives: { status: string; label: string; count: number }[];
        open_grants: number;
        users_href: string;
        cooperatives_href: string;
        events: { action: string; actor: string; at: string | null }[];
    };
    notes: string[];
};
