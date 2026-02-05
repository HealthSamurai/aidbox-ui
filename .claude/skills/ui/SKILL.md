---
description: UI component library reference — components, design tokens, typography, icons. Use when user needs to build UI, pick a component, apply design tokens, or generate JSX code using the Aidbox design system.
---

# Aidbox React Components — Design System Reference

You are an expert in the Aidbox React component library. When the user describes what UI they need, you should:
1. Identify which components from this library match the request
2. Show example JSX using correct props, variants, and design tokens
3. Reference the exact import path from `@health-samurai/react-components`
4. Apply the correct design tokens (colors, spacing, typography) from the system

All components are exported from `@health-samurai/react-components` (source: `node_modules/@health-samurai/react-components/src/index.tsx`).
CSS must be imported: `import "@health-samurai/react-components/index.css"`.

---

## Components

### Button
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/button.tsx`
- **Description**: Primary action button. Supports multiple visual variants and sizes. Use for CTAs, form submissions, navigation actions.
- **Props**: `variant` (`"primary"` | `"secondary"` | `"link"` | `"ghost"`), `size` (`"regular"` | `"small"`), `danger` (boolean), `asChild` (boolean), plus all native `<button>` props.
- **Exports**: `Button`, `buttonVariants`

### IconButton
- **Source**: `node_modules/@health-samurai/react-components/src/components/icon-button.tsx`
- **Description**: Compact button that displays only an icon (no text). Requires `aria-label` for accessibility.
- **Props**: `icon` (ReactNode), `variant` (`"ghost"` | `"link"`), `aria-label` (string, required), plus native `<button>` props (except `children`).
- **Exports**: `IconButton`, `iconButtonVariants`

### SplitButton
- **Source**: `node_modules/@health-samurai/react-components/src/components/split-button.tsx`
- **Description**: Composite button with a primary action and a dropdown trigger side-by-side. Wraps a `Button` and a `DropdownMenuTrigger`.
- **Props**: `size` (`"regular"` | `"small"`), `disabled` (boolean), `children` (ReactNode).
- **Exports**: `SplitButton`

### ButtonDropdown
- **Source**: `node_modules/@health-samurai/react-components/src/components/button-dropdown.tsx`
- **Description**: Pill-shaped dropdown selector. Shows the currently selected label and opens a searchable list (Command/Popover) to pick a new value.
- **Props**: `options` (`{ value: string; label: string }[]`), `selectedValue` (string), `onSelectItem` (`(item: string) => void`).
- **Exports**: `ButtonDropdown`

### Input
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/input.tsx`
- **Description**: Text input field with support for prefix/suffix labels, left/right icon slots, and validation states.
- **Props**: `type` (`"text"` | `"password"`), `invalid` (boolean), `prefixValue` (ReactNode), `suffix` (string), `leftSlot` (ReactNode), `rightSlot` (ReactNode), plus native `<input>` props.
- **Exports**: `Input`, `inputVariants`

### Textarea
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/textarea.tsx`
- **Description**: Multi-line text input, styled consistently with the design system.
- **Exports**: `Textarea`

### Select
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/select.tsx`
- **Description**: Dropdown select built on Radix UI. Compound component pattern with Trigger, Content, Item, etc.
- **Props (SelectTrigger)**: `variant` (`"default"` | `"compound"`), plus Radix Select.Trigger props.
- **Exports**: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`

### Combobox
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/combobox.tsx`
- **Description**: Searchable select (autocomplete) combining a Popover with a Command input.
- **Exports**: `Combobox`

### Checkbox
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/checkbox.tsx`
- **Description**: Checkbox with checked, unchecked, and indeterminate states. Two sizes.
- **Props**: `size` (`"regular"` | `"small"`), `checked` (boolean | `"indeterminate"`), plus Radix Checkbox props.
- **Exports**: `Checkbox`

### Switch
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/switch.tsx`
- **Description**: Toggle switch for boolean on/off values.
- **Props**: `size` (`"regular"` | `"small"`), plus Radix Switch props.
- **Exports**: `Switch`

### RadioGroup / RadioButtonGroup
- **Source (RadioGroup)**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/radio-group.tsx`
- **Source (RadioButtonGroup)**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/radio-button-group.tsx`
- **Description**: `RadioButtonGroup` is a higher-level component that renders a labeled group of radio options. Supports `wrapped` (card-style) and `unwrapped` (plain) variants, vertical/horizontal layout.
- **Props (RadioButtonGroup)**: `options` (`{ value, label, description?, disabled? }[]`), `variant` (`"wrapped"` | `"unwrapped"`), `vertical` (boolean), `title` (string), `description` (string).
- **Exports**: `RadioButtonGroup`, `RadioGroupItem`

