type RenderFunction = (...args: never[]) => unknown;

type RenderTarget = {
	holder: Record<string, any>;
	key: string;
};

/**
 * @description Finds the function behind a component export, unwrapping memo and forwardRef wrappers.
 * @param owner The module or element that holds the component.
 * @param key The property holding it, `default` for a module export.
 * @returns The object and key to patch, or `null` when there is no render function.
 */
export function findRenderTarget(owner: Record<string, any>, key: string = 'default'): RenderTarget | null {
	let holder = owner;
	let prop = key;
	let current = owner[key];

	while (current && typeof current === 'object') {
		const next = current.type ? 'type' : current.render ? 'render' : null;

		if (!next) break;

		holder = current;
		prop = next;
		current = current[next];
	}

	return typeof current === 'function' ? { holder, key: prop } : null;
}

export type { RenderFunction };
