-- ActivityType: work timeline events when async converter jobs finish
ALTER TYPE "ActivityType" ADD VALUE 'CONVERTER_TASK_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'CONVERTER_TASK_FAILED';
