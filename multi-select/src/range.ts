import { MessageStore } from './modules';
import {
	addMany,
	canDelete,
	clearRange,
	getRangeStart,
	toSelected,
	toggle,
	type SelectedMessage,
} from './selection';

export type TapResult =
	| { kind: 'toggle' }
	| { kind: 'blocked' }
	| { kind: 'range'; added: number; skipped: number; wrongChannel: boolean };

type MessageRecord = Record<string, any>;

function recordsOf(channelId: string): MessageRecord[] {
	const collection = MessageStore?.getMessages?.(channelId);

	if (!collection) return [];

	if (Array.isArray(collection)) return collection;
	if (typeof collection.toArray === 'function') return collection.toArray();
	if (Array.isArray(collection._array)) return collection._array;

	return [];
}

/**
 * @description Selects every message between the pending range start and the tapped end,
 * including both. Messages the account cannot delete are counted but left out.
 * @param end The message that closes the range.
 * @returns How many messages were added and skipped, and whether the end was in another channel.
 */
export function completeRange(end: SelectedMessage): {
	added: number;
	skipped: number;
	wrongChannel: boolean;
} {
	const start = getRangeStart();

	clearRange();

	if (!start) return { added: 0, skipped: 0, wrongChannel: false };
	if (start.channelId !== end.channelId) {
		return { added: 0, skipped: 0, wrongChannel: true };
	}

	const records = recordsOf(start.channelId);
	const startIndex = records.findIndex((record) => String(record.id) === start.id);
	const endIndex = records.findIndex((record) => String(record.id) === end.id);

	let recordsInRange: MessageRecord[];

	if (startIndex === -1 || endIndex === -1) {
		recordsInRange = [start, end];
	} else {
		const from = Math.min(startIndex, endIndex);
		const to = Math.max(startIndex, endIndex);

		recordsInRange = records.slice(from, to + 1);
	}

	const messages = recordsInRange
		.map((record) => toSelected(record, start.channelId))
		.filter((message): message is SelectedMessage => message !== null)
		.filter((message) => canDelete(message));

	return {
		added: addMany(messages),
		skipped: recordsInRange.length - messages.length,
		wrongChannel: false,
	};
}

/**
 * @description Applies a message tap: closes the pending range when there is one, otherwise
 * toggles the message if the account may delete it.
 * @param message The tapped message.
 * @returns What the tap did, so the caller can show the matching feedback.
 */
export function handleMessageTap(message: SelectedMessage): TapResult {
	if (getRangeStart()) {
		return { kind: 'range', ...completeRange(message) };
	}

	if (!canDelete(message)) return { kind: 'blocked' };

	toggle(message);

	return { kind: 'toggle' };
}
