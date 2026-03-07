import * as Linking from "expo-linking";
import * as React from "react";
import { Platform } from "react-native";

/**
 * Resolves the current auth deep-link URL across web and native entry paths.
 * Expects: used from a React component; native callers may see pending=true before getInitialURL resolves.
 */
export function useAuthLinkUrl(): {
    url: string | null;
    pending: boolean;
} {
    const incomingLinkUrl = Linking.useURL();
    const [initialLinkUrl, setInitialLinkUrl] = React.useState<string | null | undefined>(undefined);

    React.useEffect(() => {
        if (Platform.OS === "web") {
            return;
        }

        let isMounted = true;
        void Linking.getInitialURL().then((url) => {
            if (!isMounted) {
                return;
            }
            setInitialLinkUrl(url ?? null);
        });
        return () => {
            isMounted = false;
        };
    }, []);

    const url = React.useMemo(() => {
        if (Platform.OS === "web") {
            if (typeof window === "undefined") {
                return null;
            }
            return window.location.href;
        }
        return incomingLinkUrl ?? initialLinkUrl ?? null;
    }, [incomingLinkUrl, initialLinkUrl]);

    return {
        url,
        pending: Platform.OS !== "web" && initialLinkUrl === undefined && !incomingLinkUrl
    };
}
