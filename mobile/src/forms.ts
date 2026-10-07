export type Option = { value: string; label: string };

export type FieldSpec = {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'date' | 'email' | 'phone' | 'select' | 'toggle' | 'image' | 'geojson';
  required?: boolean;
  multiline?: boolean;
  options?: string | Option[];
  optional?: boolean;
  hint?: string;
};

export type FormSpec = {
  title: string;
  method: 'POST' | 'PUT' | 'PATCH';
  path: string;
  fields: FieldSpec[];
};

type Data = Record<string, any>;

const text = (key: string, label?: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label: label ?? key.replaceAll('_', ' '), ...extra });

export function formForPage(component: string, data: Data): FormSpec | null {
  const farmerId = data.farmer?.id;
  const itemId = data.farmer?.id ?? data.farm?.id ?? data.activity?.id ?? data.production?.id ?? data.harvest?.id ?? data.inventory?.id ?? data.activityType?.id;

  switch (component) {
    case 'farmers/create':
      return { title: 'Register farmer', method: 'POST', path: '/farmers', fields: [
        text('first_name', 'First name', { required: true }), text('middle_name', 'Middle name'), text('last_name', 'Last name', { required: true }),
        text('date_of_birth', 'Date of birth', { kind: 'date' }), text('government_id', 'Government ID'),
        text('purok_sitio', 'Purok / sitio', { required: true }), text('barangay', 'Barangay', { required: true }),
        text('municipality', 'Municipality / city', { required: true }), text('province', 'Province', { required: true }),
        text('mobile_number', 'Mobile number', { kind: 'phone', required: true }), text('email', 'Email', { kind: 'email' }),
        { key: 'cooperative_id', label: 'Cooperative', kind: 'select', options: 'cooperatives', optional: true },
        { key: 'photo', label: 'Farmer photo', kind: 'image' }, { key: 'has_spouse', label: 'Record spouse details', kind: 'toggle' },
        text('spouse_first_name', 'Spouse first name'), text('spouse_middle_name', 'Spouse middle name'), text('spouse_last_name', 'Spouse last name'),
        { key: 'has_bank_account', label: 'Record bank account', kind: 'toggle' }, text('bank_name', 'Bank name'),
        text('account_number', 'Account number', { kind: 'number' }), text('account_name', 'Account name'),
        { key: 'bank_account_status', label: 'Bank account status', kind: 'select', options: [
          { value: 'unverified', label: 'Unverified' }, { value: 'verified', label: 'Verified' },
        ] },
      ] };
    case 'farmers/edit':
      return { title: 'Edit farmer', method: 'PUT', path: `/farmers/${itemId}`, fields: [
        text('date_of_birth', 'Date of birth', { kind: 'date' }), text('government_id', 'Government ID'),
        { key: 'has_bank_account', label: 'Record bank account', kind: 'toggle' }, text('bank_name', 'Bank name'),
        text('account_number', 'Account number', { kind: 'number' }), text('account_name', 'Account name'),
        { key: 'bank_account_status', label: 'Bank account status', kind: 'select', options: [
          { value: 'unverified', label: 'Unverified' }, { value: 'verified', label: 'Verified' },
        ] },
      ] };
    case 'farms/create':
      return { title: 'Add farm', method: 'POST', path: `/farmers/${farmerId}/farms`, fields: [
        text('farm_name', 'Farm name'), { key: 'crop_type', label: 'Crop', kind: 'select', options: 'cropTypes', required: true },
        text('declared_area_hectares', 'Declared area (hectares)', { kind: 'number', required: true }),
        text('purok_sitio', 'Purok / sitio'), text('barangay', 'Barangay'), text('municipality', 'Municipality / city'), text('province', 'Province'),
        text('latitude', 'Latitude', { kind: 'number' }), text('longitude', 'Longitude', { kind: 'number' }),
        { key: 'current_stage', label: 'Development stage', kind: 'select', options: 'stages', optional: true },
        text('number_of_hills', 'Number of hills', { kind: 'number' }),
        { key: 'data_validated', label: 'Farm data validated', kind: 'select', options: [
          { value: '', label: 'Not recorded' }, { value: '1', label: 'Yes' }, { value: '0', label: 'No' },
        ] },
        { key: 'property_ownership', label: 'Property ownership', kind: 'select', options: 'ownerships', optional: true },
        text('contracted_value_estimated', 'Estimated contracted value', { kind: 'number' }),
        text('input_support_amount', 'Input support amount', { kind: 'number' }),
        text('financing_support_amount', 'Financing support amount', { kind: 'number' }),
        text('notes', 'Notes', { multiline: true }), { key: 'drone_image', label: 'Farm / drone photo', kind: 'image' },
      ] };
    case 'farms/edit':
      return { title: 'Edit farm', method: 'PUT', path: `/farms/${itemId}`, fields: [
        text('farm_name', 'Farm name'), { key: 'crop_type', label: 'Crop', kind: 'select', options: 'crops', required: true },
        text('declared_area_hectares', 'Declared area (hectares)', { kind: 'number', required: true }),
        text('purok_sitio', 'Purok / sitio'), text('barangay', 'Barangay'), text('municipality', 'Municipality / city'), text('province', 'Province'),
        text('latitude', 'Latitude', { kind: 'number' }), text('longitude', 'Longitude', { kind: 'number' }),
        { key: 'status', label: 'Farm status', kind: 'select', options: 'statuses', required: true },
        { key: 'current_stage', label: 'Development stage', kind: 'select', options: 'stages', optional: true },
        text('number_of_hills', 'Number of hills', { kind: 'number' }),
        { key: 'data_validated', label: 'Farm data validated', kind: 'select', options: [
          { value: '', label: 'Not recorded' }, { value: '1', label: 'Yes' }, { value: '0', label: 'No' },
        ] },
        { key: 'property_ownership', label: 'Property ownership', kind: 'select', options: 'ownerships', optional: true },
        text('contracted_value_estimated', 'Estimated contracted value', { kind: 'number' }),
        text('input_support_amount', 'Input support amount', { kind: 'number' }),
        text('financing_support_amount', 'Financing support amount', { kind: 'number' }),
        text('notes', 'Notes', { multiline: true }), { key: 'drone_image', label: 'Farm / drone photo', kind: 'image' },
      ] };
    case 'farm-activities/create':
      return { title: 'Record farm activity', method: 'POST', path: '/farm-activities', fields: [
        { key: 'farm_id', label: 'Farm', kind: 'select', options: 'farms', required: true },
        { key: 'activity_type_id', label: 'Activity type', kind: 'select', options: 'activityTypes', required: true },
        { key: 'crop_type', label: 'Crop', kind: 'select', options: 'crops', optional: true },
        text('activity_date', 'Activity date', { kind: 'date', required: true }),
        { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true },
        text('description', 'Description', { multiline: true }), text('performed_by', 'Performed by'),
        text('quantity', 'Quantity', { kind: 'number' }), text('unit', 'Unit'), text('cost_amount', 'Cost amount', { kind: 'number' }),
        text('remarks', 'Remarks', { multiline: true }),
      ] };
    case 'farm-activities/edit':
      return { title: 'Edit farm activity', method: 'PUT', path: `/farm-activities/${itemId}`, fields: [
        { key: 'activity_type_id', label: 'Activity type', kind: 'select', options: 'activityTypes', required: true },
        { key: 'crop_type', label: 'Crop', kind: 'select', options: 'crops', optional: true },
        text('activity_date_input', 'Activity date', { kind: 'date', required: true }),
        { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true },
        text('description', 'Description', { multiline: true }), text('performed_by', 'Performed by'),
        text('quantity', 'Quantity', { kind: 'number' }), text('unit', 'Unit'), text('cost_amount', 'Cost amount', { kind: 'number' }),
        text('remarks', 'Remarks', { multiline: true }),
      ] };
    case 'production/create':
      return { title: 'Record expected production', method: 'POST', path: '/production', fields: [
        { key: 'farm_id', label: 'Farm', kind: 'select', options: 'farms', required: true },
        { key: 'crop_type', label: 'Crop', kind: 'select', options: 'crops', optional: true },
        text('production_period', 'Production period'), text('expected_quantity', 'Expected quantity', { kind: 'number' }),
        { key: 'unit', label: 'Unit', kind: 'select', options: 'units', required: true },
        text('notes', 'Notes', { multiline: true }), { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true },
      ] };
    case 'production/edit':
      return { title: 'Edit expected production', method: 'PUT', path: `/production/${itemId}`, fields: [
        { key: 'crop_type', label: 'Crop', kind: 'select', options: 'crops', optional: true },
        text('production_period', 'Production period'), text('expected_quantity', 'Expected quantity', { kind: 'number' }),
        { key: 'unit', label: 'Unit', kind: 'select', options: 'units', required: true },
        text('notes', 'Notes', { multiline: true }), { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true },
      ] };
    case 'harvest/create':
      return { title: 'Record harvest', method: 'POST', path: '/harvest', fields: [
        { key: 'farm_id', label: 'Farm', kind: 'select', options: 'farms', required: true },
        { key: 'crop_type', label: 'Crop', kind: 'select', options: 'crops', optional: true },
        { key: 'production_id', label: 'Production estimate', kind: 'select', options: 'productions', optional: true },
        text('harvest_date', 'Harvest date', { kind: 'date', required: true }), text('quantity', 'Quantity', { kind: 'number', required: true }),
        { key: 'unit', label: 'Unit', kind: 'select', options: 'units', required: true }, text('quality_grade', 'Quality grade'),
        { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true }, text('notes', 'Notes', { multiline: true }),
      ] };
    case 'harvest/edit':
      return { title: 'Edit harvest', method: 'PUT', path: `/harvest/${itemId}`, fields: [
        text('harvest_date_input', 'Harvest date', { kind: 'date', required: true }), text('quantity', 'Quantity', { kind: 'number', required: true }),
        { key: 'unit', label: 'Unit', kind: 'select', options: 'units', required: true }, text('quality_grade', 'Quality grade'),
        { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true }, text('notes', 'Notes', { multiline: true }),
      ] };
    case 'traceability/create':
      return { title: 'Create traceability lot', method: 'POST', path: '/traceability', fields: [
        { key: 'inventory_id', label: 'Inventory lot', kind: 'select', options: 'inventories', required: true },
        text('quantity', 'Quantity', { kind: 'number', required: true }),
        { key: 'unit', label: 'Unit', kind: 'select', options: 'units', required: true }, text('notes', 'Notes', { multiline: true }),
      ] };
    case 'inventory/receive':
      return { title: 'Receive harvest into inventory', method: 'POST', path: `/harvest/${data.harvest?.id}/receive`, fields: [
        text('quantity', 'Quantity received', { kind: 'number', required: true }),
        { key: 'unit', label: 'Unit', kind: 'select', options: 'units', required: true },
        { key: 'processing_stage_id', label: 'Processing stage', kind: 'select', options: 'stages', required: true },
        text('location', 'Storage location'), text('received_date', 'Received date', { kind: 'date', required: true }), text('notes', 'Notes', { multiline: true }),
      ] };
    case 'inventory/process':
      return { title: 'Process coffee', method: 'POST', path: '/inventory/process', fields: [
        { key: 'inventory_id', label: 'Inventory lot', kind: 'select', options: 'lots', required: true },
        text('input_quantity', 'Input quantity', { kind: 'number', required: true }), text('output_quantity', 'Output quantity', { kind: 'number', required: true }),
        { key: 'destination_stage_id', label: 'Destination stage', kind: 'select', options: 'stages', required: true },
        text('processing_date', 'Processing date', { kind: 'date', required: true }), text('location', 'Storage location'), text('notes', 'Notes', { multiline: true }),
      ] };
    case 'inventory/adjust':
      return { title: 'Adjust inventory', method: 'POST', path: `/inventory/${data.inventory?.id}/adjust`, fields: [
        text('quantity', 'Quantity', { kind: 'number', required: true }),
        { key: 'direction', label: 'Adjustment', kind: 'select', options: [
          { value: 'increase', label: 'Increase' }, { value: 'decrease', label: 'Decrease' },
        ] }, text('reason', 'Reason', { multiline: true, required: true }), text('movement_date', 'Date', { kind: 'date', required: true }),
      ] };
    case 'inventory/damage':
      return { title: 'Record damaged coffee', method: 'POST', path: `/inventory/${data.inventory?.id}/damage`, fields: [
        text('quantity', 'Damaged quantity', { kind: 'number', required: true }), text('reason', 'Reason', { multiline: true, required: true }),
        text('movement_date', 'Date', { kind: 'date', required: true }),
      ] };
    case 'farm-insurance/create':
      return { title: 'Add farm insurance', method: 'POST', path: `/farms/${data.farm?.id}/insurance`, fields: [
        { key: 'covered', label: 'Farm is insured', kind: 'toggle' }, text('amount', 'Coverage amount', { kind: 'number' }),
        text('term_months', 'Coverage term (months)', { kind: 'number' }),
      ] };
    case 'farm-insurance/edit':
      return { title: 'Edit farm insurance', method: 'PUT', path: `/farms/${data.farm?.id}/insurance/${data.insurance?.id}`, fields: [
        { key: 'covered', label: 'Farm is insured', kind: 'toggle' }, text('amount', 'Coverage amount', { kind: 'number' }),
        text('term_months', 'Coverage term (months)', { kind: 'number' }),
      ] };
    case 'farm-financing/create':
      return { title: 'Add farm financing', method: 'POST', path: `/farms/${data.farm?.id}/financing`, fields: [
        { key: 'financing_type', label: 'Financing type', kind: 'select', options: 'financingTypes', required: true },
        text('amount', 'Amount', { kind: 'number', required: true }), text('date_granted', 'Date granted', { kind: 'date', required: true }),
        text('loan_balance', 'Loan balance', { kind: 'number', required: true }),
      ] };
    case 'farm-financing/edit':
      return { title: 'Edit farm financing', method: 'PUT', path: `/farms/${data.farm?.id}/financing/${data.financing?.id}`, fields: [
        { key: 'financing_type', label: 'Financing type', kind: 'select', options: 'financingTypes', required: true },
        text('amount', 'Amount', { kind: 'number', required: true }), text('date_granted', 'Date granted', { kind: 'date', required: true }),
        text('loan_balance', 'Loan balance', { kind: 'number', required: true }),
      ] };
    case 'farm-verification/decision':
      return { title: 'Save verification result', method: 'PUT', path: `/farm-verification/${data.farmId}`, fields: [
        { key: 'result', label: 'Result', kind: 'select', required: true, options: [
          { value: 'verified', label: 'Verified' }, { value: 'failed', label: 'Failed' }, { value: 'needs_review', label: 'Needs review' },
        ] }, text('remarks', 'Remarks', { multiline: true }),
      ] };
    case 'farm-boundary/edit':
      return { title: 'Save farm boundary', method: data.hasBoundary ? 'PUT' : 'POST', path: `/farms/${data.farmId}/boundary`, fields: [
        text('boundary_geojson', 'Boundary GeoJSON', { kind: 'geojson', required: true, multiline: true,
          hint: 'Paste the farm polygon as GeoJSON. The server checks the boundary before saving it.' }),
      ] };
    case 'activity-types/create':
      return { title: 'Add activity type', method: 'POST', path: '/settings/activity-types', fields: [
        text('name', 'Name', { required: true }), text('code', 'Code'), text('description', 'Description'),
        { key: 'category', label: 'Category', kind: 'select', options: 'categories', optional: true },
        { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true },
      ] };
    case 'activity-types/edit':
      return { title: 'Edit activity type', method: 'PUT', path: `/settings/activity-types/${itemId}`, fields: [
        text('name', 'Name', { required: true }), text('code', 'Code'), text('description', 'Description'),
        { key: 'category', label: 'Category', kind: 'select', options: 'categories', optional: true },
        { key: 'status', label: 'Status', kind: 'select', options: 'statuses', required: true },
      ] };
    case 'settings/profile':
      return { title: 'Edit profile', method: 'PATCH', path: '/settings/profile', fields: [
        text('name', 'Name', { required: true }), text('email', 'Email', { kind: 'email', required: true }),
      ] };
    case 'settings/security':
      return { title: 'Update password', method: 'PUT', path: '/settings/security', fields: [
        text('current_password', 'Current password', { hint: 'Required to confirm this change.' }),
        text('password', 'New password'), text('password_confirmation', 'Confirm new password'),
      ] };
    default:
      return null;
  }
}

