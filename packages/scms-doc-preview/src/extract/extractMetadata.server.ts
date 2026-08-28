import {
  createAnthropicClient,
  DEFAULT_ANTHROPIC_MODEL,
  extractJsonFromMessage,
  getMessageText,
  type AnthropicClient,
  type Context,
} from '@curvenote/scms-server';
import { ExtractedMetadataSchema, type ExtractedMetadata } from '@curvenote/scms-core';
import type { FetchPreviewsResult } from '../preview/fetchPreviews.server.js';
import { astContentToPlainText } from '../preview/fetchPreviews.server.js';

export { ExtractedMetadataSchema, type ExtractedMetadata };

/**
 * Selects how {@link extractMetadataFromPreviews} talks to Anthropic:
 * - `schema`: native Structured Outputs (validated against {@link ExtractedMetadataSchema} in one call)
 * - `prompt`: legacy prompt that asks for JSON inside <json> tags, parsed/validated by us
 */
export type MetadataExtractStrategy = 'schema' | 'prompt';

/**
 * Single switch point for the extraction strategy. Defaults to the schema-based
 * approach; override with the `METADATA_EXTRACT_STRATEGY` env var. This is the
 * easy-to-flip code switch; promote to a real config option later if needed.
 */
export const METADATA_EXTRACT_STRATEGY: MetadataExtractStrategy =
  process.env.METADATA_EXTRACT_STRATEGY === 'prompt' ? 'prompt' : 'schema';

const FAST_FIND_METADATA_SYSTEM =
  'keep responses to the user as concise and short as possible, speed in response is important';

const FAST_FIND_METADATA_USER_TEMPLATE = `You will be extracting title and author information from the first page of a scientific paper or similar academic document. Your goal is to identify and structure this metadata according to the MyST Markdown frontmatter schema.

Here is the document to extract information from:

<document>
{{DOCUMENT}}
</document>

Your task is to carefully read through the document and extract the following information:

1. **Title**: The main title of the paper (required)
2. **Authors**: List of authors with their details including:
   - Name (required for each author)
   - Affiliations (department, institution, etc.)
   - Email addresses
   - ORCID identifiers if present
   - Corresponding author designation
   - Equal contributor designations
   - Any notes about authors (e.g., "Present address:", "Deceased")
3. **Affiliations**: Separate list of institutional affiliations with:
   - Institution/organization name
   - Department (if specified)
   - Any identifiers (ROR, ISNI, DOI, etc.)

**Important guidelines:**

- Focus on the first page or front matter of the document where metadata typically appears
- Author names should be extracted as full names (e.g., "John Smith" not "J. Smith" unless that's all that's provided)
- Affiliations are often indicated by superscript numbers or symbols next to author names - match these carefully
- Corresponding authors are often marked with asterisks (*) or explicitly labeled
- Email addresses typically indicate corresponding authors
- Equal contributors may be marked with symbols like † or ‡, or stated explicitly
- If information is not present in the document, omit that field rather than guessing
- Be careful to distinguish between the paper title and any running headers or journal names

**Common patterns in scientific papers:**
- Title is usually the largest text at the top
- Authors appear below the title, often with superscript affiliation markers
- Affiliations appear below authors, numbered or symbolized to match
- Corresponding author info often appears in a footnote or with an asterisk

Before providing your final JSON output, use the scratchpad to think through what you've found.

<scratchpad>
In your scratchpad:
1. Identify where the title appears
2. List all authors you can find and note any markers (numbers, symbols) next to their names
3. List all affiliations and their corresponding markers
4. Match authors to affiliations based on the markers
5. Identify any special designations (corresponding, equal contributor, etc.)
</scratchpad>

After your analysis, output the extracted metadata as valid JSON conforming to this schema:

**MyST Markdown Frontmatter Schema:**
- \`title\` (string, max 500 chars): Primary title
- \`authors\` (array of objects): Each author object can contain:
  - \`name\` (string, required): Full name
  - \`id\` (string): Local identifier
  - \`orcid\` (string): ORCID identifier
  - \`corresponding\` (boolean): True if corresponding author
  - \`email\` (string): Email address
  - \`affiliations\` (array): List of affiliation IDs or objects
  - \`equal_contributor\` (boolean): True if equal contributor
  - \`deceased\` (boolean): True if deceased
  - \`note\` (string): Additional information
- \`affiliations\` (array of objects): Each affiliation can contain:
  - \`id\` (string): Local identifier (e.g., "aff1", "aff2")
  - \`name\` (string, required): Name of institution
  - \`institution\` (string): Institution name
  - \`department\` (string): Department name
  - \`ror\` (string): ROR identifier
  - \`doi\` (string): DOI of affiliation
  - \`isni\` (string): ISNI identifier
- \`doi\` (string): DOI of the paper

**Output your final answer as valid JSON only inside <json> tags. Do not include any explanatory text outside the tags - only the JSON object itself.**`;