### Badge
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/badge.tsx`
- **Description**: Small label/status indicator. Inline, pill-shaped.
- **Props**: `variant` (`"default"` | `"secondary"` | `"destructive"` | `"outline"`), `asChild` (boolean).
- **Exports**: `Badge`, `badgeVariants`

### Tag
- **Source**: `node_modules/@health-samurai/react-components/src/components/tag.tsx`
- **Description**: Colored chip/tag for statuses, categories, labels. Highly configurable: shape, size, type, color, vibrance.
- **Props**: `shape` (`"round"` | `"square"`), `size` (`"big"` | `"small"`), `type` (`"filled"` | `"outlined"`), `vibrance` (`"vivid"` | `"subtle"`), `color` (`"green"` | `"gray"` | `"red"` | `"blue"` | `"yellow"` | `"contrast"`), `icon` (ReactNode), `showIcon` (boolean).
- **Exports**: `Tag`

### Alert
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/alert.tsx`
- **Description**: Banner-style notification with icon, title, and description. Multiple severity variants.
- **Props**: `variant` (`"critical"` | `"warning"` | `"info"` | `"neutral"` | `"success"`), `vivid` (boolean), `icon` (boolean).
- **Exports**: `Alert`, `AlertTitle`, `AlertDescription`

### AlertDialog
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/alert-dialog.tsx`
- **Description**: Modal confirmation dialog. Compound component: Trigger, Content, Header, Footer, Title, Description, Action, Cancel.
- **Exports**: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`

### Dialog
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/dialog.tsx`
- **Description**: General-purpose modal overlay. Compound component pattern.
- **Exports**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`

### Sheet
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/sheet.tsx`
- **Description**: Slide-in panel from a screen edge (side drawer).
- **Exports**: `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SheetClose`

### Drawer
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/drawer.tsx`
- **Description**: Bottom drawer (mobile-friendly). Based on Vaul.
- **Exports**: `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`, `DrawerClose`

### Popover
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/popover.tsx`
- **Description**: Floating content panel anchored to a trigger element.
- **Exports**: `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`

### HoverCard
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/hover-card.tsx`
- **Description**: Content card that appears on hover over a trigger.
- **Exports**: `HoverCard`, `HoverCardTrigger`, `HoverCardContent`

### Tooltip
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/tooltip.tsx`
- **Description**: Small floating label on hover/focus for additional info.
- **Exports**: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

### DropdownMenu
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/dropdown-menu.tsx`
- **Description**: Context/action menu attached to a trigger. Supports items, checkboxes, radio items, sub-menus, separators.
- **Exports**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuGroup`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`

### ContextMenu
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/context-menu.tsx`
- **Description**: Right-click context menu. Same structure as DropdownMenu.
- **Exports**: `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, etc.

### Menubar
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/menubar.tsx`
- **Description**: Horizontal menu bar (e.g. File, Edit, View). Desktop app-style menus.
- **Exports**: `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`, etc.

### NavigationMenu
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/navigation-menu.tsx`
- **Description**: Accessible top-level site navigation with dropdown sections.
- **Exports**: `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuTrigger`, `NavigationMenuContent`, `NavigationMenuLink`

### Tabs
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/tabs.tsx`
- **Description**: Tab navigation with multiple visual variants. Supports closable browser-style tabs with scroll buttons and dropdown list.
- **Props (Tabs)**: `variant` (`"browser"` | `"secondary"` | `"tertiary"`), typed `value`/`onValueChange`.
- **Exports**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `TabsBrowserList`, `TabsAddButton`, `TabsListDropdown`

### Accordion
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/accordion.tsx`
- **Description**: Expandable/collapsible content sections.
- **Exports**: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`

### Collapsible
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/collapsible.tsx`
- **Description**: Simple open/close toggle for a single content section.
- **Exports**: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`

### Table
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/table.tsx`
- **Description**: Styled HTML table primitives.
- **Exports**: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`

### DataTable
- **Source**: `node_modules/@health-samurai/react-components/src/components/data-table.tsx`
- **Description**: Feature-rich data table built on TanStack Table. Supports column resizing, sticky headers.
- **Props**: `columns` (`ColumnDef[]`), `data` (`TData[]`), `stickyHeader` (boolean).
- **Exports**: `DataTable`, `ColumnDef`, `AccessorKeyColumnDef`

### Card
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/card.tsx`
- **Description**: Container card with header, content, footer, title, and description sub-components.
- **Exports**: `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`

