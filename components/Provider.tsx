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
        // IMPORTANT: If MSAL is still processing the redirect or logging in, 
        // stop here. This prevents the "not logged in" logic from 
        // running too early.
        if (inProgress !== InteractionStatus.None) {
            return;
        }

        const isLoggedIn = accounts.length > 0;
        const isLoginPage = pathname === "/";
        const isAuthCallback = pathname === "/auth-callback";

        if (isLoggedIn) {
            // If logged in and on a "guest" page, move to dashboard
            if (isLoginPage || isAuthCallback) {
                
                // Optional: Sync with backend before redirecting
                const account = accounts[0];
                fetch('/api/auth/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: account.username.toLowerCase(),
                        name: account.name,
                    }),
                }).then((res) => {
                    if (res.ok) {
                        router.push("/dashboard");
                    }
                });
            }
        } else {
            // Not logged in: Redirect to login if trying to access private routes
            if (!isLoginPage && !isAuthCallback) {
                router.push("/");
            }
        }
    }, [accounts, inProgress, pathname, router]); // Re-runs whenever accounts or status change

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
