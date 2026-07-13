# Curvenote CLI container images

General-purpose images for running the [Curvenote CLI](https://www.npmjs.com/package/curvenote).

Image: `ghcr.io/curvenote/cli`

## Usage

```bash
docker run --rm -v "$PWD":/work -w /work ghcr.io/curvenote/cli:latest --help
docker run --rm -v "$PWD":/work -w /work ghcr.io/curvenote/cli:latest submit my-venue
```

Use the slim image when you do not need PDF/image tooling:

```bash
docker run --rm -v "$PWD":/work -w /work ghcr.io/curvenote/cli:latest-slim --help
```

## Variants

| Target | Tag suffix | Contents |
|--------|------------|----------|
| `full` (default tags) | none (e.g. `latest`, `0.16.5`) | Curvenote CLI, Typst, Noto fonts, Inkscape, ImageMagick, WebP, Ghostscript |
| `slim` | `-slim` (e.g. `latest-slim`) | Curvenote CLI only |

Typst is whatever version was latest when the image was built. The Curvenote CLI version matches the image tag (and the npm release).

## Tags

Published when the `curvenote` npm package is released:

| Tag | Meaning |
|-----|---------|
| `0.16.5` / `0.16.5-slim` | Exact CLI version |
| `0.16` / `0.16-slim` | Latest patch for that minor |
| `0` / `0-slim` | Latest minor/patch for that major |
| `latest` / `latest-slim` | Latest CLI release |

## Publishing

Images are built by `.github/workflows/release.yml` after a successful changesets publish of the `curvenote` package. The workflow waits for the version to appear on npm, then builds and pushes both variants.

For a one-off rebuild without a new CLI release, run **Actions → Publish CLI Image → Run workflow** (optional version input; defaults to npm `latest`).

After the first publish, make the GHCR package public:

**GitHub → Packages → curvenote/cli → Package settings → Change visibility → Public**
