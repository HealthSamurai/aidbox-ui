import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@panthevm_original/react-components";
import { PanelLeftClose } from "lucide-react";
import { SidebarMenuButton } from "@panthevm_original/react-components";

export type SidebarMode = "expanded" | "collapsed" | "hover";
const modes: Array<{ label: string; value: SidebarMode }> = [
    { label: "Expanded", value: "expanded" },
    { label: "Collapsed", value: "collapsed" },
    { label: "Hover", value: "hover" }
]

const SIDEBAR_MODE_KEY = "aidbox-sidebar-mode";
export function saveSidebarMode(mode: SidebarMode) {
    localStorage.setItem(SIDEBAR_MODE_KEY, mode);
}

export function getSidebarMode() {
    const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
    return (stored as SidebarMode) || "expanded";
}

export function SidebarModeSelect({ mode, onModeChange }: { mode: SidebarMode, onModeChange: (mode: SidebarMode) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                    <PanelLeftClose></PanelLeftClose>
                    edge:d8c83455a0
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="mx-3 w-[240px]">
                <DropdownMenuLabel>Sidebar control</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {modes.map(({ label, value }) => (
                    <DropdownMenuCheckboxItem
                        key={value}
                        checked={mode === value}
                        onCheckedChange={() => { 
                            saveSidebarMode(value as SidebarMode); 
                            onModeChange(value as SidebarMode); 
                        }}
                    >
                        {label}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>)
}