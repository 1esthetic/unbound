import { metro } from '@unbound-app/api';

type RenderFunction = (...args: never[]) => unknown;

type ComponentObject = {
	displayName?: string;
	name?: string;
	type?: RenderFunction;
	render?: RenderFunction;
};

type ElementProps = {
	children?: unknown;
	hasIcons?: unknown;
	label?: unknown;
	onPress?: unknown;
};

export type ElementNode = {
	key?: unknown;
	type?: string | RenderFunction | ComponentObject;
	props?: ElementProps;
};

const MAX_DEPTH = 15;

export function isElementNode(value: unknown): value is ElementNode {
	return typeof value === 'object' && value !== null;
}

export function getElementName(element: ElementNode): string | undefined {
	const { type } = element;

	if (typeof type === 'string') return type;

	if (typeof type === 'function') return type.displayName ?? type.name;

	return (
		type?.displayName ??
		type?.name ??
		type?.render?.displayName ??
		type?.render?.name ??
		type?.type?.displayName ??
		type?.type?.name
	);
}

export function findElement(
	node: unknown,
	predicate: (element: ElementNode) => boolean,
	depth: number = 0,
): ElementNode | undefined {
	if (depth > MAX_DEPTH || !isElementNode(node)) return;

	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findElement(child, predicate, depth + 1);

			if (match) return match;
		}

		return;
	}

	if (predicate(node)) return node;

	return findElement(node.props?.children, predicate, depth + 1);
}

function isRow(value: unknown): value is ElementNode {
	if (!isElementNode(value) || !isElementNode(value.props) || Array.isArray(value.props)) {
		return false;
	}

	return typeof value.props.label === 'string' && typeof value.props.onPress === 'function';
}

export function isActionSheetRowGroup(value: unknown): value is ElementNode {
	if (!isElementNode(value) || Array.isArray(value)) return false;

	if (getElementName(value) === 'ActionSheetRowGroup') return true;

	const children = value.props?.children;

	if (typeof value.props?.hasIcons !== 'boolean' || !Array.isArray(children)) return false;

	return children.length > 0 && children.every(isRow);
}

export function getActionSheetRow() {
	return metro.components.BottomSheets.ActionSheetRow;
}
