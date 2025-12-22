import {
  LandPlot,
  Sparkles,
  Package,
  FileBadge,
  Library,
  Truck,
  LineChart,
  Pickaxe,
  KeyRound,
  Settings,
  Send,
  Files,
  Zap,
  LockKeyhole,
  House,
  Inbox,
  Users,
  Settings2,
  Store,
  Search,
  User,
  Link2,
  Upload,
  FileText,
  Book,
  Palette,
  PlugZap,
  GitBranch,
  ShieldCheck,
  RefreshCw,
  Mail,
  Ship,
  UserPlus,
  UserCheck,
  LayoutDashboard,
  SquareLibrary,
  Share2,
  GraduationCap,
} from 'lucide-react';
import { cn } from '../../utils/index.js';
import type { ClientExtension } from '../../modules/extensions/types.js';
import { getExtensionIcon } from '../../modules/index.js';

export function MenuIcon({
  className,
  name,
  extensions,
}: {
  className?: string;
  name: string;
  extensions?: ClientExtension[];
}) {
  const classNameWithDefaults = cn('w-5 h-5 stroke-[1.5px]', className);

  // Extension icons must be passed as props since loading is async
  if (extensions) {
    const ExtensionIcon = getExtensionIcon(extensions, name);
    if (ExtensionIcon) {
      return <ExtensionIcon className={classNameWithDefaults} />;
    }
  }

  switch (name) {
    case 'site':
    case 'venues':
      return <LandPlot className={classNameWithDefaults} />;
    case 'settings':
      return <Settings className={classNameWithDefaults} />;
    case 'work.details':
    case 'file-text':
      return <FileText className={classNameWithDefaults} />;
    case 'work.checks':
    case 'shield-check':
      return <ShieldCheck className={classNameWithDefaults} />;
    case 'files':
      return <Files className={classNameWithDefaults} />;
    case 'zap':
      return <Zap className={classNameWithDefaults} />;
    case 'lock-keyhole':
      return <LockKeyhole className={classNameWithDefaults} />;
    case 'house':
      return <House className={classNameWithDefaults} />;
    case 'platform.messages':
    case 'inbox':
      return <Inbox className={classNameWithDefaults} />;
    case 'submissions':
    case 'store':
      return <Store className={classNameWithDefaults} />;
    case 'system.users':
    case 'admin.users':
    case 'work.users':
    case 'platform.users':
    case 'users':
      return <Users className={classNameWithDefaults} />;
    case 'user':
    case 'settings.account':
      return <User className={classNameWithDefaults} />;
    case 'admin.settings':
    case 'settings-2':
      return <Settings2 className={classNameWithDefaults} />;
    case 'admin.advanced':
    case 'pickaxe':
      return <Pickaxe className={classNameWithDefaults} />;
    case 'admin.storage':
    case 'package':
      return <Package className={classNameWithDefaults} />;
    case 'admin.domains':
    case 'landplot':
      return <LandPlot className={classNameWithDefaults} />;
    case 'admin.new-site':
    case 'sparkles':
      return <Sparkles className={classNameWithDefaults} />;
    case 'admin.kinds':
    case 'file-badge':
      return <FileBadge className={classNameWithDefaults} />;
    case 'admin.collections':
    case 'library':
      return <Library className={classNameWithDefaults} />;
    case 'admin.migrate':
    case 'truck':
      return <Truck className={classNameWithDefaults} />;
    case 'admin.submissions':
      return <Send className={classNameWithDefaults} />;
    case 'platform.workflows':
    case 'admin.workflows':
      return <GitBranch className={classNameWithDefaults} />;
    case 'line-chart':
    case 'admin.analytics':
    case 'platform.analytics':
    case 'admin.analytics-events':
      return <LineChart className={classNameWithDefaults} />;
    case 'key-round':
    case 'settings.tokens':
      return <KeyRound className={classNameWithDefaults} />;
    case 'settings.linked-accounts':
      return <Link2 className={classNameWithDefaults} />;
    case 'upload':
      return <Upload className={classNameWithDefaults} />;
    case 'admin.website':
    case 'admin.design':
    case 'palette':
      return <Palette className={classNameWithDefaults} />;
    case 'admin.extensions':
    case 'platform.extensions':
    case 'plug-zap':
      return <PlugZap className={classNameWithDefaults} />;
    case 'compliance':
      return <ShieldCheck className={classNameWithDefaults} />;
    case 'status':
    case 'workflow-sync':
    case 'grants-sync':
    case 'sync':
      return <RefreshCw className={classNameWithDefaults} />;
    case 'search':
      return <Search className={classNameWithDefaults} />;
    case 'admin.email-test':
    case 'settings.emails':
      return <Mail className={classNameWithDefaults} />;
    case 'platform':
    case 'ship':
      return <Ship className={classNameWithDefaults} />;
    case 'user-plus':
    case 'platform.onboarding':
      return <UserPlus className={classNameWithDefaults} />;
    case 'platform.pending-approval':
      return <UserCheck className={classNameWithDefaults} />;
    case 'layout-dashboard':
      return <LayoutDashboard className={classNameWithDefaults} />;
    case 'square-library':
      return <SquareLibrary className={classNameWithDefaults} />;
    case 'share':
      return <Share2 className={classNameWithDefaults} />;
    case 'graduation-cap':
      return <GraduationCap className={classNameWithDefaults} />;
    default:
      return <Book className={classNameWithDefaults} />;
  }
}
