export const farmerPhotoMaxBytes = 5 * 1024 * 1024;

export type FarmerFormValues = {
    first_name: string;
    last_name: string;
    purok_sitio: string;
    barangay: string;
    municipality: string;
    province: string;
    mobile_number: string;
    email: string;
    has_spouse: boolean;
    spouse_first_name: string;
    spouse_last_name: string;
    date_of_birth: string;
    government_id: string;
    has_bank_account: boolean;
    bank_name: string;
    account_number: string;
    account_name: string;
};

const requiredFields: Array<[keyof FarmerFormValues, string]> = [
    ['first_name', 'First name is required.'],
    ['last_name', 'Last name is required.'],
    ['purok_sitio', 'Purok / sitio is required.'],
    ['barangay', 'Barangay is required.'],
    ['municipality', 'Municipality / city is required.'],
    ['province', 'Province is required.'],
    ['mobile_number', 'Mobile number is required.'],
];

export function validateFarmerForm(
    values: FarmerFormValues,
    photo: File | null,
): Record<string, string> {
    const errors: Record<string, string> = {};

    requiredFields.forEach(([field, message]) => {
        const value = values[field];

        if (typeof value === 'string' && value.trim() === '') {
            errors[field] = message;
        }
    });

    if (
        values.mobile_number.trim() !== '' &&
        !/^[0-9+\-\s()]+$/.test(values.mobile_number.trim())
    ) {
        errors.mobile_number = 'Enter a valid mobile number.';
    }

    if (
        values.email.trim() !== '' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
    ) {
        errors.email = 'Enter a valid email address.';
    }

    if (photo) {
        const allowed = ['image/jpeg', 'image/png'];

        if (!allowed.includes(photo.type)) {
            errors.photo = 'Farmer photo must be a JPG or PNG image.';
        } else if (photo.size > farmerPhotoMaxBytes) {
            errors.photo = 'Farmer photo must be 5 MB or smaller.';
        }
    }

    if (values.has_spouse) {
        if (values.spouse_first_name.trim() === '') {
            errors.spouse_first_name = 'Spouse first name is required.';
        }

        if (values.spouse_last_name.trim() === '') {
            errors.spouse_last_name = 'Spouse last name is required.';
        }
    }

    return {
        ...errors,
        ...validateFarmerDetails(values),
    };
}

export type FarmerDetailValues = {
    date_of_birth: string;
    government_id: string;
    has_bank_account: boolean;
    bank_name: string;
    account_number: string;
    account_name: string;
};

export function validateFarmerDetails(
    values: FarmerDetailValues,
): Record<string, string> {
    const errors: Record<string, string> = {};

    if (values.date_of_birth.trim() !== '') {
        const birthDate = new Date(`${values.date_of_birth}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (Number.isNaN(birthDate.getTime()) || birthDate >= today) {
            errors.date_of_birth = 'Date of birth must be in the past.';
        } else if (birthDate.getFullYear() < 1900) {
            errors.date_of_birth = 'Enter a valid date of birth.';
        }
    }

    if (values.government_id.trim().length > 64) {
        errors.government_id = 'Government ID must be 64 characters or fewer.';
    }

    if (!values.has_bank_account) {
        return errors;
    }

    if (values.bank_name.trim() === '') {
        errors.bank_name = 'Bank name is required.';
    }

    if (values.account_number.trim() === '') {
        errors.account_number = 'Account number is required.';
    } else if (!/^[0-9\-\s]+$/.test(values.account_number.trim())) {
        errors.account_number =
            'Account number can only contain digits, spaces, and dashes.';
    }

    if (values.account_name.trim() === '') {
        errors.account_name = 'Account name is required.';
    }

    return errors;
}
