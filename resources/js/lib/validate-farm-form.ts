export type FarmFormInput = {
    crop_type: string;
    declared_area_hectares: string;
    latitude: string;
    longitude: string;
    number_of_hills?: string;
    contracted_value_estimated?: string;
    input_support_amount?: string;
    financing_support_amount?: string;
};

const areaPattern = /^\d+(\.\d{1,2})?$/;

export function validateFarmForm(
    input: FarmFormInput,
): Record<string, string> {
    const errors: Record<string, string> = {};
    const area = input.declared_area_hectares.trim();

    if (input.crop_type.trim() === '') {
        errors.crop_type = 'Crop type is required.';
    }

    if (area === '') {
        errors.declared_area_hectares = 'Declared farm area is required.';
    } else if (!areaPattern.test(area) || Number.isNaN(Number(area))) {
        errors.declared_area_hectares = area.includes('.')
            ? 'Declared farm area can have at most 2 decimal places.'
            : 'Declared farm area must be a number.';
    } else if (Number(area) <= 0) {
        errors.declared_area_hectares =
            'Declared farm area must be greater than 0.';
    } else if (Number(area) > 99999999.99) {
        errors.declared_area_hectares = 'Declared farm area is too large.';
    }

    const latitude = input.latitude.trim();

    if (latitude !== '') {
        const value = Number(latitude);

        if (Number.isNaN(value) || value < -90 || value > 90) {
            errors.latitude = 'Latitude must be between -90 and 90.';
        }
    }

    const longitude = input.longitude.trim();

    if (longitude !== '') {
        const value = Number(longitude);

        if (Number.isNaN(value) || value < -180 || value > 180) {
            errors.longitude = 'Longitude must be between -180 and 180.';
        }
    }

    optionalWholeNumber(
        input.number_of_hills ?? '',
        'number_of_hills',
        'Number of hills must be a whole number.',
        errors,
    );
    optionalMoney(
        input.contracted_value_estimated ?? '',
        'contracted_value_estimated',
        'Contracted value can have at most 2 decimal places.',
        errors,
    );
    optionalMoney(
        input.input_support_amount ?? '',
        'input_support_amount',
        'Input support can have at most 2 decimal places.',
        errors,
    );
    optionalMoney(
        input.financing_support_amount ?? '',
        'financing_support_amount',
        'Financing support can have at most 2 decimal places.',
        errors,
    );

    return errors;
}

function optionalWholeNumber(
    value: string,
    key: string,
    message: string,
    errors: Record<string, string>,
): void {
    const trimmed = value.trim();

    if (trimmed !== '' && !/^\d+$/.test(trimmed)) {
        errors[key] = message;
    }
}

function optionalMoney(
    value: string,
    key: string,
    message: string,
    errors: Record<string, string>,
): void {
    const trimmed = value.trim();

    if (trimmed !== '' && !areaPattern.test(trimmed)) {
        errors[key] = message;
    }
}
