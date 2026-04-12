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
            // Only handle auth once interaction is complete
            if (inProgress !== InteractionStatus.None) return;

            try {
                // This checks if we just arrived back from a redirect
                const response = await instance.handleRedirectPromise();

                if (response) {
                    const account = response.account;
                    const userEmail = account.username.toLowerCase().trim();

                    // Sync with backend
                    const syncResponse = await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userEmail,
                            name: account.name,
                        }),
                    });

                    if (syncResponse.ok) {
                        router.push('/dashboard');
                    } else {
                        const data = await syncResponse.json();
                        alert(data.error || "Login validation failed.");
                        instance.logoutRedirect();
                    }

                } else {
                    // No new redirect to handle. Check current session status.
                    const isLoggedIn = accounts.length > 0;
                    const isLoginPage = pathname === "/";
                    const isLoggingIn = pathname === "/login";
                    const isAuthCallback = pathname === "/auth-callback";

                    if (isLoggedIn) {
                        if (isLoginPage || isAuthCallback) {
                            router.push("/dashboard");
                        }
                    } else if (isLoggingIn) {}
                    else {
                        // Not logged in. Only allow access to login or auth callback.
                        if (!isLoginPage && !isAuthCallback) {
                            router.push("/");
                        }
                    }
                }
            } catch (error) {
                console.error("MSAL Auth Error:", error);
            }
        };

        handleAuth();
    }, [instance, inProgress, accounts, router, pathname]);

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
