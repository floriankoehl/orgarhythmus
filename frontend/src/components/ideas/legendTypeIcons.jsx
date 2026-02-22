/**
 * Icon registry for Legend Types.
 * Maps icon key strings to MUI icon components.
 * The key is stored in the database as `icon` on LegendType.
 */
import StarIcon from "@mui/icons-material/Star";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import FlagIcon from "@mui/icons-material/Flag";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import BoltIcon from "@mui/icons-material/Bolt";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import BuildIcon from "@mui/icons-material/Build";
import CodeIcon from "@mui/icons-material/Code";
import BugReportIcon from "@mui/icons-material/BugReport";
import ScienceIcon from "@mui/icons-material/Science";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TimelineIcon from "@mui/icons-material/Timeline";
import InsightsIcon from "@mui/icons-material/Insights";
import SpeedIcon from "@mui/icons-material/Speed";
import VerifiedIcon from "@mui/icons-material/Verified";
import EmojiObjectsIcon from "@mui/icons-material/EmojiObjects";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DiamondIcon from "@mui/icons-material/Diamond";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import ExtensionIcon from "@mui/icons-material/Extension";
import CategoryIcon from "@mui/icons-material/Category";
import LayersIcon from "@mui/icons-material/Layers";
import FilterListIcon from "@mui/icons-material/FilterList";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import PushPinIcon from "@mui/icons-material/PushPin";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import CloudIcon from "@mui/icons-material/Cloud";
import StorageIcon from "@mui/icons-material/Storage";
import DevicesIcon from "@mui/icons-material/Devices";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import PaletteIcon from "@mui/icons-material/Palette";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CampaignIcon from "@mui/icons-material/Campaign";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import NatureIcon from "@mui/icons-material/Nature";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AcUnitIcon from "@mui/icons-material/AcUnit";

/**
 * Full icon registry: key → { component, label, category }
 * Categories help group icons in the picker UI.
 */
export const LEGEND_TYPE_ICONS = {
  // ── Status & Priority ──
  Star:           { component: StarIcon,           label: "Star",            category: "Status" },
  Flag:           { component: FlagIcon,            label: "Flag",            category: "Status" },
  CheckCircle:    { component: CheckCircleIcon,     label: "Done",            category: "Status" },
  Warning:        { component: WarningIcon,         label: "Warning",         category: "Status" },
  Error:          { component: ErrorIcon,           label: "Critical",        category: "Status" },
  Info:           { component: InfoIcon,            label: "Info",            category: "Status" },
  Verified:       { component: VerifiedIcon,        label: "Verified",        category: "Status" },
  Bookmark:       { component: BookmarkIcon,        label: "Bookmark",        category: "Status" },
  PushPin:        { component: PushPinIcon,         label: "Pinned",          category: "Status" },

  // ── Ideas & Creativity ──
  Lightbulb:      { component: LightbulbIcon,       label: "Idea",            category: "Ideas" },
  EmojiObjects:   { component: EmojiObjectsIcon,    label: "Insight",         category: "Ideas" },
  AutoAwesome:    { component: AutoAwesomeIcon,      label: "Magic",           category: "Ideas" },
  Psychology:     { component: PsychologyIcon,      label: "Thinking",        category: "Ideas" },
  Science:        { component: ScienceIcon,         label: "Experiment",      category: "Ideas" },

  // ── Development ──
  Code:           { component: CodeIcon,            label: "Code",            category: "Dev" },
  BugReport:      { component: BugReportIcon,       label: "Bug",             category: "Dev" },
  Build:          { component: BuildIcon,           label: "Build",           category: "Dev" },
  Extension:      { component: ExtensionIcon,       label: "Plugin",          category: "Dev" },
  Storage:        { component: StorageIcon,         label: "Database",        category: "Dev" },
  Devices:        { component: DevicesIcon,         label: "Devices",         category: "Dev" },
  Cloud:          { component: CloudIcon,           label: "Cloud",           category: "Dev" },

  // ── Business & Growth ──
  TrendingUp:     { component: TrendingUpIcon,      label: "Growth",          category: "Business" },
  Timeline:       { component: TimelineIcon,        label: "Timeline",        category: "Business" },
  Insights:       { component: InsightsIcon,        label: "Analytics",       category: "Business" },
  AttachMoney:    { component: AttachMoneyIcon,      label: "Revenue",         category: "Business" },
  ShoppingCart:   { component: ShoppingCartIcon,    label: "Commerce",        category: "Business" },
  Business:       { component: BusinessIcon,        label: "Enterprise",      category: "Business" },
  Campaign:       { component: CampaignIcon,        label: "Marketing",       category: "Business" },

  // ── People & Teams ──
  Person:         { component: PersonIcon,          label: "Person",          category: "People" },
  Groups:         { component: GroupsIcon,          label: "Team",            category: "People" },
  School:         { component: SchoolIcon,          label: "Learning",        category: "People" },
  SupportAgent:   { component: SupportAgentIcon,    label: "Support",         category: "People" },
  AccessibilityNew: { component: AccessibilityNewIcon, label: "Accessibility", category: "People" },

  // ── Design & Creative ──
  Palette:        { component: PaletteIcon,         label: "Design",          category: "Design" },
  DesignServices: { component: DesignServicesIcon,  label: "UX Design",       category: "Design" },
  Diamond:        { component: DiamondIcon,         label: "Premium",         category: "Design" },
  WorkspacePremium: { component: WorkspacePremiumIcon, label: "Award",        category: "Design" },

  // ── Organization ──
  Category:       { component: CategoryIcon,        label: "Category",        category: "Organize" },
  Layers:         { component: LayersIcon,          label: "Layers",          category: "Organize" },
  FilterList:     { component: FilterListIcon,      label: "Filter",          category: "Organize" },
  LocalOffer:     { component: LocalOfferIcon,      label: "Tag",             category: "Organize" },
  Lock:           { component: LockIcon,            label: "Private",         category: "Organize" },
  Public:         { component: PublicIcon,          label: "Public",          category: "Organize" },

  // ── Energy & Nature ──
  RocketLaunch:   { component: RocketLaunchIcon,    label: "Launch",          category: "Energy" },
  Bolt:           { component: BoltIcon,            label: "Quick",           category: "Energy" },
  Speed:          { component: SpeedIcon,           label: "Speed",           category: "Energy" },
  Favorite:       { component: FavoriteIcon,        label: "Favorite",        category: "Energy" },
  LocalFireDepartment: { component: LocalFireDepartmentIcon, label: "Hot",    category: "Energy" },
  DirectionsRun:  { component: DirectionsRunIcon,   label: "Sprint",          category: "Energy" },
  Eco:            { component: NatureIcon,           label: "Nature",          category: "Energy" },
  AcUnit:         { component: AcUnitIcon,          label: "Frozen",          category: "Energy" },
};

/**
 * Get the list of category names used in the registry (in order).
 */
export const ICON_CATEGORIES = [...new Set(Object.values(LEGEND_TYPE_ICONS).map(i => i.category))];

/**
 * Render a legend type icon by key.
 * Returns null if no icon is set.
 *
 * @param {string|null} iconKey - The icon key stored on the legend type
 * @param {object} props - Additional props for the MUI icon component (e.g. style, className)
 */
export function renderLegendTypeIcon(iconKey, props = {}) {
  if (!iconKey) return null;
  const entry = LEGEND_TYPE_ICONS[iconKey];
  if (!entry) return null;
  const IconComp = entry.component;
  return <IconComp {...props} />;
}
