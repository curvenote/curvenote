/**
 * Server-only Anthropic API client for the upload flow.
 * Instantiate with request ctx (ctx.$config) and reuse for multiple calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Context } from '@curvenote/scms-server';
import { z } from 'zod';
import type { FetchPreviewsResult } from './fetchPreviews.server';
import { astContentToPlainText } from './fetchPreviews.server';

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

const AuthorSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  orcid: z.string().optional(),
  corresponding: z.boolean().optional(),
  email: z.string().optional(),
  affiliations: z.array(z.string()).optional(),
  equal_contributor: z.boolean().optional(),
  deceased: z.boolean().optional(),
  note: z.string().optional(),
});

const AffiliationSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  institution: z.string().optional(),
  department: z.string().optional(),
  ror: z.string().optional(),
  doi: z.string().optional(),
  isni: z.string().optional(),
});

/**
 * MyST Markdown frontmatter subset we extract from the first page of a document.
 * Used both as the source of truth for the structured-output schema and to derive
 * the {@link ExtractedMetadata} type.
 */
export const ExtractedMetadataSchema = z.object({
  title: z.string().optional(),
  authors: z.array(AuthorSchema).optional(),
  affiliations: z.array(AffiliationSchema).optional(),
  doi: z.string().optional(),
});

export type ExtractedMetadata = z.infer<typeof ExtractedMetadataSchema>;

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

export const DEFAULT_METADATA_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Wrapper around the Anthropic SDK for upload-related calls (server-only).
 * Construct with request ctx; uses ctx.$config.api.anthropic.apiKey.
 * Returns null from create() when the key is not configured.
 */
export class AnthropicUploadClient {
  private readonly client: Anthropic;
  private model: string;

  constructor(ctx: Context) {
    const key = ctx.$config.api?.anthropic?.apiKey;
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new Error('AnthropicUploadClient requires api.anthropic.apiKey to be set in config');
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = DEFAULT_METADATA_MODEL;
  }

  /** Set the model for subsequent calls. */
  setModel(model: string): void {
    this.model = model;
  }

  /** Get the current model. */
  getModel(): string {
    return this.model;
  }

  /**
   * Send a custom message with optional system prompt.
   * Use this for other upload-related prompts in the future.
   */
  async sendMessage(params: {
    system?: string;
    messages: Anthropic.MessageParam[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<Anthropic.Message> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 20000,
      temperature: params.temperature ?? 1,
      system: params.system,
      messages: params.messages,
    });
    return response;
  }

  /**
   * Extract title/author/affiliation metadata from document text (e.g. first page).
   * Replaces {{DOCUMENT}} in the prompt with the provided document string.
   * Returns the raw API message; parse content for <json>...</json> to get structured metadata.
   */
  async fastFindMetadata(document: string): Promise<Anthropic.Message> {
    const userContent = FAST_FIND_METADATA_USER_TEMPLATE.replace('{{DOCUMENT}}', document);
    return this.sendMessage({
      system: FAST_FIND_METADATA_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userContent }],
        },
      ],
    });
  }

  /**
   * Schema-based counterpart to {@link fastFindMetadata}. Uses Anthropic Structured
   * Outputs so the model returns metadata already validated against
   * {@link ExtractedMetadataSchema}. Returns the parsed metadata, or null when the
   * model produced no parseable output (e.g. refusal / incomplete response).
   */
  async fastFindMetadataStructured(document: string): Promise<ExtractedMetadata | null> {
    const userContent = FAST_FIND_METADATA_USER_TEMPLATE_STRUCTURED.replace(
      '{{DOCUMENT}}',
      document,
    );
    const message = await this.client.messages.parse({
      model: this.model,
      max_tokens: 20000,
      temperature: 1,
      system: FAST_FIND_METADATA_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userContent }],
        },
      ],
      output_config: {
        format: zodOutputFormat(ExtractedMetadataSchema),
      },
    });
    return message.parsed_output ?? null;
  }
}

/**
 * Create an AnthropicUploadClient when api.anthropic.apiKey is set.
 * Returns null when the key is not configured so the upload flow can skip or fallback.
 */
export function createAnthropicUploadClient(ctx: Context): AnthropicUploadClient | null {
  const key = ctx.$config.api?.anthropic?.apiKey;
  if (!key || typeof key !== 'string' || key.trim() === '') return null;
  return new AnthropicUploadClient(ctx);
}

/**
 * Helper to get the first text block from a message's content.
 */
export function getMessageText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return block?.text ?? '';
}

/**
 * Extract JSON from a message that contains <json>...</json> in its text.
 */
export function extractJsonFromMessage(message: Anthropic.Message): string | null {
  const text = getMessageText(message);
  const match = text.match(/<json>([\s\S]*?)<\/json>/);
  return match ? match[1].trim() : null;
}

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
  client: AnthropicUploadClient,
  documentText: string,
): Promise<ExtractedMetadata | null> {
  let result: ExtractedMetadata | null;
  try {
    result = await client.fastFindMetadataStructured(documentText);
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
  client: AnthropicUploadClient,
  documentText: string,
): Promise<ExtractedMetadata | null> {
  let message: Anthropic.Message;
  try {
    message = await client.fastFindMetadata(documentText);
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

    const client = createAnthropicUploadClient(ctx);
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
