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
    const [isHandlingRedirect, setIsHandlingRedirect] = useState(true);

    useEffect(() => {
        const processAuth = async () => {
            if (inProgress !== InteractionStatus.None) return;

            try {
                const response = await instance.handleRedirectPromise();

                if (response) {
                    const account = response.account;
                    const userEmail = account.username.toLowerCase().trim();

                    const syncResponse = await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, name: account.name }),
                    });

                    if (syncResponse.ok) {
                        router.push('/dashboard');
                        return;
                    } else {
                        const data = await syncResponse.json();
                        alert(data.error || "Login validation failed.");
                        await instance.logoutRedirect();
                        return;
                    }
                }
                
                // Finished checking for a redirect response
                setIsHandlingRedirect(false);
            } catch (error) {
                console.error("MSAL Auth Error:", error);
                setIsHandlingRedirect(false);
            }
        };

        processAuth();
    }, [instance, inProgress, router]);

    useEffect(() => {
        // Wait for redirect processing to finish before enforcing route guards
        if (inProgress !== InteractionStatus.None || isHandlingRedirect) return;

        const isLoggedIn = accounts.length > 0;
        const isLoginPage = pathname === "/" || pathname === "/login";
        const isAuthCallback = pathname === "/auth-callback";

        if (isLoggedIn) {
            if (isLoginPage || isAuthCallback) {
                router.push("/dashboard");
            }
        } else {
            if (!isLoginPage && !isAuthCallback) {
                router.push("/");
            }
        }
    }, [inProgress, accounts, pathname, router, isHandlingRedirect]);

    return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        msalInstance.initialize().then(() => setInitialized(true));
    }, []);

    if (!initialized) return null;

    return (
        <MsalProvider instance={msalInstance}>
            <AuthHandler>{children}</AuthHandler>
        </MsalProvider>
    );
}
