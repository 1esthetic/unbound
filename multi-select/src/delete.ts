import { dialogs, toasts } from '@unbound-app/api';

import { getDeleteMessage } from './modules';
import { clear, getSelected, setSelecting } from './selection';
import { refreshSelectionToast } from './selection-ui';

type DeleteFailure = {
	id: string;
	channelId: string;
	status?: number;
	code?: number;
	message: string;
};

const failures: DeleteFailure[] = [];

/** The last run's failures, so the reason each message stayed can be read on the device. */
export function getDeleteErrors(): DeleteFailure[] {
	return failures.slice();
}

function showToast(options: any) {
	const api = toasts as any;
	const show = api.show ?? api.showToast;

	return show.call(toasts, options);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(error: any): number | undefined {
	const value =
		error?.status ?? error?.statusCode ?? error?.code ?? error?.body?.code;

	return typeof value === 'number' ? value : undefined;
}

async function deleteOne(
	deleteMessage: (channelId: string, messageId: string) => Promise<unknown>,
	item: { channelId: string; id: string },
): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			await deleteMessage(item.channelId, item.id);

			return;
		} catch (error) {
			const status = errorStatus(error);

			if ((status === 429 || status === 502 || status === 503) && attempt < 4) {
				const retryAfter =
					(error as any)?.retryAfter ??
					(error as any)?.retry_after ??
					(error as any)?.body?.retry_after ??
					1;
				const wait = Math.min(10, Math.max(1, Number(retryAfter))) * 1000;

				await sleep(wait);
				continue;
			}

			throw error;
		}
	}
}

/**
 * @description Asks for confirmation and deletes every selected message one by one. The progress
 * toast is updated after each call, and failures are counted instead of aborting the rest.
 */
export async function confirmAndDelete(): Promise<void> {
	const items = getSelected();

	if (!items.length) return;

	const deleteMessage = getDeleteMessage();

	if (!deleteMessage) {
		showToast({
			title: 'Multi Select',
			content: 'Could not find the message delete action in this Discord version.',
			duration: 6000,
		});

		return;
	}

	const title = `Delete ${items.length} message${items.length === 1 ? '' : 's'}?`;
	const confirm = dialogs.confirm as any;
	const confirmed =
		confirm.length >= 2
			? await confirm(title, {
					body: 'This cannot be undone.',
					confirm: 'Delete',
					cancel: 'Cancel',
					destructive: true,
				})
			: await confirm({
					title,
					body: 'This cannot be undone.',
					confirmLabel: 'Delete',
					cancelLabel: 'Cancel',
					destructive: true,
				});

	if (!confirmed) {
		refreshSelectionToast();

		return;
	}

	failures.length = 0;

	const progress = showToast({
		title: 'Deleting messages…',
		content: `0/${items.length}`,
		duration: 0,
	});

	let deleted = 0;

	for (const item of items) {
		try {
			await deleteOne(deleteMessage, item);
			deleted += 1;
		} catch (error: any) {
			failures.push({
				id: item.id,
				channelId: item.channelId,
				status: errorStatus(error),
				code: typeof error?.code === 'number' ? error.code : undefined,
				message: String(error?.message ?? error),
			});

			logger.warn(`Could not delete message ${item.id}:`, error);
		}

		progress.update({ content: `${deleted + failures.length}/${items.length}` });

		// A short gap keeps Discord's delete rate limit from rejecting larger selections.
		if (deleted + failures.length < items.length) await sleep(250);
	}

	setSelecting(false);
	clear();
	refreshSelectionToast();

	progress.close();

	if (failures.length) {
		showToast({
			title: 'Some messages were not deleted',
			content: `Deleted: ${deleted}. Failed: ${failures.length}.`,
			duration: 3000,
		});
	} else {
		showToast({
			title: 'Done',
			content: `Deleted: ${deleted}.`,
			duration: 3000,
		});
	}
}
