#!/usr/bin/env bash
#
# POST a Pub/Sub-style message to the local task-converter service.
# Use when the service is running (e.g. npm run start).
#
# The body matches what withPubSubHandler expects: message.attributes and
# message.data (base64-encoded JSON). Payload shape: taskId, target, workVersion
# (WorkVersion model fields + metadata with files). Exactly one Word-doc-style
# file entry is included for conversion; add signedUrl for a real download URL.
#
# Usage:
#   ./scripts/post-message.sh
#   PORT=3000 ./scripts/post-message.sh
#
set -euo pipefail

PORT="${PORT:-8080}"
BASE_URL="http://localhost:${PORT}"

# Payload: workVersion (WorkVersion shape) with metadata.files containing one Word doc entry
PAYLOAD_JSON=$(cat <<'PAYLOAD_EOF'
{
  "taskId": "test-converter-1",
  "target": "pdf",
  "workVersion": {
    "id": "0197e5a6-a693-7c86-8514-e219855d724c",
    "work_id": "0197e5a6-a693-7c86-8514-e219855d724b",
    "date_created": "2025-07-07T16:00:00.000Z",
    "date_modified": "2025-07-07T16:00:00.000Z",
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
        "0197e5a6-a693-7c86-8514-e219855d724c/pmc/manuscript/Paper.docx": {
          "md5": "874578c75f467a5de1ec3c4094be23cc",
          "name": "Paper.docx",
          "path": "0197e5a6-a693-7c86-8514-e219855d724c/pmc/manuscript/Paper.docx",
          "size": 12078,
          "slot": "pmc/manuscript",
          "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "label": "Paper",
          "uploadDate": "2025-07-07T16:10:41.212Z"
        }
      }
    },
    "occ": 0
  }
}
PAYLOAD_EOF
)
# Single-line base64 for embedding in outer JSON
DATA_B64="$(echo -n "$PAYLOAD_JSON" | base64 | tr -d '\n')"

# Required attributes (placeholder values for local testing)
BODY=$(cat <<EOF
{
  "message": {
    "attributes": {
      "userId": "test-user",
      "successState": "success",
      "failureState": "failure",
      "statusUrl": "http://localhost:${PORT}/status",
      "jobUrl": "http://localhost:${PORT}/job/1111-2222-3333-4444-555555555555",
      "handshake": "local-test",
      "conversionType": "pandoc-myst"
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
