import { assets, metro, patcher } from '@unbound-app/api';
import { createElement } from 'react';

import { ActionSheets } from './modules';
import { confirmAndDelete } from './delete';
import { findRenderTarget } from './render-target';
import {
	type SelectedMessage,
	canDelete,
	count,
	isSelected,
	isSelecting,
	messageFromSheet,
	setSelecting,
	startRange,
	toggle,
} from './selection';
import { exitSelection, refreshSelectionToast, showSelectionWarning } from './selection-ui';
import { findElement, getActionSheetRow, isActionSheetRowGroup } from './sheet-utils';

type SheetRender = (result: unknown) => unknown;
type Unpatch = () => void;

function assetId(name: string): number | undefined {
	const get = (assets as any).getIDByName ?? (assets as any).getIdByName;

	return typeof get === 'function' ? get.call(assets, name) : undefined;
}

/**
 * @description Adds the selection rows to Discord's message long-press sheet: a row that enters
 * selection mode and toggles the open message, plus Delete and Done while the mode is on.
 * @returns A function that removes every patch and ignores sheets still loading afterwards.
 */
export function startMessageSheet(): Unpatch {
	let current: SelectedMessage | null = null;
	let sheetKey: string | null = null;
	let disposed = false;

	const unpatches: Unpatch[] = [];
	const patchedModules = new WeakSet<object>();

	const hide = () => {
		if (!sheetKey) return;

		try {
			ActionSheets.hideActionSheet(sheetKey);
		} catch (error) {
			logger.warn('Could not close the action sheet:', error);
		}
	};

	const render = (result: unknown): unknown => {
		if (!current || disposed) return result;

		const Row = getActionSheetRow();

		if (!Row) return result;

		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (!Array.isArray(rows)) return result;
		if (rows.some((row: any) => row?.key === 'tunya-multi-select-toggle')) return result;

		const rowIcon = (...names: string[]) => {
			if (!Row.Icon) return undefined;

			for (const name of names) {
				const source = assetId(name);

				if (source !== undefined) return createElement(Row.Icon, { source });
			}

			return undefined;
		};

		const message = current;
		const selected = isSelected(message.id);
		const total = count();
		const additions: unknown[] = [
			createElement(Row, {
				key: 'tunya-multi-select-toggle',
				label: selected ? 'Deselect message' : 'Select message',
				icon: selected
					? rowIcon('CheckmarkLargeIcon')
					: rowIcon('PlusLargeIcon', 'PlusMediumIcon', 'CirclePlusIcon', 'AddIcon'),
				onPress: () => {
					hide();

					if (!selected && !canDelete(message)) {
						showSelectionWarning(
							'Cannot delete this message',
							"It isn't yours and you don't have Manage Messages in this channel.",
						);

						return;
					}

					setSelecting(true);
					toggle(message);
					refreshSelectionToast();
				},
			}),
		];

		additions.push(
			createElement(Row, {
				key: 'tunya-multi-select-range',
				label: 'Select range from here',
				icon: rowIcon('ArrowLargeDownIcon', 'ArrowDownIcon', 'ChevronLargeRightIcon'),
				onPress: () => {
					hide();
					startRange(message);
					refreshSelectionToast();
				},
			}),
		);

		if (isSelecting() || total > 0) {
			if (total > 0) {
				additions.push(
					createElement(Row, {
						key: 'tunya-multi-select-delete',
						label: `Delete selected (${total})`,
						icon: rowIcon('TrashIcon') ?? rowIcon('DeleteIcon'),
						variant: 'danger',
						onPress: () => {
							hide();
							void confirmAndDelete();
						},
					}),
				);
			}

			additions.push(
				createElement(Row, {
					key: 'tunya-multi-select-done',
					label: 'Done selecting',
					icon: rowIcon('CircleXIcon') ?? rowIcon('XIcon'),
					onPress: () => {
						hide();
						exitSelection();
					},
				}),
			);
		}

		for (let index = rows.length - 1; index >= 0; index -= 1) {
			const key = rows[index]?.key;

			if (typeof key === 'string' && key.startsWith('tunya-multi-select-')) {
				rows.splice(index, 1);
			}
		}

		rows.splice(Math.min(1, rows.length), 0, ...additions);

		return result;
	};

	function patchModule(module: unknown): void {
		if (disposed || !module || typeof module !== 'object' || patchedModules.has(module)) return;

		patchedModules.add(module);

		const target = findRenderTarget(module as Record<string, any>);

		if (!target) return;

		unpatches.push(
			patcher.after(target.holder, target.key, ({ result }: { result: unknown }) => render(result)),
		);
	}

	// Most sheets, including iOS's message long-press sheet, arrive through openLazy.
	unpatches.push(
		patcher.before(ActionSheets, 'openLazy', ({ args }: { args: any[] }) => {
			const [sheet, key, props] = args;

			if (typeof key !== 'string' || !key.endsWith('MessageLongPressActionSheet') || !props) {
				return;
			}

			const message = messageFromSheet(props);

			if (!message) return;

			current = message;
			sheetKey = key;

			if (sheet && typeof sheet.then === 'function') {
				sheet.then(patchModule).catch(() => undefined);
			}
		}),
	);

	// Some builds render the sheet directly instead of opening it through openLazy.
	void Promise.resolve(
		metro.findLazy(
			metro.filters.byFilePath(
				'modules/messages/native/long_press/LongPressMessageActionSheet.tsx',
			),
		),
	)
		.then((module: unknown) => {
			if (disposed || !module || typeof module !== 'object') return;

			const target = findRenderTarget(module as Record<string, any>);

			if (!target) return;

			unpatches.push(
				patcher.after(target.holder, target.key, (context: any) => {
					const message = messageFromSheet(context.args?.[0]);

					if (!message) return context.result;

					current = message;
					sheetKey = null;

					return render(context.result);
				}),
			);
		})
		.catch(() => undefined);

	return () => {
		disposed = true;
		current = null;

		for (const unpatch of unpatches.splice(0)) unpatch();
	};
}
