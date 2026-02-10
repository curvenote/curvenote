#!/bin/sh

# run.sh - Run the local task-converter Docker image (after ./local.sh or npm run build:local)

docker run \
  -p 8080:8080 \
  --name task-converter-local \
  --rm \
  task-converter-local
