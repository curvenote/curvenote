import { createService } from './service.js';

export type {
  ConverterPayload,
  WorkVersionPayload,
  WorkVersionMetadataPayload,
  ConversionType,
  ConverterTarget,
  FileMetadataSectionItem,
  FileMetadataSection,
} from './payload.js';
export { CONVERSION_TYPES, CONVERSION_TYPE_TARGET, CONVERTER_TARGETS } from './payload.js';

const service = createService();

const port = process.env.PORT ?? 8080;
service.listen(port, () => {
  console.info(`task-converter: listening on port ${port}`);
});
