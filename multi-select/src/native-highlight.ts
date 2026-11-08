import type {
	NativeObjCBridge,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';

import { SelectedChannelStore } from './modules';
import { handleMessageTap } from './range';
import {
	count,
	isSelected,
	isSelecting,
	messageFromEvent,
	subscribe,
} from './selection';
import { refreshSelectionToast, showSelectionWarning } from './selection-ui';

type Objc = NativeObjCBridge;
type Cell = NativeObjectHandle;

type CellState = {
	messageId?: string;
	applied?: boolean;
};

const MESSAGE_CELL = 'DCDMessageTableViewCell';

let skipTapId: string | undefined;
let skipTapTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * @description Tells whether a native tap already handled this message, so the slower JS tap
 * Discord sends afterwards does not toggle it a second time.
 * @param messageId The message the JS tap is about.
 * @returns `true` when the native touch handler already handled it.
 */
export function consumeSkippedTap(messageId: string): boolean {
	if (skipTapId !== messageId) return false;

	skipTapId = undefined;

	if (skipTapTimer) clearTimeout(skipTapTimer);

	skipTapTimer = undefined;

	return true;
}

function markSkippedTap(messageId: string): void {
	skipTapId = messageId;

	if (skipTapTimer) clearTimeout(skipTapTimer);

	skipTapTimer = setTimeout(() => {
		skipTapId = undefined;
		skipTapTimer = undefined;
	}, 1500);
}

function stringValue(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) return value;

	if (typeof value === 'number' || typeof value === 'bigint') return String(value);
}

async function nativeString(value: unknown, objc: Objc): Promise<string | undefined> {
	const direct = stringValue(value);

	if (direct || !value || typeof value !== 'object') return direct;

	try {
		if (!objc.respondsTo(value, 'description')) return;

		return stringValue(await objc.invokeAsync(value, 'description', []));
	} catch {
		return;
	}
}

async function readMessageId(cell: Cell, objc: Objc): Promise<string | undefined> {
	try {
		const viewModel = objc.getIvar(cell, 'viewModel');

		if (!viewModel || !objc.respondsTo(viewModel, 'message')) return;

		const [message, id] = await objc.batch([
			{ target: viewModel, selector: 'message', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'id', args: [] },
		]);

		if (!message) return;

		return nativeString(id, objc);
	} catch {
		return;
	}
}

function cellKey(cell: Cell, objc: Objc): string | undefined {
	try {
		const hash = objc.call(cell, 'hash');
		let identity: string | undefined;

		if (typeof hash === 'number' || typeof hash === 'bigint' || typeof hash === 'string') {
			identity = String(hash);
		} else if (objc.respondsTo(cell, 'description')) {
			const description = objc.call(cell, 'description');

			if (typeof description === 'string' && description) identity = description;
		}

		if (identity !== undefined) return `${objc.className(cell) ?? MESSAGE_CELL}:${identity}`;
	} catch {
		return;
	}
}

function handles(value: unknown, objc: Objc): Cell[] {
	if (Array.isArray(value)) return value;

	if (!value || typeof value !== 'object') return [];

	try {
		return objc.array(value) as Cell[];
	} catch {
		return [];
	}
}

