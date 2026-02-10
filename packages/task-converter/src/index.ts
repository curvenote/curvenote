import { createService } from './service.js';

export type {
  ConverterPayload,
  WorkVersionPayload,
  WorkVersionMetadataPayload,
  ConversionType,
  FileMetadataSectionItem,
  FileMetadataSection,
} from './payload.js';
export { CONVERSION_TYPES } from './payload.js';

const service = createService();

const port = process.env.PORT ?? 8080;
service.listen(port, () => {
  console.info(`task-converter: listening on port ${port}`);
});