/**
 * Structured-output variant of the metadata prompt. The response shape is enforced
 * by {@link ExtractedMetadataSchema} via Anthropic Structured Outputs, so this prompt
 * omits the scratchpad / <json> tag / "JSON only" instructions and just supplies guidance.
 */
const FAST_FIND_METADATA_USER_TEMPLATE_STRUCTURED = `You will be extracting title and author information from the first page of a scientific paper or similar academic document. Your goal is to identify and structure this metadata according to the MyST Markdown frontmatter schema.

Here is the document to extract information from:

<document>
{{DOCUMENT}}
</document>

Your task is to carefully read through the document and extract the following information:

1. **Title**: The main title of the paper
2. **Authors**: List of authors with their details including:
   - Name (full name)
   - Affiliations (referenced by affiliation id, e.g. "aff1")
   - Email addresses
   - ORCID identifiers if present
   - Corresponding author designation
   - Equal contributor designations
   - Any notes about authors (e.g., "Present address:", "Deceased")
3. **Affiliations**: Separate list of institutional affiliations with an id (e.g. "aff1"), name, department, and any identifiers (ROR, ISNI, DOI, etc.)

**Important guidelines:**

- Focus on the first page or front matter of the document where metadata typically appears
- Author names should be extracted as full names (e.g., "John Smith" not "J. Smith" unless that's all that's provided)
- Affiliations are often indicated by superscript numbers or symbols next to author names - assign each affiliation an id and reference those ids from each author's affiliations list
- Corresponding authors are often marked with asterisks (*) or explicitly labeled; email addresses typically indicate corresponding authors
- Equal contributors may be marked with symbols like † or ‡, or stated explicitly
- If information is not present in the document, omit that field rather than guessing
- Be careful to distinguish between the paper title and any running headers or journal names`;

/** Re-export for callers that previously imported the upload-local default model. */
export { DEFAULT_ANTHROPIC_MODEL };

const LOG_PREFIX = '[extractMetadataFromPreviews]';

/**
 * Log an Anthropic API error in a consistent shape. Used by both strategies.
 */
function logAnthropicApiError(apiErr: unknown): void {
  const err = apiErr as Error & { status?: number; error?: unknown };
  console.error(
    LOG_PREFIX,
    'Anthropic API call failed:',
    err.message,
    err.status != null ? { status: err.status } : '',
    err.error ?? '',
  );
  if (err.stack) console.error(LOG_PREFIX, err.stack);
}

/**
 * Schema-based extraction: Anthropic Structured Outputs validates the response
 * against {@link ExtractedMetadataSchema}, so no manual JSON parsing is required.
 * Returns null on API failure or when the model produced no parseable output.
 */
