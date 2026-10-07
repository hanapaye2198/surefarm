# CI and deployments

## Continuous integration

`.github/workflows/tests.yml` runs on pull requests and pushes to `main`. It installs locked PHP and Node dependencies, builds the Laravel web assets, runs the repository's existing Laravel checks, typechecks the Expo app, and exports the mobile app for web.

## Hostinger deployment

After the CI jobs pass, pushes to `main` deploy the Laravel application to Hostinger when `HOSTINGER_DEPLOY_ENABLED` is set to `true`. The deployment uploads the source and compiled Laravel assets, installs production Composer dependencies with PHP 8.3, runs database migrations, and clears Laravel's generated caches.

In GitHub repository **Settings → Secrets and variables → Actions**, add these repository variables:

| Variable | Value |
| --- | --- |
| `HOSTINGER_DEPLOY_ENABLED` | `true` to enable production deployment |
| `HOSTINGER_SSH_HOST` | `145.79.28.2` |
| `HOSTINGER_SSH_PORT` | `65002` |
| `HOSTINGER_SSH_USER` | `u865638873` |
| `HOSTINGER_DEPLOY_PATH` | `/home/u865638873/domains/surefarm.io/public_html` |

Create the GitHub environment named `production`, then add these environment secrets:

| Secret | Value |
| --- | --- |
| `HOSTINGER_SSH_PRIVATE_KEY` | Private key for a deployment key authorized by the Hostinger account |
| `HOSTINGER_KNOWN_HOSTS` | Verified SSH host key line for the Hostinger host and port |

Create a dedicated key with `ssh-keygen -t ed25519 -C surefarm-github-actions -f surefarm_github_deploy`, add `surefarm_github_deploy.pub` to the Hostinger account's `~/.ssh/authorized_keys`, and store the private key file as `HOSTINGER_SSH_PRIVATE_KEY`. To obtain a candidate host-key line, run `ssh-keyscan -p 65002 145.79.28.2`; confirm its fingerprint through a trusted channel before saving it as `HOSTINGER_KNOWN_HOSTS`. Keep the private key out of the repository. The deploy step intentionally preserves the server's `.env`, `storage`, and `public/storage`; it does not delete files from `public_html`.

The production environment can be restricted to `main` and configured with required reviewers under **Settings → Environments**. Add a repository variable `HOSTINGER_DEPLOY_ENABLED=false` to pause automatic deployments while keeping CI active.

## Native Android and iOS releases

`.github/workflows/mobile-release.yml` runs for a `mobile-v*` tag or from **Actions → Mobile release build → Run workflow**. Add the Expo access token as the repository secret `EXPO_TOKEN`. The workflow links or creates the EAS project with that account, validates the mobile app, and starts an EAS production build. It does not submit builds to the app stores.

For example, create a release tag after committing the intended mobile version:

```sh
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```
