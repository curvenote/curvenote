-- Add a GIN index for JSONB search on metadata for inbox search
CREATE INDEX idx_submissionversion_metadata_gin ON "SubmissionVersion" USING gin ("metadata"); 