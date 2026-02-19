export type FormField = {
  type: 'field';
  id: string;
};

export type FormContent = {
  type: 'content';
  children: any[];
};

export type FormChild = FormField | FormContent;

export type FormPage = {
  /**
   * The slug of the form page, used in the URL path.
   */
  slug: string;
  /**
   * The title of the form page, shown at the top of the page.
   */
  title: string;
  /**
   * A shorter title for the page, used in the multi-step form navigation.
   */
  shortTitle?: string;
  /**
   * The children of the form page, which can be fields or content.
   * The fields are stored in the `fields` property of the submission form.
   * The content is stored directly in this `children` list.
   */
  children: FormChild[];
};

export type BaseInput<T extends string> = {
  name: string;
  title: string;
  type: T;
  required?: boolean;
};

export type StringOption = BaseInput<'string'> & {
  type: 'string';
  placeholder?: string;
};

export type ParagraphOption = BaseInput<'paragraph'> & {
  type: 'paragraph';
  placeholder?: string;
  /** Max words allowed; validation error if exceeded. */
  maxWordCount?: number;
};

export type RadioOption = BaseInput<'radio'> & {
  type: 'radio';
  kind?: 'horizontal' | 'vertical';
  title: string;
  options: {
    value: string;
    label: string;
    subLabel?: string;
  }[];
};

export type AuthorOption = BaseInput<'author'> & {
  type: 'author';
  title: string;
};

export type KeywordsOption = BaseInput<'keywords'> & {
  type: 'keywords';
  placeholder?: string;
  maxKeywords?: number;
};

export type FieldSchema =
  | StringOption
  | ParagraphOption
  | RadioOption
  | AuthorOption
  | KeywordsOption;

export type FormDefinition = {
  title: string;
  description?: string;
  slug: string;
  banner?: {
    url: string;
    optimizedUrl?: string;
  };
  fields: FieldSchema[];
  pages: FormPage[];
};

export type FormSubmission = {
  fields: Record<string, any>;
  pages: Record<string, { completed: boolean }>;
};

export type Author = {
  id: string;
  name: string;
  email?: string;
  corresponding?: boolean;
  orcid?: string;
  /** IDs referencing the global affiliations list. */
  affiliationIds: string[];
};

export type Affiliation = {
  id: string;
  name: string;
  ror?: string;
  /** Fields that came from ROR API (read-only). Array of field names like ['name', 'city', 'country']. */
  rorFields?: string[];
  department?: string;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
};
