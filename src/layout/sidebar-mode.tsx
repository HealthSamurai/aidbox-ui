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
import { type SidebarMode } from "./sidebar";

const modes = [
    { label: "Expanded", value: "expanded" },
    { label: "Collapsed", value: "collapsed" },
    { label: "Hover", value: "hover" }
]

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
                        checked={mode === value}
                        onCheckedChange={() => onModeChange(value as SidebarMode)}
                    >
                        {label}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>)
}