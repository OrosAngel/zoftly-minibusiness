import { useState, useEffect } from "react";

/**
 * Custom hook to handle Zustand persist hydration.
 * Prevents hydration mismatches by waiting for the client to mount.
 */
export function useHydration() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return mounted;
}
