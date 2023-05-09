import { hardReset, Tldraw } from '@tldraw/tldraw'
/* eslint-disable import/no-internal-modules */
import '@tldraw/tldraw/editor.css'
import '@tldraw/tldraw/ui.css'
/* eslint-enable import/no-internal-modules */
import { getBundlerAssetUrls } from '@tldraw/assets'
import { useEffect, useState } from 'react'

declare global {
	interface Window {
		webdriverReset: () => void
	}
}

const assetUrls = getBundlerAssetUrls()

export default function Example() {
	const [instanceKey, setInstanceKey] = useState(0)

	useEffect(() => {
		window.webdriverReset = () => {
			hardReset({ shouldReload: false })
			setInstanceKey(instanceKey + 1)
		}
	}, [instanceKey])

	return (
		<div className="tldraw__editor">
			<Tldraw key={instanceKey} autoFocus assetUrls={assetUrls} />
		</div>
	)
}