import {
	ChannelStore,
	Constants,
	MessageStore,
	PermissionStore,
	SelectedChannelStore,
	UserStore,
} from './modules';

export type SelectedMessage = {
	id: string;
	channelId: string;
	authorId: string;
	preview: string;
};

const selected = new Map<string, SelectedMessage>();
const listeners = new Set<() => void>();
let selecting = false;
let rangeStart: SelectedMessage | null = null;

function notify() {
	for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
	listeners.add(listener);

	return () => listeners.delete(listener);
}

export function getSelected(): SelectedMessage[] {
	return Array.from(selected.values());
}

export function count(): number {
	return selected.size;
}

export function isSelected(messageId: string): boolean {
	return selected.has(messageId);
}

/** Whether tapping a message toggles it instead of opening or focusing it. */
export function isSelecting(): boolean {
	return selecting;
}

export function setSelecting(value: boolean): void {
	selecting = value;
	notify();
}

export function clear(): void {
	if (!selected.size) return;

	selected.clear();
	notify();
}

export function toggle(message: SelectedMessage): 'added' | 'removed' {
	if (selected.has(message.id)) {
		selected.delete(message.id);
		notify();

		return 'removed';
	}

	selected.set(message.id, message);
	notify();

	return 'added';
}

/** Adds every message that is not selected yet, notifying once. */
export function addMany(messages: readonly SelectedMessage[]): number {
	let added = 0;

	for (const message of messages) {
		if (selected.has(message.id)) continue;

		selected.set(message.id, message);
		added += 1;
	}

	if (added) notify();

	return added;
}

/** The message a range starts at, while the user is choosing its other end. */
export function getRangeStart(): SelectedMessage | null {
	return rangeStart;
}

export function isRangePending(): boolean {
	return rangeStart !== null;
}

/** Clears the selection and waits for the user to tap the last message of a range. */
export function startRange(message: SelectedMessage): void {
	selected.clear();
	rangeStart = message;
	selecting = true;
	notify();
}

export function clearRange(): void {
	rangeStart = null;
}

/**
 * @description Turns a Discord message record into the small record the selection keeps.
 * @param message The message record.
 * @param fallbackChannelId A channel to use when the record carries none.
 * @returns The selected record, or `null` when the message or its channel is missing.
 */
export function toSelected(
	message: Record<string, any> | undefined,
	fallbackChannelId?: string,
): SelectedMessage | null {
	if (!message?.id) return null;

	const channelId = message.channel_id ?? message.channelId ?? fallbackChannelId;

	if (typeof channelId !== 'string') return null;

	return {
		id: String(message.id),
		channelId,
		authorId: String(message.author?.id ?? message.authorId ?? ''),
		preview: typeof message.content === 'string' ? message.content.slice(0, 120) : '',
	};
}

/**
 * @description Reads the message a long-press sheet is about, in the shapes Discord has used.
 * @param props The props Discord opened the sheet with.
 * @returns The message, or `null` when the sheet is not about a message.
 */
export function messageFromSheet(props: unknown): SelectedMessage | null {
	const sheet = props as { message?: Record<string, any>; channelId?: string } | undefined;
	const message = sheet?.message;

	if (!message?.id) return null;

	const channelId = message.channel_id ?? message.channelId ?? sheet?.channelId;

	if (typeof channelId !== 'string') return null;

	// The sheet's message can be a trimmed view model; the store has the author and full record.
	const stored = MessageStore?.getMessage?.(channelId, String(message.id));

	return toSelected(stored ?? message, channelId);
}

/**
 * @description Reads the message from the payload Discord's chat sends to its tap handler.
 * @param event The native tap event, which carries at least a message id.
 * @returns The message, or `null` when the id or the stored message is missing.
 */
export function messageFromEvent(event: unknown): SelectedMessage | null {
	const payload = event as Record<string, any> | undefined;
	const native = payload?.nativeEvent as Record<string, any> | undefined;
	const messageId =
		payload?.messageId ?? payload?.id ?? native?.messageId ?? native?.id;
	const channelId =
		payload?.channelId ?? native?.channelId ?? SelectedChannelStore?.getChannelId?.();

	if (messageId === undefined || typeof channelId !== 'string') return null;

	const stored = MessageStore?.getMessage?.(channelId, String(messageId));

	return toSelected(stored, channelId);
}

/**
 * @description Checks whether the current account may delete a message: its own always, another
 * author's only with Manage Messages. When the permission modules are unavailable the server is
 * left to decide, so the plugin does not block a deletion it cannot judge.
 * @param message The selected message.
 * @returns `true` when the delete may be attempted.
 */
export function canDelete(message: SelectedMessage): boolean {
	const me = UserStore?.getCurrentUser?.();

	if (!me?.id) return true;

	// An unknown author is left to the server rather than guessed at.
	if (!message.authorId) return true;

	if (message.authorId === me.id) return true;

	const permission = Constants?.Permissions?.MANAGE_MESSAGES;

	if (!permission || typeof PermissionStore?.can !== 'function') return true;

	const channel = ChannelStore?.getChannel?.(message.channelId);

	if (!channel) return true;

	try {
		return PermissionStore.can(permission, channel) === true;
	} catch {
		return true;
	}
}