### Tile
- **Source**: `node_modules/@health-samurai/react-components/src/components/tile.tsx`
- **Description**: Metric/stat card showing a label, value, and optional icon. Great for dashboards.
- **Props**: `label` (string), `value` (string | number), `icon` (ReactNode), `showIcon` (boolean), `size` (`"auto"` | `"free"`), `width` (string | number).
- **Exports**: `Tile`

### SegmentControl
- **Source**: `node_modules/@health-samurai/react-components/src/components/segment-control.tsx`
- **Description**: Pill-shaped segmented toggle (like iOS segment control). For switching between 2-4 views.
- **Props**: `value` (string), `onValueChange` (`(value) => void`), `items` (`{ value, label }[]`).
- **Exports**: `SegmentControl`

### Toolbar
- **Source**: `node_modules/@health-samurai/react-components/src/components/toolbar.tsx`
- **Description**: Floating pill-shaped toolbar with a SegmentControl and icon buttons (Copy, Align, Download).
- **Props**: `segmentControlValue`, `onSegmentControlChange`, `segmentControlItems`, `onCopyClick`, `onAlignLeftClick`, `onDownloadClick`, `showCopy`, `showAlignLeft`, `showDownload`.
- **Exports**: `Toolbar`

### TreeView
- **Source**: `node_modules/@health-samurai/react-components/src/components/tree-view.tsx`
- **Description**: Interactive tree/hierarchy view built on @headless-tree. Supports expand/collapse, focus, renaming, drag-and-drop, zebra striping, horizontal guide lines.
- **Props**: `rootItemId`, `items` (Record<string, TreeViewItem>), `customItemView`, `onRename`, `disableHover`, `zebra`, `horizontalLines`, `hideChevron`, `canReorder`, `onDropFn`, plus controlled/uncontrolled expansion and focus.
- **Exports**: `TreeView`, `TreeViewItem`, `TreeInstance`

### CopyIcon
- **Source**: `node_modules/@health-samurai/react-components/src/components/copy-icon.tsx`
- **Description**: Copy-to-clipboard button with animated check feedback and optional tooltip/toast.
- **Props**: `text` (string), `showTooltip` (boolean), `tooltipText` (string), `showToast` (boolean), `onCopy` (callback).
- **Exports**: `CopyIcon`

### Breadcrumb
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/breadcrumb.tsx`
- **Description**: Navigation breadcrumb trail.
- **Exports**: `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`

### Pagination
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/pagination.tsx`
- **Description**: Page navigation with previous/next and page number links.
- **Exports**: `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`

### Avatar
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/avatar.tsx`
- **Description**: Circular avatar image with fallback initials.
- **Exports**: `Avatar`, `AvatarImage`, `AvatarFallback`

### Calendar
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/calendar.tsx`
- **Description**: Date picker calendar (react-day-picker based).
- **Exports**: `Calendar`

### Carousel
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/carousel.tsx`
- **Description**: Horizontal content carousel with embla-carousel.
- **Exports**: `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`

### Chart
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/chart.tsx`
- **Description**: Chart container with Recharts integration, themed tooltips, and a legend.
- **Exports**: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`

### Progress
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/progress.tsx`
- **Description**: Horizontal progress bar.
- **Exports**: `Progress`

### Slider
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/slider.tsx`
- **Description**: Range slider input.
- **Exports**: `Slider`

### Skeleton
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/skeleton.tsx`
- **Description**: Placeholder loading skeleton with pulse animation.
- **Exports**: `Skeleton`

### Separator
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/separator.tsx`
- **Description**: Visual divider line (horizontal or vertical).
- **Exports**: `Separator`

### ScrollArea
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/scroll-area.tsx`
- **Description**: Custom scrollable container with styled scrollbars.
- **Exports**: `ScrollArea`, `ScrollBar`

### AspectRatio
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/aspect-ratio.tsx`
- **Description**: Maintains a fixed aspect ratio for child content.
- **Exports**: `AspectRatio`

### Resizable
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/resizable.tsx`
- **Description**: Resizable panel layout (split panes).
- **Exports**: `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`

### Sidebar
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/sidebar.tsx`
- **Description**: Collapsible application sidebar with header, footer, content, groups, menu items. Provides `SidebarProvider` context.
- **Exports**: `Sidebar`, `SidebarProvider`, `SidebarTrigger`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, etc.

### Label
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/label.tsx`
- **Description**: Form label element.
- **Exports**: `Label`

### Form
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/form.tsx`
- **Description**: Form field wrappers with react-hook-form integration. Provides context for labels, descriptions, error messages.
- **Exports**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`

