"use client";

import { useEffect, useState, ReactNode } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalconfig } from "@/app/authConfig.ts";
import { useRouter, usePathname } from "next/navigation";

// Initialize outside to prevent re-renders
export const msalInstance = new PublicClientApplication(msalconfig);

function AuthHandler({ children }: { children: ReactNode }) {
    const { instance, inProgress, accounts } = useMsal();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const handleAuth = async () => {
            try {
                // If a redirect is being handled (after login)
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
                        // After successful login, send to dashboard
                        router.push('/dashboard');
                    } else {
                        const data = await syncResponse.json();
                        alert(data.error || "Unauthorized domain.");
                        instance.logoutRedirect();
                    }
                } else {
                    // Check if user is logged in for protected routes
                    const isLoginPage = pathname === "/";
                    const isAuthCallback = pathname === "/auth-callback";
                    const isLoggedIn = accounts.length > 0;

                    // If on login page and already logged in, send to dashboard
                    if (isLoginPage && isLoggedIn) {
                        router.push("/dashboard");
                        return;
                    }

                    // Protect non-login pages
                    if (!isLoggedIn && !isLoginPage && !isAuthCallback) {
                        router.push("/");
                    }
                }
            } catch (error) {
                console.error("MSAL Redirect Error:", error);
            }
        };

        if (inProgress === "none") {
            handleAuth();
        }
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
