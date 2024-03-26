import {
	BaseRecord,
	createMigrationIds,
	createRecordMigrations,
	createRecordType,
	RecordId,
} from '@tldraw/store'
import { JsonObject } from '@tldraw/utils'
import { T } from '@tldraw/validate'

/**
 * TLDocument
 *
 * @public
 */
export interface TLDocument extends BaseRecord<'document', RecordId<TLDocument>> {
	gridSize: number
	name: string
	meta: JsonObject
}

/** @internal */
export const documentValidator: T.Validator<TLDocument> = T.model(
	'document',
	T.object({
		typeName: T.literal('document'),
		id: T.literal('document:document' as RecordId<TLDocument>),
		gridSize: T.number,
		name: T.string,
		meta: T.jsonValue as T.ObjectValidator<JsonObject>,
	})
)

/** @internal */
export const documentVersions = createMigrationIds('com.tldraw.document', {
	AddName: 1,
	AddMeta: 2,
} as const)

/** @internal */
export const documentMigrations = createRecordMigrations({
	recordType: 'document',
	sequence: [
		{
			id: documentVersions.AddName,
			up: (document) => {
				;(document as any).name = ''
			},
			down: (document) => {
				delete (document as any).name
			},
		},
		{
			id: documentVersions.AddMeta,
			up: (record) => {
				;(record as any).meta = {}
			},
		},
	],
})

/** @public */
export const DocumentRecordType = createRecordType<TLDocument>('document', {
	validator: documentValidator,
	scope: 'document',
}).withDefaultProperties(
	(): Omit<TLDocument, 'id' | 'typeName'> => ({
		gridSize: 10,
		name: '',
		meta: {},
	})
)

// all document records have the same ID: 'document:document'
/** @public */
export const TLDOCUMENT_ID: RecordId<TLDocument> = DocumentRecordType.createId('document')
