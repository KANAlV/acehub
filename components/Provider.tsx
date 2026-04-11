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
    const handleAuth = async () => {
        // 1. Wait for MSAL to stop moving
        if (inProgress !== InteractionStatus.None) return;

        try {
            // 2. Process the redirect result
            const response = await instance.handleRedirectPromise();

            // 3. Get the most up-to-date account list
            const currentAccounts = instance.getAllAccounts();
            const isLoggedIn = currentAccounts.length > 0;
            const isLoginPage = pathname === "/";
            const isAuthCallback = pathname === "/auth-callback";

            if (response) {
                // We JUST returned from Microsoft
                const userEmail = response.account.username.toLowerCase().trim();

                const syncResponse = await fetch('/api/auth/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: userEmail,
                        name: response.account.name,
                    }),
                });

                if (syncResponse.ok) {
                    router.replace('/dashboard'); // Use replace to clean up history
                } else {
                    instance.logoutRedirect();
                }
            } else if (isLoggedIn) {
                // We are logged in but sitting on a login/callback page
                if (isLoginPage || isAuthCallback) {
                    router.replace("/dashboard");
                }
            } else {
                // Not logged in and trying to access protected route
                if (!isLoginPage && !isAuthCallback) {
                    router.replace("/");
                }
            }
        } catch (error) {
            console.error("MSAL Auth Error:", error);
        }
    };

    handleAuth();
}, [instance, inProgress, pathname, router]); // Removed 'accounts' to rely on instance.getAllAccounts()

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
