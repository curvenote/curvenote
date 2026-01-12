export function findImportantVersions(versions: { status: string }[]): {
  published?: number;
  retracted?: number;
  active?: number;
} {
  const idxs: {
    published?: number;
    retracted?: number;
    active?: number;
  } = {
    published: undefined,
    retracted: undefined,
    active: undefined,
  };
  // version are expected in reverse order
  const statuses = versions.map((v) => v.status);

  for (let i = 0; i < statuses.length; i++) {
    if (
      idxs.published === undefined &&
      idxs.active === undefined &&
      (statuses[i] === 'PENDING' || statuses[i] === 'APPROVED')
    ) {
      // first pending or approved that is more recent than the latest published
      idxs.active = i;
    }
    if (idxs.published === undefined && statuses[i] === 'PUBLISHED') {
      // latest published
      idxs.published = i;
    }
    if (idxs.retracted === undefined && statuses[i] === 'RETRACTED') {
      // latest retracted
      idxs.retracted = i;
    }
  }

  return idxs;
}

export function dateToday() {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
