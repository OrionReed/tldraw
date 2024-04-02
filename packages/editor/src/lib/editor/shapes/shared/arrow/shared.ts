import {
	TLArrowBinding,
	TLArrowBindingProps,
	TLArrowShape,
	TLShape,
	TLShapeId,
} from '@tldraw/tlschema'
import { Mat } from '../../../../primitives/Mat'
import { Vec } from '../../../../primitives/Vec'
import { Group2d } from '../../../../primitives/geometry/Group2d'
import { Editor } from '../../../Editor'

export function getIsArrowStraight(shape: TLArrowShape) {
	return Math.abs(shape.props.bend) < 8 // snap to +-8px
}

export type BoundShapeInfo<T extends TLShape = TLShape> = {
	shape: T
	didIntersect: boolean
	isExact: boolean
	isClosed: boolean
	transform: Mat
	outline: Vec[]
}

export function getBoundShapeInfoForTerminal(
	editor: Editor,
	arrow: TLArrowShape,
	terminalName: 'start' | 'end'
): BoundShapeInfo | undefined {
	const binding = editor
		.getBindingsFromShape<TLArrowBinding>(arrow, 'arrow')
		.find((b) => b.props.terminal === terminalName)
	if (!binding) return

	const boundShape = editor.getShape(binding.toId)!
	const transform = editor.getShapePageTransform(boundShape)!
	const geometry = editor.getShapeGeometry(boundShape)

	// This is hacky: we're only looking at the first child in the group. Really the arrow should
	// consider all items in the group which are marked as snappable as separate polygons with which
	// to intersect, in the case of a group that has multiple children which do not overlap; or else
	// flatten the geometry into a set of polygons and intersect with that.
	const outline = geometry instanceof Group2d ? geometry.children[0].vertices : geometry.vertices

	return {
		shape: boundShape,
		transform,
		isClosed: geometry.isClosed,
		isExact: binding.props.isExact,
		didIntersect: false,
		outline,
	}
}

function getArrowTerminalInArrowSpace(
	editor: Editor,
	arrowPageTransform: Mat,
	binding: TLArrowBinding,
	forceImprecise: boolean
) {
	const boundShape = editor.getShape(binding.toId)

	if (!boundShape) {
		// this can happen in multiplayer contexts where the shape is being deleted
		return new Vec(0, 0)
	} else {
		// Find the actual local point of the normalized terminal on
		// the bound shape and transform it to page space, then transform
		// it to arrow space
		const { point, size } = editor.getShapeGeometry(boundShape).bounds
		const shapePoint = Vec.Add(
			point,
			Vec.MulV(
				// if the parent is the bound shape, then it's ALWAYS precise
				binding.props.isPrecise || forceImprecise
					? binding.props.normalizedAnchor
					: { x: 0.5, y: 0.5 },
				size
			)
		)
		const pagePoint = Mat.applyToPoint(editor.getShapePageTransform(boundShape)!, shapePoint)
		const arrowPoint = Mat.applyToPoint(Mat.Inverse(arrowPageTransform), pagePoint)
		return arrowPoint
	}
}

/** @internal */
export function getArrowBindings(editor: Editor, shape: TLArrowShape) {
	const bindings = editor.getBindingsFromShape<TLArrowBinding>(shape, 'arrow')
	return {
		start: bindings.find((b) => b.props.terminal === 'start'),
		end: bindings.find((b) => b.props.terminal === 'end'),
	}
}

/** @public */
export function getArrowTerminalsInArrowSpace(editor: Editor, shape: TLArrowShape) {
	const arrowPageTransform = editor.getShapePageTransform(shape)!

	const bindings = getArrowBindings(editor, shape)

	const boundShapeRelationships = getBoundShapeRelationships(
		editor,
		bindings.start?.toId,
		bindings.end?.toId
	)

	const start = bindings.start
		? getArrowTerminalInArrowSpace(
				editor,
				arrowPageTransform,
				bindings.start,
				boundShapeRelationships === 'double-bound' ||
					boundShapeRelationships === 'start-contains-end'
			)
		: Vec.From(shape.props.start)

	const end = bindings.end
		? getArrowTerminalInArrowSpace(
				editor,
				arrowPageTransform,
				bindings.end,
				boundShapeRelationships === 'double-bound' ||
					boundShapeRelationships === 'end-contains-start'
			)
		: Vec.From(shape.props.end)

	return { start, end }
}

/** @internal */
export function ensureArrowBinding(
	editor: Editor,
	arrow: TLArrowShape | TLShapeId,
	target: TLShape | TLShapeId,
	props: TLArrowBindingProps
) {
	const arrowId = typeof arrow === 'string' ? arrow : arrow.id
	const targetId = typeof target === 'string' ? target : target.id

	const existing = editor
		.getBindingsFromShape<TLArrowBinding>(arrowId, 'arrow')
		.find((b) => b.props.terminal === props.terminal)
	if (existing) {
		editor.updateBinding({
			...existing,
			toId: targetId,
			props,
		})
	} else {
		editor.createBinding({
			type: 'arrow',
			fromId: arrowId,
			toId: targetId,
			props,
		})
	}
}

/** @internal */
export function ensureNoArrowBinding(
	editor: Editor,
	arrow: TLArrowShape,
	terminal: 'start' | 'end'
) {
	const existing = editor
		.getBindingsFromShape<TLArrowBinding>(arrow, 'arrow')
		.find((b) => b.props.terminal === terminal)
	if (existing) {
		editor.deleteBinding(existing.id)
	}
}

/** @internal */
export const MIN_ARROW_LENGTH = 10
/** @internal */
export const BOUND_ARROW_OFFSET = 10
/** @internal */
export const WAY_TOO_BIG_ARROW_BEND_FACTOR = 10

/** @public */
export const STROKE_SIZES: Record<string, number> = {
	s: 2,
	m: 3.5,
	l: 5,
	xl: 10,
}

/**
 * Get the relationships for an arrow that has two bound shape terminals.
 * If the arrow has only one bound shape, then it is always "safe" to apply
 * standard offsets and precision behavior. If the shape is bound to the same
 * shape on both ends, then that is an exception. If one of the shape's
 * terminals is bound to a shape that contains / is contained by the shape that
 * is bound to the other terminal, then that is also an exception.
 *
 * @param editor - the editor instance
 * @param startShapeId - the bound shape from the arrow's start
 * @param endShapeId - the bound shape from the arrow's end
 *
 *  @internal */
export function getBoundShapeRelationships(
	editor: Editor,
	startShapeId?: TLShapeId,
	endShapeId?: TLShapeId
) {
	if (!startShapeId || !endShapeId) return 'safe'
	if (startShapeId === endShapeId) return 'double-bound'
	const startBounds = editor.getShapePageBounds(startShapeId)
	const endBounds = editor.getShapePageBounds(endShapeId)
	if (startBounds && endBounds) {
		if (startBounds.contains(endBounds)) return 'start-contains-end'
		if (endBounds.contains(startBounds)) return 'end-contains-start'
	}
	return 'safe'
}
