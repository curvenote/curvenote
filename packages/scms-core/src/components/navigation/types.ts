export type ServerSideMenuContents = {
  sectionName?: string;
  menus: {
    name: string;
    label: string;
    icon?: string;
    url: string;
    end?: boolean;
    requiredScope?: string; // Optional scope required to see this menu item
  }[];
}[];

export type MenuContents = {
  sectionName?: string;
  menus: {
    default?: boolean;
    name: string;
    icon?: React.ReactNode;
    label: string;
    url: string;
    end?: boolean;
  }[];
}[];