async function findVisibleCells(objc: Objc): Promise<Cell[]> {
	const UIApplication = objc.getClass('UIApplication');

	if (!UIApplication) return [];

	try {
		const [, windowList, keyWindow] = await objc.batch([
			{ target: UIApplication, selector: 'sharedApplication', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'windows', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
		]);
		const windows = handles(windowList, objc);

		if (keyWindow) windows.push(keyWindow);

		const cells: Cell[] = [];

		for (const window of windows) {
			try {
				const found = await objc.findViews(window, MESSAGE_CELL, {
					maxDepth: 64,
					maxVisited: 4096,
					maxResults: 256,
					attachedOnly: true,
					stopAtMatch: true,
				});

				cells.push(...found);
			} catch {
				// A window can go away while the scan runs.
			}
		}

		return cells;
	} catch {
		return [];
	}
}

/**
 * @description Paints selected messages with the same translucent cell background Discord's own
 * long-press uses. Visible cells are remembered as they appear, so a selection change only repaints
 * those rows instead of rescanning the whole native tree.
 * @param context The plugin context, which carries the native bridge.
 * @returns A cleanup that removes the hooks and clears the painted cells.
 */
export function startNativeHighlight(context: PluginContext | undefined): (() => void) | undefined {
	const objc = context?.native?.objc;

	if (!objc) return;

	const cells = new Map<string, Cell>();
	const state = new Map<string, CellState>();
	const hooks: { remove: () => void }[] = [];
	let highlight: Cell | undefined;
	let clear: Cell | undefined;
	let disposed = false;
	let lastScanAt = 0;
	let touchStartedAt = 0;
	let touchCellKey: string | undefined;
	let touchMoved = false;

	try {
		const UIColor = objc.getClass('UIColor');

		if (!UIColor) return;

		// A translucent gray that reads as a highlight on both dark and light themes.
		highlight = objc.call(UIColor, 'colorWithWhite:alpha:', 0.5, 0.18);
		clear = objc.call(UIColor, 'clearColor');
	} catch (error) {
		logger.warn('Could not create the highlight colors:', error);

		return;
	}

	function remember(cell: Cell): string | undefined {
		const key = cellKey(cell, objc);

		if (key !== undefined) cells.set(key, cell);

		return key;
	}

	function forget(cell: Cell): string | undefined {
		const key = cellKey(cell, objc);

		if (key !== undefined) {
			cells.delete(key);
			state.delete(key);
		}

		return key;
	}

	async function paint(cell: Cell): Promise<void> {
		if (disposed || !highlight || !clear) return;

		const key = remember(cell);

		if (key === undefined) return;

		let cached = state.get(key);

		if (!cached) {
			const messageId = await readMessageId(cell, objc);

			// A cell can be mid-reuse; don't remember a failed read forever.
			if (messageId === undefined) {
				state.delete(key);

				return;
			}

			cached = { messageId };
			state.set(key, cached);
		}

		const selected = isSelected(cached.messageId);

		if (selected) {
			await objc.invokeAsync(cell, 'setBackgroundColor:', [highlight]);
			cached.applied = true;
		} else if (cached.applied) {
			await objc.invokeAsync(cell, 'setBackgroundColor:', [clear]);
			cached.applied = false;
		}
	}

	/**
	 * @description Repaints the rows already known to the plugin. The first call in a session walks
	 * the native tree once to seed that list; every later selection change is a short loop.
	 */
	function hasSelectedCell(): boolean {
		for (const [key] of cells) {
			const cached = state.get(key);

			if (cached?.messageId && isSelected(cached.messageId)) return true;
		}

		return false;
	}

	async function seed(): Promise<void> {
		const now = Date.now();

		// A scan walks the native tree, so keep it off the hot path and retry at most once a second.
		if (now - lastScanAt < 800) return;

		lastScanAt = now;

		try {
			const found = await findVisibleCells(objc);

			for (const cell of found) remember(cell);
		} catch {
			// The app may be moving between screens while the scan runs.
		}
	}

	async function refresh(): Promise<void> {
		if (disposed) return;

		// Rescan when no cell is known at all, or when the rows for the current selection
		// haven't been seen yet (for example after the chat was opened later or scrolled).
		if (!cells.size || (count() > 0 && !hasSelectedCell())) await seed();

		for (const cell of cells.values()) {
			await paint(cell).catch(() => undefined);
		}
	}

	function reset(cell: Cell): void {
		forget(cell);

		if (clear) {
			void objc
				.invokeAsync(cell, 'setBackgroundColor:', [clear])
				.catch(() => undefined);
		}
	}

	async function handleNativeTap(cell: Cell): Promise<void> {
		const channelId = SelectedChannelStore?.getChannelId?.();
		const messageId = await readMessageId(cell, objc);

		if (!channelId || !messageId) return;

		const message = messageFromEvent({ messageId, channelId });

		if (!message) return;

		markSkippedTap(messageId);

		const result = handleMessageTap(message);

		if (result.kind === 'blocked') {
			showSelectionWarning(
				'Cannot delete this message',
				"It isn't yours and you don't have Manage Messages in this channel.",
			);

			return;
		}

		if (result.kind === 'range') {
			if (result.wrongChannel) {
				showSelectionWarning('Range selection', 'Pick the last message in the same channel.');
			} else if (result.skipped > 0) {
				showSelectionWarning(
					'Range selection',
					`Skipped ${result.skipped} message${result.skipped === 1 ? '' : 's'} you can't delete.`,
				);
			}
		}

		refreshSelectionToast();
	}

	try {
		const options = {
			coalesce: 'receiver' as const,
			payload: { receiver: true as const, arguments: [] },
		};

		hooks.push(
			objc.hook(
				MESSAGE_CELL,
				'didMoveToWindow',
				{
					after: ({ self }: { self?: Cell }) => {
						if (self) {
							remember(self);
							void paint(self).catch(() => undefined);
						}
					},
				},
				options,
			),
			objc.hook(
				MESSAGE_CELL,
				'layoutSubviews',
				{
					after: ({ self }: { self?: Cell }) => {
						if (self) void paint(self).catch(() => undefined);
					},
				},
				options,
			),
			objc.hook(MESSAGE_CELL, 'prepareForReuse', {
				after: ({ self }: { self?: Cell }) => {
					if (self) reset(self);
				},
			}),
			objc.hook(
				MESSAGE_CELL,
				'touchesBegan:withEvent:',
				{
					after: ({ self }: { self?: Cell }) => {
						if (!self || !isSelecting()) return;

						touchStartedAt = Date.now();
						touchCellKey = cellKey(self, objc);
						touchMoved = false;
					},
				},
				options,
			),
			objc.hook(
				MESSAGE_CELL,
				'touchesMoved:withEvent:',
				{
					after: () => {
						if (isSelecting()) touchMoved = true;
					},
				},
				options,
			),
			objc.hook(
				MESSAGE_CELL,
				'touchesCancelled:withEvent:',
				{
					after: () => {
						touchMoved = true;
					},
				},
				options,
			),
			objc.hook(
				MESSAGE_CELL,
				'touchesEnded:withEvent:',
				{
					after: ({ self }: { self?: Cell }) => {
						if (!self || !isSelecting() || touchMoved) return;

						if (Date.now() - touchStartedAt > 350) return;
						if (cellKey(self, objc) !== touchCellKey) return;

						touchCellKey = undefined;

						void handleNativeTap(self).catch(() => undefined);
					},
				},
				options,
			),
		);
	} catch (error) {
		logger.warn('Could not hook iOS message cells:', error);

		for (const hook of hooks.splice(0)) {
			try {
				hook.remove();
			} catch {
				// The scope may have removed it already.
			}
		}

		return;
	}

	const unsubscribe = subscribe(() => {
		void refresh();

		// A sheet closing or the list relayouting can reset cell backgrounds after the first paint.
		setTimeout(() => void refresh(), 150);
		setTimeout(() => void refresh(), 600);
		setTimeout(() => void refresh(), 1400);
	});

	// Seed the cell list once in the background, so the first tap is already fast.
	void refresh();

	return () => {
		disposed = true;
		unsubscribe();

		for (const hook of hooks.splice(0)) {
			try {
				hook.remove();
			} catch {
				// Already removed with the plugin scope.
			}
		}

		void (async () => {
			for (const cell of cells.values()) {
				if (clear) {
					await objc
						.invokeAsync(cell, 'setBackgroundColor:', [clear])
						.catch(() => undefined);
				}
			}

			cells.clear();
			state.clear();
		})();
	};
}