### InputOTP
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/input-otp.tsx`
- **Description**: One-time password input with individual character slots.
- **Exports**: `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`

### Toggle / ToggleGroup
- **Source (Toggle)**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/toggle.tsx`
- **Source (ToggleGroup)**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/toggle-group.tsx`
- **Description**: Pressable toggle button(s). ToggleGroup for mutually exclusive or multi-select toggles.
- **Exports**: `Toggle`, `ToggleGroup`, `ToggleGroupItem`

### Sonner (Toast)
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/sonner.tsx`
- **Description**: Toast notification system. Use `toast()` function to show notifications.
- **Exports**: `Toaster` (component), `toast` (function, re-exported from sonner)

### Command
- **Source**: `node_modules/@health-samurai/react-components/src/shadcn/components/ui/command.tsx`
- **Description**: Command palette / searchable list (cmdk-based). Used internally by Combobox, ButtonDropdown, etc.
- **Exports**: `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandDialog`

---

## Icons

- **Source**: `node_modules/@health-samurai/react-components/src/icons.tsx`
- **Description**: Custom SVG icon components specific to the Aidbox domain (FHIR types).
- **Available**: `PlayIcon`, `PinIcon`, `ResourceIcon`, `BackboneElementIcon`, `TypCodeIcon`, `ReferenceIcon`, `ComplexTypeIcon`, `UnionIcon`
- **General icons**: The project uses [Lucide React](https://lucide.dev/) (`lucide-react`) for standard icons. Import from `lucide-react` directly.

---

## Design Tokens

All tokens are CSS custom properties defined in `node_modules/@health-samurai/react-components/src/tokens.css` and `node_modules/@health-samurai/react-components/src/index.css`.

### Colors — Base Palette

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **neutral** | #f9f9f9 | #f5f5f6 | #ebecee | #ccced3 | #98a1ae | #717684 | #4a5565 | #364153 | #1e2938 | #1d2331 | #030712 |
| **brand** | #fef7f6 | #fdedea | #f9cac3 | #f4a499 | #ef7767 | #ea4a35 | #d72710 | #c31a03 | #78190c | #4a0f08 | #2e0a05 |
| **grey** | #fafafa | #f5f5f5 | #e5e5e5 | #d4d4d4 | #a4a4a4 | #767676 | #575757 | #434343 | #292929 | #1a1a1a | #0a0a0a |
| **red** | #fef9f9 | #fff6f5 | #fdedea | #f4a499 | #ea4a35 | #d7270f | #d7270f | #c31b03 | #a72d22 | #7a0d00 | #410801 |
| **blue** | #f9fbfe | #f4f8fc | #e9f2fc | #d0e2f8 | #a7c9f3 | #2378e1 | #045ac3 | #014391 | #053775 | #052040 | #05101e |
| **green** | #fbfdf8 | #f8fbf3 | #f1f8e6 | #e3efcb | #c9e19b | #78b506 | #558300 | #334e02 | #1d2b03 | #090d04 | #090d04 |
| **yellow** | #fffdf2 | #fffbe5 | #fff9d9 | #fff4bf | #ffea80 | #ffd400 | #dfa400 | #855600 | #562a00 | #341900 | #200900 |

### Colors — Semantic Tokens

**Text colors** (use via Tailwind classes like `text-text-primary`):
- `--color-text-primary` → neutral-900 (main text)
- `--color-text-secondary` → neutral-500 (supporting text)
- `--color-text-tertiary` → neutral-400
- `--color-text-disabled` → neutral-300
- `--color-text-link` → blue-500
- `--color-text-error-primary` → red-500
- `--color-text-success-primary` → green-500
- `--color-text-warning-primary` → yellow-700
- `--color-text-brand-primary` → brand-500
- `--color-text-primary_on-brand` → neutral-50 (white text on colored bg)

**Background colors** (`bg-bg-primary`, `bg-bg-secondary`, etc.):
- `--color-bg-primary` → #ffffff
- `--color-bg-secondary` → neutral-50
- `--color-bg-tertiary` → neutral-100
- `--color-bg-link` → blue-500 (primary CTA)
- `--color-bg-link_hover` → blue-600
- `--color-bg-error-primary` → red-50 (light error bg)
- `--color-bg-error-primary_inverse` → red-500 (vivid error bg)
- `--color-bg-success-primary` → green-50
- `--color-bg-warning-primary` → yellow-50
- `--color-bg-info-primary` → blue-100

**Border colors** (`border-border-primary`, etc.):
- `--color-border-primary` → neutral-300
- `--color-border-primary_hover` → neutral-400
- `--color-border-secondary` → neutral-200
- `--color-border-separator` → neutral-200
- `--color-border-error` → red-500
- `--color-border-link` → blue-500
- `--color-border-brand` → brand-500
- `--color-border-success` → green-500

**Foreground / Icon colors** (`text-fg-primary`, etc.):
- `--color-fg-primary` → neutral-900
- `--color-fg-secondary` → neutral-700
- `--color-fg-tertiary` → neutral-500
- `--color-fg-disabled` → neutral-300
- `--color-fg-link` → blue-500
- `--color-fg-error-primary` → red-500
- `--color-fg-success-primary` → green-500

### Spacing

| Token | Value |
|---|---|
| `--spacing-quarter` | 2px |
| `--spacing-half` | 4px |
| `--spacing-x1` | 8px |
| `--spacing-x1point5` | 12px |
| `--spacing-x2` | 16px |
| `--spacing-x3` | 24px |
| `--spacing-x4` | 32px |
| `--spacing-x6` | 48px |
| `--spacing-x8` | 64px |
| `--spacing-x12` | 96px |

### Corner Radius

| Token | Value |
|---|---|
| `--corner-corner-xs` | 2px |
| `--corner-corner-s` | 4px |
| `--corner-corner-m` | 6px |
| `--corner-corner-l` | 8px |
| `--corner-corner-max` | 999px (pill) |
| `--radius` | 6px (base) |

### Typography

**Font families**:
- `--font-family-sans` → Inter
- `--font-family-mono` → JetBrains Mono

**Font sizes**:
| Token | Value |
|---|---|
| `--font-size-xxs` | 10px |
| `--font-size-xs` | 12px |
| `--font-size-sm` | 14px |
| `--font-size-base` | 16px |
| `--font-size-lg` | 18px |
| `--font-size-xl` | 20px |
| `--font-size-2xl` | 24px |
| `--font-size-3xl` | 30px |
| `--font-size-4xl` | 36px |
| `--font-size-5xl` | 48px |

**Font weights**:
| Token | Value |
|---|---|
| `--font-weight-thin` | 100 |
| `--font-weight-light` | 300 |
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |
| `--font-weight-extrabold` | 800 |

**Line heights**:
| Token | Value |
|---|---|
| `--font-leading-3` | 12px |
| `--font-leading-4` | 16px |
| `--font-leading-5` | 20px |
| `--font-leading-6` | 24px |
| `--font-leading-7` | 28px |
| `--font-leading-8` | 32px |
| `--font-leading-9` | 36px |
| `--font-leading-10` | 40px |
| `--font-leading-14` | 56px |

**Letter spacing**:
| Token | Value |
|---|---|
| `--font-tracking-tighter` | -0.8px |
| `--font-tracking-tight` | -0.4px |
| `--font-tracking-normal` | 0px |
| `--font-tracking-wide` | 0.4px |

**Typography utility classes** (defined in `typography.css`):
- `.typo-body` — 14px / normal / 20px leading (main body text)
- `.typo-body-xs` — 12px / normal / 12px leading
- `.typo-code` — 14px / mono / 20px leading
- `.typo-label` — 14px / medium / 20px leading (bold body)
- `.typo-label-xs` — 12px / medium / 12px leading
- `.typo-label-tiny` — 10px / normal / uppercase / wide tracking
- `.typo-page-header` — 20px / medium / 28px leading / tight tracking
- `.typo-button-label-xs` — 14px / normal / 16px leading
- `.h1` through `.h6` — heading styles (48px down to 16px)
- `.caption` — 20px / normal / 28px leading
- `.body12`, `.body14`, `.body14bold`, `.body16`, `.body16bold` — explicit body sizes

### Shadows

- `.toolbar-shadow` — subtle layered shadow for floating toolbars
- `.dropdown-menu-shadow` — standard dropdown shadow (`box-shadow: 0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -2px rgba(0,0,0,0.05)`)

---

## Hooks

- `useMobile` — from `@health-samurai/react-components` — detects mobile viewport.

## Utilities

- `cn(...classes)` — Tailwind class merger (clsx + twMerge). Import from `@health-samurai/react-components`.

---

## Usage Guidelines

1. **Always use semantic token classes** (e.g. `text-text-primary`, `bg-bg-secondary`) instead of raw color values. This ensures consistency with the design system.
2. **Use Tailwind utility classes** that reference the token CSS variables: `text-text-primary`, `bg-bg-link`, `border-border-error`, etc.
3. **Icons**: Use `lucide-react` for standard icons. Use the custom icons from `@health-samurai/react-components` for domain-specific FHIR icons only.
4. **Import everything from `@health-samurai/react-components`** — the library re-exports all components from a single entry point.
5. **When generating code**, always read the actual source file for the latest props and variants before writing JSX. The component API in source is the source of truth.
