import { useEffect, useCallback } from 'react'

type KeyboardShortcut = {
    key: string
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    handler: () => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            for (const shortcut of shortcuts) {
                const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
                const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey || shortcut.meta
                const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey || shortcut.ctrl
                const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey

                // For Cmd+K / Ctrl+K style shortcuts
                if (keyMatch && (shortcut.ctrl || shortcut.meta) && (event.ctrlKey || event.metaKey)) {
                    if (!shortcut.shift || event.shiftKey) {
                        event.preventDefault()
                        shortcut.handler()
                        return
                    }
                }

                // For regular shortcuts
                if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
                    event.preventDefault()
                    shortcut.handler()
                    return
                }
            }
        },
        [shortcuts]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}

export default useKeyboardShortcuts
