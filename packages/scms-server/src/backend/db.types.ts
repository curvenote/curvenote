import type { $Enums, Prisma } from '@curvenote/scms-db';

export type {
  Site as SiteDBO,
  Work as WorkDBO,
  User as UserDBO,
  Submission as SubmissionDBO,
  SubmissionKind as SubmissionKindDBO,
} from '@curvenote/scms-db';

export type UserWithRolesDBO = Prisma.UserGetPayload<{
  include: {
    site_roles: {
      include: {
        site: {
          select: {
            id: true;
            name: true;
            title: true;
          };
        };
      };
    };
    work_roles: true;
    linkedAccounts: true;
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

export type SubmissionActivityDBO = Prisma.ActivityGetPayload<{
  include: {
    activity_by: true;
    submission: {
      include: {
        id: true;
        site: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    submission_version: {
      select: {
        id: true;
        date_created: true;
      };
    };
    work_version: {
      include: {
        id: true;
        date_created: true;
        work: {
          select: {
            id: true;
          };
        };
      };
    };
    kind: {
      select: {
        name: true;
      };
    };
  };
}>;

export type SubmissionVersionDBO = Prisma.SubmissionVersionGetPayload<{
  include: {
    submitted_by: true;
    submission: {
      include: {
        id: true;
        site: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    work_version: {
      include: {
        work: {
          select: {
            id: true;
          };
        };
      };
    };
  };
}>;

export type SubmissionWithVersionsDBO = Prisma.SubmissionGetPayload<{
  include: {
    kind: true;
    collection: true;
    submitted_by: true;
    site: true;
    versions: {
      include: {
        submitted_by: true;
        work_version: {
          include: {
            work: true;
          };
        };
      };
    };
  };
}>;

export type SubmissionWithVersionsActivityDBO = Prisma.SubmissionGetPayload<{
  include: {
    kind: true;
    submitted_by: true;
    site: true;
    versions: {
      include: {
        submitted_by: true;
        work_version: true;
      };
    };
    activity: {
      orderBy: {
        date_created: 'desc';
      };
      include: {
        activity_by: true;
        kind: true;
        submission_version: true;
        work_version: true;
      };
    };
  };
}>;

export type WorkVersionDBO = Prisma.WorkVersionGetPayload<{
  select: {
    id: true;
    date_created: true;
    draft: true;
    cdn: true;
    cdn_key: true;
    title: true;
    description: true;
    authors: true;
    date: true;
    doi: true;
    canonical: true;
    work_id: true;
    occ: true;
  };
}> & {
  metadata?: Prisma.JsonValue | null;
};

export type CreateWorkVersion = {
  title?: string;
  description?: string | null;
  authors?: string[];
  author_details?: Record<string, any>[];
  date?: string | null;
  doi?: string | null;
  canonical?: boolean | null;
  cdn?: string | null;
  cdn_key?: string | null;
};

export type MystWorkVersion = CreateWorkVersion & {
  cdn: string;
  cdn_key: string;
};

export type MyUserDBO = UserWithRolesDBO;

export type UserSiteDBO = Prisma.SiteGetPayload<any> & { role: $Enums.SiteRole | null };

export type JobDBO = Prisma.JobGetPayload<any>;
