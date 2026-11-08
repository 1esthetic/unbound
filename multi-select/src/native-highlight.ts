import type {
	NativeObjCBridge,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';

import { SelectedChannelStore } from './modules';
import { handleMessageTap } from './range';
import { isRangeStart, isSelected, isSelecting, messageFromEvent, subscribe } from './selection';
import { refreshSelectionToast, showSelectionWarning } from './selection-ui';

type Objc = NativeObjCBridge;
type Cell = NativeObjectHandle;

type CellState = {
	messageId?: string;
	applied?: boolean;
	readAt?: number;
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

	async function setBackground(cell: Cell, color: NativeObjectHandle): Promise<void> {
		await objc.invokeAsync(cell, 'setBackgroundColor:', [color]);
	}

	async function paint(cell: Cell, force = false): Promise<void> {
		if (disposed || !highlight || !clear) return;

		const key = remember(cell);

		if (key === undefined) return;

		let cached = state.get(key);

		// Discord reuses cells, so a remembered message id goes stale: the row itself stays the same
		// object while its message changes. Re-read it on reuse, and now and then in between.
		const stale = !cached || force || Date.now() - (cached.readAt ?? 0) > 500;

		if (stale) {
			const messageId = await readMessageId(cell, objc);

			// A cell can be mid-reuse; don't remember a failed read forever.
			if (messageId === undefined) {
				state.delete(key);

				return;
			}

			const changed = cached !== undefined && cached.messageId !== messageId;

			if (changed && cached?.applied) {
				await setBackground(cell, clear);
			}

			cached = {
				messageId,
				applied: changed ? false : cached?.applied,
				readAt: Date.now(),
			};
			state.set(key, cached);
		}

		const selected = isSelected(cached.messageId) || isRangeStart(cached.messageId);

		if (selected) {
			await setBackground(cell, highlight);
			cached.applied = true;
		} else if (cached.applied) {
			await setBackground(cell, clear);
			cached.applied = false;
		}
	}

	/**
	 * @description Repaints the rows already known to the plugin. The first call in a session walks
	 * the native tree once to seed that list; every later selection change is a short loop.
	 */
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

		// Cells are remembered as they appear, so a full native scan is only needed when nothing is
		// known yet. Scanning on every selection change is what made fast taps feel half applied.
		if (!cells.size) await seed();

		await Promise.all(
			Array.from(cells.values()).map((cell) => paint(cell).catch(() => undefined)),
		);
	}

	function reset(cell: Cell): void {
		forget(cell);

		if (clear) {
			void setBackground(cell, clear).catch(() => undefined);
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

		// Update the counter first, then paint in the background: awaiting native calls before the
		// toast made every tap feel delayed.
		refreshSelectionToast();

		void paint(cell, true).catch(() => undefined);
	}

	const options = {
		coalesce: 'receiver' as const,
		payload: { receiver: true as const, arguments: [] },
	};

	const hook = (selector: string, handlers: any) => {
		try {
			hooks.push(objc.hook(MESSAGE_CELL, selector, handlers, options));
		} catch (error) {
			// One unsupported selector must not take the rest of the hooks down with it.
			logger.warn(`Could not hook ${selector}:`, error);
		}
	};

	hook('didMoveToWindow', {
		after: ({ self }: { self?: Cell }) => {
			if (self) {
				remember(self);
				void paint(self, true).catch(() => undefined);
			}
		},
	});

	hook('layoutSubviews', {
		after: ({ self }: { self?: Cell }) => {
			if (self) void paint(self).catch(() => undefined);
		},
	});

	hook('prepareForReuse', {
		after: ({ self }: { self?: Cell }) => {
			if (self) reset(self);
		},
	});

	hook('touchesBegan:withEvent:', {
		after: ({ self }: { self?: Cell }) => {
			if (!self || !isSelecting()) return;

			touchStartedAt = Date.now();
			touchCellKey = cellKey(self, objc);
			touchMoved = false;
		},
	});

	hook('touchesMoved:withEvent:', {
		after: () => {
			if (isSelecting()) touchMoved = true;
		},
	});

	hook('touchesCancelled:withEvent:', {
		after: () => {
			touchMoved = true;
		},
	});

	hook('touchesEnded:withEvent:', {
		after: ({ self }: { self?: Cell }) => {
			if (!self || !isSelecting() || touchMoved) return;

			if (Date.now() - touchStartedAt > 350) return;
			if (cellKey(self, objc) !== touchCellKey) return;

			touchCellKey = undefined;

			void handleNativeTap(self).catch(() => undefined);
		},
	});

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
					await setBackground(cell, clear).catch(() => undefined);
				}
			}

			cells.clear();
			state.clear();
		})();
	};
}
