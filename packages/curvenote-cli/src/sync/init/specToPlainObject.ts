/**
 * Convert a TemplateQuestionSpec to a plain object with all fields,
 * including undefined values for clarity
 */
export function specToPlainObject(spec: TemplateQuestionSpec): Record<string, any> {
  return {
    id: spec.id,
    field: spec.field,
    enabled: spec.enabled,
    type: spec.type,
    message: spec.message,
    placeholder: spec.placeholder !== undefined ? spec.placeholder : undefined,
    hint: spec.hint !== undefined ? spec.hint : undefined,
    default: spec.default !== undefined ? spec.default : undefined,
    required: spec.required,
  };
}
