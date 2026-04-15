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
                        setIsHandlingRedirect(false);
                        router.push('/dashboard');
                        return;
                    } else {
                        const data = await syncResponse.json();
                        alert(data.error || "Login validation failed.");
                        await instance.logoutRedirect();
                        return;
                    }
                }
                
                setIsHandlingRedirect(false);
            } catch (error) {
                console.error("MSAL Auth Error:", error);
                setIsHandlingRedirect(false);
            }
        };

        processAuth();
    }, [instance, inProgress, router]);

    // Emergency Timeout: If stuck, reveal the page content
    useEffect(() => {
        if (!isHandlingRedirect && inProgress === InteractionStatus.None) return;

        const timer = setTimeout(() => {
            console.warn("Auth check taking too long. Revealing page content...");
            setIsHandlingRedirect(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, [isHandlingRedirect, inProgress]);

    useEffect(() => {
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

    const isAuthPage = pathname === "/" || pathname === "/login" || pathname === "/auth-callback";

    // Only block rendering with a spinner if we are in a "waiting" state AND on an auth-related page.
    if (isHandlingRedirect || inProgress !== InteractionStatus.None) {
        if (!isAuthPage) {
            return <>{children}</>;
        }

        return (
            <div className="flex flex-col items-center justify-center w-screen h-screen bg-gray-50 dark:bg-gray-900 text-center px-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Authenticating...</p>
                <p className="mt-2 text-xs text-gray-400">If you are stuck, please refresh the page or wait.</p>
            </div>
        );
    }

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
