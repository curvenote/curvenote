/**
 * Server-only Anthropic API client for the upload flow.
 * Instantiate with request ctx (ctx.$config) and reuse for multiple calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Context } from '@curvenote/scms-server';
import type { FetchPreviewsResult } from './fetchPreviews.server';
import { astContentToPlainText } from './fetchPreviews.server';

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
      throw new Error(
        'AnthropicUploadClient requires api.anthropic.apiKey to be set in config',
      );
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
    const userContent = FAST_FIND_METADATA_USER_TEMPLATE.replace(
      '{{DOCUMENT}}',
      document,
    );
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
}

/**
 * Create an AnthropicUploadClient when api.anthropic.apiKey is set.
 * Returns null when the key is not configured so the upload flow can skip or fallback.
 */
export function createAnthropicUploadClient(
  ctx: Context,
): AnthropicUploadClient | null {
  const key = ctx.$config.api?.anthropic?.apiKey;
  if (!key || typeof key !== 'string' || key.trim() === '') return null;
  return new AnthropicUploadClient(ctx);
}

/**
 * Helper to get the first text block from a message's content.
 */
export function getMessageText(message: Anthropic.Message): string {
  const block = message.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  return block?.text ?? '';
}

/**
 * Extract JSON from a message that contains <json>...</json> in its text.
 */
export function extractJsonFromMessage(
  message: Anthropic.Message,
): string | null {
  const text = getMessageText(message);
  const match = text.match(/<json>([\s\S]*?)<\/json>/);
  return match ? match[1].trim() : null;
}

export interface ExtractedMetadata {
  title?: string;
  authors?: Array<{ name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

const LOG_PREFIX = '[extractMetadataFromPreviews]';

/**
 * Extract title/author metadata from the first DOCX preview via Anthropic.
 * Uses first preview's AST content as plain text (no attachments). On API failure,
 * missing <json>...</json>, or parse error returns null. Never throws; logs details on failure.
 */
export async function extractMetadataFromPreviews(
  previewsResult: FetchPreviewsResult,
  ctx: Context,
): Promise<ExtractedMetadata | null> {
  try {
    if (!previewsResult.previews?.length) {
      console.warn(LOG_PREFIX, 'No DOCX previews available');
      return null;
    }
    const first = previewsResult.previews[0];
    const documentText = astContentToPlainText(first.ast.content ?? []);
    if (!documentText.trim()) {
      console.warn(LOG_PREFIX, 'First preview has no extractable text');
      return null;
    }

    const client = createAnthropicUploadClient(ctx);
    if (!client) {
      console.warn(LOG_PREFIX, 'Anthropic client not configured (missing api.anthropic.apiKey)');
      return null;
    }

    let message: Anthropic.Message;
    try {
      message = await client.fastFindMetadata(documentText);
    } catch (apiErr) {
      const err = apiErr as Error & { status?: number; error?: unknown };
      console.error(
        LOG_PREFIX,
        'Anthropic API call failed:',
        err.message,
        err.status != null ? { status: err.status } : '',
        err.error ?? '',
      );
      if (err.stack) console.error(LOG_PREFIX, err.stack);
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
      console.warn(LOG_PREFIX, 'Raw JSON string length:', jsonStr.length, 'preview:', jsonStr.slice(0, 300));
      return null;
    }
  } catch (err) {
    const e = err as Error;
    console.error(LOG_PREFIX, 'Unexpected error:', e.message, e.stack);
    return null;
  }
}
