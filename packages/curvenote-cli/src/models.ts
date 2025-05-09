import type { AnyAction } from '@reduxjs/toolkit';
import type {
  MyUser as MyUserDTO,
  User as UserDTO,
  Team as TeamDTO,
  Project as ProjectDTO,
  SiteConfigDTO,
  Block as BlockDTO,
  ALL_BLOCKS,
  ProjectId,
  BlockId,
  VersionId,
  FormatTypes,
  TemplateSpec,
} from '@curvenote/blocks';
import {
  projectFromDTO,
  blockFromDTO,
  versionFromDTO,
  userFromDTO,
  myUserFromDTO,
  teamFromDTO,
  siteConfigFromDTO,
} from '@curvenote/blocks';
import type { ISession } from './session/types.js';
import type { RootState } from './store/index.js';
import { selectors } from './store/index.js';
import {
  users,
  teams,
  blocks,
  projects,
  siteconfigs,
  versions,
  templates,
} from './store/api/index.js';
import { versionIdToURL } from './utils/index.js';

/** Base class for API models */
class BaseTransfer<
  ID,
  DTO extends { id: ID },
  GetOptions extends Record<string, string> = Record<string, never>,
> {
  modelKind = '';

  session: ISession;

  id: ID;

  $data?: DTO;

  $fromDTO: (id: ID, json: Record<string, any>) => DTO = () => {
    throw new Error('Must be set in base class');
  };

  $createUrl: () => string = () => {
    throw new Error('Must be set in base class');
  };

  $selector?: (state: RootState, id: ID) => DTO;

  $receive?: (dto: DTO) => AnyAction;

  constructor(session: ISession, id: ID) {
    this.id = id;
    this.session = session;
  }

  get data(): DTO {
    if (this.$data) return this.$data;
    throw new Error(`${this.modelKind}: Must call "get" first`);
  }

  set data(data: DTO) {
    this.id = data.id;
    this.$data = this.$fromDTO(data.id, data);
    if (this.$receive) this.session.store.dispatch(this.$receive(data));
  }

  async get(query?: GetOptions) {
    const url = this.$createUrl();
    const state = this.session.store.getState() as RootState;
    const fromSession = this.$selector?.(state, this.id);
    if (fromSession) {
      this.session.log.debug(`Loading ${this.modelKind} from cache: "${url}"`);
      this.data = fromSession;
      return this;
    }
    this.session.log.debug(`Fetching ${this.modelKind}: "${url}"`);
    const { ok, json } = await this.session.get(url, query);
    if (!ok) {
      if ('message' in json) {
        console.log('mode.get throw 1');
        throw new Error(`${this.modelKind}: (${url}) ${json.message}`);
      }
      console.log('mode.get throw 2');
      throw new Error(`${this.modelKind}: Not found (${url}) or you do not have access.`);
    }
    this.data = json as any;
    return this;
  }
}

export class MyUser extends BaseTransfer<string, MyUserDTO> {
  constructor(session: ISession) {
    super(session, '');
  }

  modelKind = 'User';

  $fromDTO = myUserFromDTO;

  $createUrl = () => {
    let audience = this.session.activeTokens.session?.decoded?.aud;
    if (audience && !audience?.endsWith('/')) audience = audience.replace(/\/$/, '');
    return `${audience}/my/user`;
  };

  $receive = users.actions.receive;

  // TODO: $selector for MyUser that looks at the session
}

export class User extends BaseTransfer<string, UserDTO> {
  modelKind = 'User';

  $fromDTO = userFromDTO;

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}/users/${this.id}`;
  };

  $receive = users.actions.receive;

  $selector = selectors.selectUser;
}

export class Team extends BaseTransfer<string, TeamDTO> {
  modelKind = 'Team';

  $fromDTO = teamFromDTO;

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}/teams/${this.id}`;
  };

  $receive = teams.actions.receive;

  $selector = selectors.selectTeam;
}

export class Project extends BaseTransfer<ProjectId, ProjectDTO> {
  modelKind = 'Project';

  $fromDTO = projectFromDTO;

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}/projects/${this.id}`;
  };

  $receive = projects.actions.receive;

  $selector = selectors.selectProject;
}

export class RemoteSiteConfig extends BaseTransfer<ProjectId, SiteConfigDTO> {
  modelKind = 'SiteConfig';

  $fromDTO = siteConfigFromDTO;

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}/sites/${this.id}`;
  };

  $receive = siteconfigs.actions.receive;

  $selector = selectors.selectSiteConfig;
}

export class Block extends BaseTransfer<BlockId, BlockDTO> {
  modelKind = 'Block';

  $fromDTO = blockFromDTO;

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}/blocks/${this.id.project}/${this.id.block}`;
  };

  $receive = blocks.actions.receive;

  $selector = selectors.selectBlock;
}

export type VersionQueryOpts = { format?: FormatTypes };

export class Version<T extends ALL_BLOCKS = ALL_BLOCKS> extends BaseTransfer<
  VersionId,
  T,
  VersionQueryOpts
> {
  modelKind = 'Version';

  $fromDTO = versionFromDTO as (versionId: VersionId, json: Record<string, any>) => T;

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}${versionIdToURL(this.id)}`;
  };

  $receive = versions.actions.receive;

  $selector = selectors.selectVersion;
}

export class Template extends BaseTransfer<string, TemplateSpec & { id: string }> {
  modelKind = 'Template';

  // TODO better unpacking and defaults on the dto contents
  $fromDTO = (id: string, json: Record<string, any>) =>
    ({ id, ...json }) as TemplateSpec & { id: string };

  $createUrl = () => {
    return `${this.session.config.editorApiUrl}/templates/${this.id}`;
  };

  $receive = templates.actions.receive;

  $selector = selectors.selectTemplate;
}
