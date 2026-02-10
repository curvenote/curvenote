#!/bin/bash

# build.sh - Build task-converter Docker image remotely (GCP Cloud Build)
# Requires build:service to have run first so dist/ and typst-plain/ are in place.

set -e

if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    echo "Copy .env.sample to .env and set GCP_PROJECT (and optionally GCP_REGION)."
    exit 1
fi

source .env

if [ -z "$GCP_PROJECT" ]; then
    echo "Error: GCP_PROJECT must be set in .env"
    exit 1
fi

echo "Building task-converter image on GCP..."
echo "Project: $GCP_PROJECT"
echo "Region: ${GCP_REGION:-us-central1}"

gcloud builds submit \
  --project "$GCP_PROJECT" \
  --tag "gcr.io/$GCP_PROJECT/task-converter:$(git rev-parse --short HEAD)" \
  --timeout 30m \
  .
