"use client";

import { useEffect, useState, ReactNode } from "react";
import { PublicClientApplication, InteractionStatus } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalconfig } from "@/app/authConfig.ts";
import { useRouter, usePathname } from "next/navigation";

export const msalInstance = new PublicClientApplication(msalconfig);

function AuthHandler({ children }: { children: ReactNode }) {
    const { instance, inProgress, accounts } = useMsal();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // 1. Wait until MSAL has finished all background work (including redirects)
        if (inProgress !== InteractionStatus.None) return;

        const isLoggedIn = accounts.length > 0;
        const isLoginPage = pathname === "/";
        const isAuthCallback = pathname === "/auth-callback";

        const checkAuth = async () => {
            if (isLoggedIn) {
                // If we are on a login or callback page but have an account, sync & move
                if (isLoginPage || isAuthCallback) {
                    const account = accounts[0];
                    
                    try {
                        const syncResponse = await fetch('/api/auth/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: account.username.toLowerCase().trim(),
                                name: account.name,
                            }),
                        });

                        if (syncResponse.ok) {
                            router.replace('/dashboard');
                        }
                    } catch (error) {
                        console.error("Backend Sync Failed:", error);
                    }
                }
            } else {
                // If NOT logged in and trying to access internal pages, kick to home
                if (!isLoginPage && !isAuthCallback) {
                    router.replace("/");
                }
            }
        };

        checkAuth();
    }, [inProgress, accounts, pathname, router, instance]);

    return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        msalInstance.initialize().then(() => {
            setInitialized(true);
        });
    }, []);

    if (!initialized) return null;

    return (
        <MsalProvider instance={msalInstance}>
            <AuthHandler>{children}</AuthHandler>
        </MsalProvider>
    );
}
