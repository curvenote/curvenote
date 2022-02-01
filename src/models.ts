import {
  MyUser as MyUserDTO,
  User as UserDTO,
  Team as TeamDTO,
  Project as ProjectDTO,
  Block as BlockDTO,
  ALL_BLOCKS,
  ProjectId,
  BlockId,
  VersionId,
  projectFromDTO,
  blockFromDTO,
  versionFromDTO,
  userFromDTO,
  myUserFromDTO,
  JsonObject,
  teamFromDTO,
  FormatTypes,
  TemplateSpec,
} from '@curvenote/blocks';
import { BaseTransfer } from './base';
import { ISession } from './session/types';
import { users, teams, blocks, projects, versions, templates } from './store';
import {
  selectBlock,
  selectProject,
  selectTeam,
  selectUser,
  selectVersion,
  selectTemplate,
} from './store/selectors';

export class MyUser extends BaseTransfer<string, MyUserDTO> {
  constructor(session: ISession) {
    super(session, '');
  }

  modelKind = 'User';

  $fromDTO = myUserFromDTO;

  $createUrl = () => `/my/user`;

  $recieve = users.actions.recieve;

  // TODO: $selector for MyUser that looks at the session
}

export class User extends BaseTransfer<string, UserDTO> {
  modelKind = 'User';

  $fromDTO = userFromDTO;

  $createUrl = () => `/users/${this.id}`;

  $recieve = users.actions.recieve;

  $selector = selectUser;
}

export class Team extends BaseTransfer<string, TeamDTO> {
  modelKind = 'Team';

  $fromDTO = teamFromDTO;

  $createUrl = () => `/teams/${this.id}`;

  $recieve = teams.actions.recieve;

  $selector = selectTeam;
}

export class Project extends BaseTransfer<ProjectId, ProjectDTO> {
  modelKind = 'Project';

  $fromDTO = projectFromDTO;

  $createUrl = () => `/projects/${this.id}`;

  $recieve = projects.actions.recieve;

  $selector = selectProject;
}

export class Block extends BaseTransfer<BlockId, BlockDTO> {
  modelKind = 'Block';

  $fromDTO = blockFromDTO;

  // TODO this isn't really the create url, its a get?
  $createUrl = () => `/blocks/${this.id.project}/${this.id.block}`;

  $recieve = blocks.actions.recieve;

  $selector = selectBlock;

  static makeCreateUrl = (projectId: string) => `/blocks/${projectId}`;

  static async create(session: ISession, projectId: string, data: JsonObject): Promise<BlockId> {
    const { status, json } = await session.post(Block.makeCreateUrl(projectId), data);
    if (status > 400) throw Error(`Could not create block, status: ${status}`);
    if (!('id' in json)) throw Error(`Could not create block, invalid response: ${json}`);
    return json.id as BlockId;
  }
}

export type VersionQueryOpts = { format?: FormatTypes };

export class Version<T extends ALL_BLOCKS = ALL_BLOCKS> extends BaseTransfer<
  VersionId,
  T,
  VersionQueryOpts
> {
  modelKind = 'Version';

  $fromDTO = versionFromDTO as (versionId: VersionId, json: JsonObject) => T;

  $createUrl = () => `/blocks/${this.id.project}/${this.id.block}/versions/${this.id.version}`;

  $recieve = versions.actions.recieve;

  $selector = selectVersion;

  static makeCreateUrl = (id: BlockId) => `/blocks/${id.project}/${id.block}/versions`;

  static async create(session: ISession, id: BlockId, data: JsonObject): Promise<VersionId> {
    const { status, json } = await session.post(Version.makeCreateUrl(id), data);
    if (status > 400) throw Error(`Could not create version, status: ${status}`);
    if (!('id' in json)) throw Error(`Could not create version, invalid response: ${json}`);
    return json.id as VersionId;
  }
}

export class Template extends BaseTransfer<string, TemplateSpec & { id: string }> {
  modelKind = 'Template';

  // TODO better unpacking and defaults on the dto contents
  $fromDTO = (id: string, json: JsonObject) => ({ id, ...json } as TemplateSpec & { id: string });

  $createUrl = () => `/templates/${this.id}`;

  $recieve = templates.actions.recieve;

  $selector = selectTemplate;
}
