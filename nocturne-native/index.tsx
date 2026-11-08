import type { PluginContext } from '@unbound-app/api/native';

type Objc = NonNullable<PluginContext['native']>['objc'];
type Hook = { remove(): void };

/** The theme's chat colour, used behind the native swipe indicator. */
const CHAT = [0x12, 0x12, 0x12] as const;
/** The theme's accent, used for the reply circle. */
const ACCENT = [0x7d, 0x75, 0x69] as const;

let hook: Hook | undefined;

function uiColor(objc: Objc, [r, g, b]: readonly [number, number, number]) {
	return objc.call(objc.getClass('UIColor'), 'colorWithRed:green:blue:alpha:', r / 255, g / 255, b / 255, 1);
}

function isBlue(description: unknown): boolean {
	if (typeof description !== 'string') return false;

	const match = description.match(/([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/);

	if (!match) return false;

	const [r, g, b] = match.slice(1, 4).map(Number);

	return b > r + 0.15 && b > g + 0.1;
}

function underSwipe(objc: Objc, view: unknown): boolean {
	let current = objc.call(view as never, 'superview');

	for (let depth = 0; depth < 6 && current; depth++) {
		if (objc.className(current as never) === 'DCDSwipeToReplyView') return true;

		current = objc.call(current as never, 'superview');
	}

	return false;
}

/** Only paint while Nocturne is the applied theme, so another theme or light mode stays Discord's. */
function nocturneApplied(): boolean {
	const themes = (globalThis as any).unbound?.themes;

	return !themes || themes.isEnabled('tunya.nocturne');
}

/**
 * @description Swaps Discord's blurple swipe background for the theme colours. Discord draws the
 * swipe indicator natively, so themes cannot recolour it; this catches the colour before it is set.
 */
export function start(context?: PluginContext) {
	const objc = context?.native?.objc;

	if (!objc?.hook) {
		logger.warn('No native bridge; the swipe indicator keeps Discord’s colours.');

		return;
	}

	const chat = uiColor(objc, CHAT);
	const accent = uiColor(objc, ACCENT);

	hook = objc.hook('UIView', 'setBackgroundColor:', {
		before: (ctx) => {
			try {
				if (!nocturneApplied()) return;

				const color = ctx.args[0];

				if (!color) return;

				if (objc.className(ctx.self) === 'DCDSwipeToReplyView') {
					ctx.replaceObjectArgument(0, chat);

					return;
				}

				const description = objc.call(color as never, 'description');

				if (isBlue(description) && underSwipe(objc, ctx.self)) {
					ctx.replaceObjectArgument(0, accent);
				}
			} catch (error) {
				logger.warn('Could not recolour the swipe background:', error);
			}
		},
	});
}

export function stop() {
	hook?.remove();
	hook = undefined;
}