async function extractViaSchema(
  client: AnthropicClient,
  documentText: string,
): Promise<ExtractedMetadata | null> {
  const userContent = FAST_FIND_METADATA_USER_TEMPLATE_STRUCTURED.replace(
    '{{DOCUMENT}}',
    documentText,
  );
  let result: ExtractedMetadata | null;
  try {
    result = await client.parseWithZod({
      system: FAST_FIND_METADATA_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userContent }],
        },
      ],
      schema: ExtractedMetadataSchema,
    });
  } catch (apiErr) {
    logAnthropicApiError(apiErr);
    return null;
  }
  if (result == null) {
    console.warn(LOG_PREFIX, 'Structured output returned no parsed result (refusal/incomplete)');
    return null;
  }
  return result;
}

/**
 * Legacy prompt-based extraction: asks the model for JSON inside <json> tags,
 * then extracts and parses it ourselves. Returns null on API failure, a missing
 * <json>...</json> block, or a JSON parse error.
 */
async function extractViaPrompt(
  client: AnthropicClient,
  documentText: string,
): Promise<ExtractedMetadata | null> {
  const userContent = FAST_FIND_METADATA_USER_TEMPLATE.replace('{{DOCUMENT}}', documentText);
  let message: Awaited<ReturnType<AnthropicClient['sendMessage']>>;
  try {
    message = await client.sendMessage({
      system: FAST_FIND_METADATA_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userContent }],
        },
      ],
    });
  } catch (apiErr) {
    logAnthropicApiError(apiErr);
    return null;
  }

  console.log(LOG_PREFIX, 'Anthropic full response:', JSON.stringify(message, null, 2));

  const rawText = getMessageText(message);
  const jsonStr = extractJsonFromMessage(message);
  if (!jsonStr) {
    console.warn(
      LOG_PREFIX,
      'No <json>...</json> in response. First 500 chars:',
      rawText.slice(0, 500),
    );
    return null;
  }

  try {
    return JSON.parse(jsonStr) as ExtractedMetadata;
  } catch (parseErr) {
    const err = parseErr as Error;
    console.error(LOG_PREFIX, 'JSON parse failed:', err.message);
    console.warn(
      LOG_PREFIX,
      'Raw JSON string length:',
      jsonStr.length,
      'preview:',
      jsonStr.slice(0, 300),
    );
    return null;
  }
}

/**
 * Extract title/author metadata from the first document preview via Anthropic.
 * Uses the selected preview's AST content as plain text (no attachments). The
 * extraction strategy is chosen by {@link METADATA_EXTRACT_STRATEGY}. On any
 * failure returns null. Never throws; logs details on failure.
 */
export async function extractMetadataFromPreviews(
  previewsResult: FetchPreviewsResult,
  ctx: Context,
  /** Optional path of the preview to extract from; falls back to the first preview. */
  targetPath?: string,
): Promise<ExtractedMetadata | null> {
  try {
    if (!previewsResult.previews?.length) {
      console.warn(LOG_PREFIX, 'No document previews available');
      return null;
    }
    const selected =
      (targetPath && previewsResult.previews.find((p) => p.path === targetPath)) ||
      previewsResult.previews[0];
    const documentText = astContentToPlainText(selected.ast.content ?? []);
    if (!documentText.trim()) {
      console.warn(LOG_PREFIX, 'Selected preview has no extractable text');
      return null;
    }

    const client = createAnthropicClient(ctx, DEFAULT_ANTHROPIC_MODEL);
    if (!client) {
      console.warn(LOG_PREFIX, 'Anthropic client not configured (missing api.anthropic.apiKey)');
      return null;
    }

    console.log(LOG_PREFIX, `Using '${METADATA_EXTRACT_STRATEGY}' extraction strategy`);
    return METADATA_EXTRACT_STRATEGY === 'schema'
      ? await extractViaSchema(client, documentText)
      : await extractViaPrompt(client, documentText);
  } catch (err) {
    const e = err as Error;
    console.error(LOG_PREFIX, 'Unexpected error:', e.message, e.stack);
    return null;
  }
}
