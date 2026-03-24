import { Skeleton } from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
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
import {
	createSettingsSearch,
	filterSettings,
	groupByCategory,
} from "../components/settings/utils";

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
	const [, setEditedSettings] = useState<Set<string>>(new Set());
	const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>(
		{},
	);
	const [confirmations, setConfirmations] = useState<Record<string, boolean>>(
		{},
	);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Build Fuse index once when settings data changes
	const searchFn = useMemo(
		() =>
			allSettings
				? createSettingsSearch(
						allSettings.filter((s) => s.category[0] !== "Zen Project"),
					)
				: undefined,
		[allSettings],
	);

	// Compute visible categories from current filtered data
	const computedVisibleCategories = useMemo(() => {
		if (!allSettings) return new Set<string>();
		const filtered = filterSettings(allSettings, search, searchFn);
		const grouped = groupByCategory(filtered);
		return new Set(Object.keys(grouped));
	}, [allSettings, search, searchFn]);

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
				<div className="w-[272px] shrink-0 border-r border-border-secondary">
					<div className="p-3">
						<div className="space-y-2">
							{Array.from({ length: 8 }).map((_, i) => (
								<Skeleton
									key={`sidebar-${i.toString()}`}
									className="h-8 w-full rounded"
								/>
							))}
						</div>
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
		<div className="flex h-full">
			<div className="w-[272px] shrink-0 border-r border-border-secondary">
				<SettingsSidebar visibleCategories={computedVisibleCategories} />
			</div>
			<div className="min-w-0 flex-1">
				<SettingsContent
					allSettings={allSettings ?? []}
					search={search}
					onSearchChange={setSearch}
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
					searchFn={searchFn}
				/>
			</div>
		</div>
	);
}
