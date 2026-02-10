#!/usr/bin/env bash
#
# POST a Pub/Sub-style message to the local task-converter service.
# Use when the service is running (e.g. npm run start).
#
# The body matches what withPubSubHandler expects: message.attributes and
# message.data (base64-encoded JSON). Payload shape: taskId, target, conversionType,
# optional filename, workVersion. Add signedUrl to the file entry for real conversion.
#
# Usage:
#   ./scripts/post-message.sh
#   PORT=3000 ./scripts/post-message.sh
#
set -euo pipefail

PORT="${PORT:-8080}"
BASE_URL="http://localhost:${PORT}"

# Payload: workVersion (WorkVersion shape) with metadata from real storage.
# For end-to-end conversion, add "signedUrl" to the file entry with a download URL.
PAYLOAD_JSON=$(cat <<'PAYLOAD_EOF'
{
  "taskId": "test-converter-1",
  "target": "pdf",
  "conversionType_1": "docx-pandoc-myst-pdf",
  "conversionType": "docx-lowriter-pdf",
  "filename": "paper.pdf",
  "workVersion": {
    "id": "019c425e-399f-7d65-93f5-691196ed551b",
    "work_id": "019c425e-399f-7d64-0000-000000000001",
    "date_created": "2026-02-09T12:00:00.000Z",
    "date_modified": "2026-02-09T12:27:40.648Z",
    "draft": true,
    "cdn": null,
    "cdn_key": null,
    "title": "Test document",
    "description": null,
    "authors": ["Test Author"],
    "author_details": [],
    "date": null,
    "doi": null,
    "canonical": null,
    "metadata": {
      "version": 1,
      "files": {
        "019c425e-399f-7d65-93f5-691196ed551b/manuscript/paper.docx": {
          "md5": "508afb329e745ff3a95d224ee6dbc92e",
          "name": "paper.docx",
          "path": "019c425e-399f-7d65-93f5-691196ed551b/manuscript/paper.docx",
          "size": 1692568,
          "slot": "manuscript",
          "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "label": "paper",
          "order": 1,
          "uploadDate": "2026-02-09T12:27:40.648Z",
          "signedUrl": "https://storage.googleapis.com/cdn-curvenote-dev-1/static/very-simple.docx"
        }
      },
      "checks": {
        "enabled": ["proofig"],
        "proofig": {}
      }
    },
    "occ": 0
  }
}
PAYLOAD_EOF
)
# Single-line base64 for embedding in outer JSON
DATA_B64="$(echo -n "$PAYLOAD_JSON" | base64 | tr -d '\n')"

# Required attributes (placeholder values for local testing; conversionType is in payload)
BODY=$(cat <<EOF
{
  "message": {
    "attributes": {
      "userId": "test-user",
      "successState": "success",
      "failureState": "failure",
      "statusUrl": "http://localhost:${PORT}/status",
      "jobUrl": "http://localhost:${PORT}/job/1111-2222-3333-4444-555555555555",
      "handshake": "local-test"
    },
    "data": "${DATA_B64}"
  }
}
EOF
)

echo "POST ${BASE_URL}/"
echo "Payload (decoded): ${PAYLOAD_JSON}"
echo ""

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${BASE_URL}/" \
  -w "\n\nHTTP status: %{http_code}\n"