export function optionList(source: string | Option[] | undefined, data: Data): Option[] {
  if (Array.isArray(source)) {
    return source;
  }

  if (!source) {
    return [];
  }

  const values = data[source];
  if (Array.isArray(values)) {
    return values.map((item: any) => ({
      value: String(typeof item === 'string' ? item : item.value ?? item.id ?? ''),
      label: String(typeof item === 'string' ? item : item.label ?? item.name ?? item.farm_name ?? item.farmer_name ?? item.id ?? ''),
    }));
  }

  if (source === 'stages' && Array.isArray(data.lots)) {
    const stages = new Map<string, string>();
    data.lots.forEach((lot: any) => {
      if (lot.next_stage_id != null) stages.set(String(lot.next_stage_id), String(lot.next_stage_name ?? lot.next_stage_id));
    });

    return [...stages].map(([value, label]) => ({ value, label }));
  }

  return [];
}

export function initialFieldValues(component: string, data: Data, fields: FieldSpec[]): Record<string, any> {
  const model = component === 'settings/profile' ? data.auth?.user ?? data
    : component.startsWith('farmers/') ? data.farmer
    : component.startsWith('farms/') ? data.farm
      : component.startsWith('farm-activities/') ? data.activity
        : component.startsWith('production/') ? data.production
          : component.startsWith('harvest/') ? data.harvest
            : component.startsWith('inventory/') ? data.inventory
              : component.startsWith('activity-types/') ? data.activityType
                : component.startsWith('farm-insurance/') ? data.insurance
                  : component.startsWith('farm-financing/') ? data.financing
                    : data;

  return Object.fromEntries(fields.map((field) => {
    const alternate = field.key.endsWith('_input') ? field.key.slice(0, -6) : field.key;
    const key = field.key.endsWith('_input') ? alternate : field.key;
    let value = model?.[field.key] ?? model?.[key] ?? '';

    if (field.key === 'farm_id' && data.selectedFarmId) value = data.selectedFarmId;
    if (field.key === 'production_id' && data.selectedProductionId) value = data.selectedProductionId;
    if (field.key === 'inventory_id' && (data.selected_inventory_id ?? data.selectedInventoryId)) value = data.selected_inventory_id ?? data.selectedInventoryId;
    if (field.key === 'production_period' && !value && data.currentYear) value = String(data.currentYear);
    if (field.kind === 'date' && !value && data.today) value = data.today;
    if (component === 'farms/create' && data.farmer && ['purok_sitio', 'barangay', 'municipality', 'province'].includes(field.key)) value = data.farmer[field.key] ?? '';
    if (field.key === 'boundary_geojson' && data.boundary?.geojson) value = JSON.stringify(data.boundary.geojson, null, 2);
    if (field.kind === 'toggle') value = Boolean(value);

    return [field.key, value];
  }));
}
