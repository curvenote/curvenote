import type { SubmissionVersionDTO, SubmissionsListItemDTO } from '@curvenote/common';

export function getSubmissionUrlsFromItem(
  item: SubmissionsListItemDTO | SubmissionVersionDTO,
  baseUrl: string,
  signature: string,
) {
  let previewUrl: string | undefined;
  let publishedUrl: string | undefined;
  if ((item as SubmissionsListItemDTO).version_id) {
    const listItem = item as SubmissionsListItemDTO;
    const isPublished = item.status === 'PUBLISHED' || listItem.published_version;
    publishedUrl = isPublished
      ? `${baseUrl}/articles/${listItem.published_version?.work_id}`
      : undefined;
  } else if ((item as SubmissionVersionDTO).submission_id) {
    const version = item as SubmissionVersionDTO;
    previewUrl = `${baseUrl}/previews/${item.id}?preview=${signature}`;
    publishedUrl =
      item.status === 'PUBLISHED' ? `${baseUrl}/articles/${version.site_work.id}` : undefined;
  } else {
    console.error(
      'Invalid item passed to SubmissionActionsDropdown cannot determine wether it is SubmissionsListItemDTO or SubmissionVersionDTO',
      item,
    );
  }

  return {
    preview: previewUrl,
    published: publishedUrl,
    build: item.links.build,
  };
}
