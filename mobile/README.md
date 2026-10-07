# SureFarm mobile app

Native Android and iOS client built with Expo and React Native. Laravel remains the web server, source of truth, and authorization layer. The app signs in to the Laravel mobile API with Sanctum bearer tokens and stores the token in the platform secure store.

## Included

- Email and password sign-in, verified-email restriction, two-factor codes, and recovery codes.
- Role-aware dashboard and workspaces for administration, operations, and field verification.
- Farmer and farm records, farm activities, production, harvest, inventory, coffee processing, traceability, insurance, financing, and activity-type settings.
- Laravel form validation, existing server-side actions, search, details, and pagination.
- Farmer/farm photo upload, phone GPS coordinates, and walked farm-boundary capture.

The app keeps the four Laravel roles: `admin`, `operations`, `field_verifier`, and `farmer`. Access is enforced again by Laravel on every protected API route.

## Run the app

Install Node.js, then from this directory:

```sh
npm install
npx expo start
```

The default API URL is `https://surefarm.io`. To use staging, set `EXPO_PUBLIC_SUREFARM_URL` to the Laravel origin before starting Expo. For example, in PowerShell:

```powershell
$env:EXPO_PUBLIC_SUREFARM_URL = 'https://staging.example.com'
npx expo start
```

Open the QR code with Expo Go for development, or use an EAS build for an installable app.

## Deploy the Laravel API changes

Deploy the Laravel project changes in the repository root before signing in from the app. In the Laravel project directory on Hostinger, install the locked production dependencies and run the new Sanctum token migration:

```sh
chmod -R u+rwX app bootstrap config database routes
/opt/alt/php83/usr/bin/php /usr/local/bin/composer2 install --no-dev --optimize-autoloader --no-interaction
/opt/alt/php83/usr/bin/php artisan migrate --force
/opt/alt/php83/usr/bin/php artisan optimize:clear
```

Keep the existing production `.env` and `APP_KEY`. The mobile API is under `/api/mobile`; it uses the existing Laravel controllers, request validation, roles, and database. HTTPS must be enabled for the domain.

## Build installable apps

Sign in to Expo and link the project once:

```sh
npx eas-cli login
npx eas-cli init
```

Build an internal Android APK:

```sh
npx eas-cli build --platform android --profile preview
```

Build store packages:

```sh
npx eas-cli build --platform all --profile production
```

The iOS build runs in EAS from Windows. Publishing to Google Play or the App Store requires the corresponding developer account and store listing.
