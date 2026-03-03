import { Checkbox, Input, Skeleton } from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { onError } from "../api/utils";
import {
	useBoxInfo,
	useDeprecatedCapabilities,
	useResetSetting,
	useSettingsIntrospect,
	useUpdateSetting,
} from "../components/settings/api";
import { SettingsContent } from "../components/settings/settings-content";
import { SettingsSidebar } from "../components/settings/settings-sidebar";
import type { Setting } from "../components/settings/types";
import { filterSettings, groupByCategory } from "../components/settings/utils";

export const Route = createFileRoute("/settings")({
	staticData: { title: "Settings" },
	loader: () => ({ breadCrumb: "Settings" }),
	component: SettingsPage,
});

function SettingsPage() {
	const { data: allSettings, isLoading } = useSettingsIntrospect();
	const { data: boxInfo } = useBoxInfo();
	const { data: deprecatedCapabilities } = useDeprecatedCapabilities();
	const updateSetting = useUpdateSetting();
	const resetSetting = useResetSetting();

	const [search, setSearch] = useState("");
	const [hideDefaults, setHideDefaults] = useState(false);
	const [editedSettings, setEditedSettings] = useState<Set<string>>(new Set());
	const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>(
		{},
	);
	const [confirmations, setConfirmations] = useState<Record<string, boolean>>(
		{},
	);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Compute visible categories from current filtered data
	const computedVisibleCategories = useMemo(() => {
		if (!allSettings) return new Set<string>();
		const filtered = filterSettings(
			allSettings,
			search,
			hideDefaults,
			editedSettings,
		);
		const grouped = groupByCategory(filtered);
		return new Set(Object.keys(grouped));
	}, [allSettings, search, hideDefaults, editedSettings]);

	// Debug mode — always true for now, will be wired to aidbox config
	const isDebugMode = true;

	const handleValueChange = useCallback((name: string, value: unknown) => {
		setPendingChanges((prev) => ({ ...prev, [name]: value }));
		setConfirmations((prev) => ({ ...prev, [name]: true }));
	}, []);

	const handleSave = useCallback(
		(setting: Setting, value: unknown) => {
			setEditedSettings((prev) => new Set(prev).add(setting.name));

			const valueStr = String(value ?? "");
			if (valueStr === "") {
				resetSetting.mutate(
					{ name: setting.name },
					{
						onSuccess: () => {
							setPendingChanges((prev) => {
								const next = { ...prev };
								delete next[setting.name];
								return next;
							});
							setConfirmations((prev) => ({
								...prev,
								[setting.name]: false,
							}));
							setErrors((prev) => {
								const next = { ...prev };
								delete next[setting.name];
								return next;
							});
						},
						onError: async (error) => {
							await onError(error);
						},
					},
				);
			} else {
				updateSetting.mutate(
					{ name: setting.name, value },
					{
						onSuccess: () => {
							setPendingChanges((prev) => {
								const next = { ...prev };
								delete next[setting.name];
								return next;
							});
							setConfirmations((prev) => ({
								...prev,
								[setting.name]: false,
							}));
							setErrors((prev) => {
								const next = { ...prev };
								delete next[setting.name];
								return next;
							});
						},
						onError: async (error) => {
							await onError(error);
						},
					},
				);
			}
		},
		[updateSetting, resetSetting],
	);

	const handleImmediateSave = useCallback(
		(setting: Setting, value: unknown) => {
			setEditedSettings((prev) => new Set(prev).add(setting.name));
			updateSetting.mutate(
				{ name: setting.name, value },
				{
					onError: async (error) => {
						await onError(error);
					},
				},
			);
		},
		[updateSetting],
	);

	const handleCancel = useCallback((setting: Setting) => {
		setPendingChanges((prev) => {
			const next = { ...prev };
			delete next[setting.name];
			return next;
		});
		setConfirmations((prev) => ({ ...prev, [setting.name]: false }));
		setErrors((prev) => {
			const next = { ...prev };
			delete next[setting.name];
			return next;
		});
	}, []);

	const handleClearError = useCallback((name: string) => {
		setErrors((prev) => {
			const next = { ...prev };
			delete next[name];
			return next;
		});
	}, []);

	if (isLoading) {
		return (
			<div className="flex h-full">
				<div className="w-60 shrink-0 border-r border-border-primary p-3">
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton
								key={`sidebar-${i.toString()}`}
								className="h-8 w-full rounded"
							/>
						))}
					</div>
				</div>
				<div className="flex-1 p-6">
					<div className="space-y-4">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton
								key={`content-${i.toString()}`}
								className="h-12 w-full rounded"
							/>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex shrink-0 items-center gap-4 border-b border-border-primary px-6 py-3">
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search settings..."
					leftSlot={<Search size={16} />}
					className="max-w-xs"
				/>
				<label
					htmlFor="hide-defaults-checkbox"
					className="flex items-center gap-2 text-sm text-text-secondary"
				>
					<Checkbox
						id="hide-defaults-checkbox"
						checked={hideDefaults}
						onCheckedChange={(checked) => setHideDefaults(checked === true)}
						size="small"
					/>
					Hide default
				</label>
			</div>

			{/* Main content */}
			<div className="flex min-h-0 flex-1">
				<SettingsSidebar visibleCategories={computedVisibleCategories} />
				<SettingsContent
					allSettings={allSettings ?? []}
					search={search}
					hideDefaults={hideDefaults}
					editedSettings={editedSettings}
					isDebugMode={isDebugMode}
					pendingChanges={pendingChanges}
					confirmations={confirmations}
					errors={errors}
					onValueChange={handleValueChange}
					onSave={handleSave}
					onCancel={handleCancel}
					onClearError={handleClearError}
					onImmediateSave={handleImmediateSave}
					boxInfo={boxInfo}
					deprecatedCapabilities={deprecatedCapabilities}
				/>
			</div>
		</div>
	);
}
