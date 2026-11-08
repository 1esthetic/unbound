import { metro } from '@unbound-app/api';

export const { ActionSheets } = metro.api;
export const { Constants } = metro.common;

/**
 * The runtime exposes stores through `unbound.flux`. Older SDK builds read them with
 * `metro.findStore`, so both paths are kept for compatibility.
 */
const runtime = (globalThis as any).unbound;
const flux = runtime?.flux;
const findStore = (name: string) =>
	flux?.getStore?.(name) ?? (metro as any).findStore?.(name);

export const ChannelStore = findStore('Channel');
export const MessageStore = findStore('Message');
export const SelectedChannelStore = findStore('SelectedChannel');
export const UserStore = findStore('User');
export const PermissionStore = findStore('Permission');

/**
 * The chat screen receives Discord's single-tap and long-press message handlers as props.
 * Patching it lets selection mode intercept taps before Discord handles them.
 */
export const Chat = metro.findByFilePath('modules/chat/native/Chat.ios.tsx');

/**
 * Discord has moved message actions between modules across builds, so the delete call is resolved
 * lazily and from a couple of candidates instead of being read at module scope.
 */
export function getDeleteMessage():
	| ((channelId: string, messageId: string) => Promise<unknown>)
	| undefined {
	const candidates = [metro.api.Messages, metro.findByProps('deleteMessage')];

	for (const candidate of candidates) {
		const deleteMessage = candidate?.deleteMessage;

		if (typeof deleteMessage === 'function') {
			return deleteMessage.bind(candidate);
		}
	}

	return undefined;
}
