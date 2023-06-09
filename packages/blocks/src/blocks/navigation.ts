import type { JsonObject } from '../types.js';
import type {
  BaseVersion,
  KINDS,
  NavListItemDTO,
  NavListBlockItemDTO,
  NavListGroupItemDTO,
} from './types/index.js';
import { NavigationFormatTypes, NavListItemKindEnum } from './types/index.js';

export interface PartialNavigation {
  items: NavListItemDTO[];
}

export interface Navigation extends BaseVersion, PartialNavigation {
  kind: typeof KINDS.Navigation;
}

export const defaultFormat = NavigationFormatTypes.json;

export function fromDTO(dto: JsonObject): PartialNavigation {
  if (!dto.items) return { items: [] };

  return {
    items:
      dto.items.map((item: NavListItemDTO) => {
        if (item.kind === NavListItemKindEnum.Group) {
          const navItem: NavListGroupItemDTO = {
            id: item.id ?? '',
            kind: NavListItemKindEnum.Group,
            title: item.title ?? '',
          };
          return navItem;
        }
        const navItem: NavListBlockItemDTO = {
          id: item.id ?? '',
          kind: NavListItemKindEnum.Item,
          title: item.title ?? '',
          parentId: item.parentId ?? null,
          blockId: item.blockId ?? null,
        };
        return navItem;
      }) ?? [],
  };
}

export function createEmptyNavigation(): PartialNavigation {
  return {
    items: [] as NavListItemDTO[],
  };
}
