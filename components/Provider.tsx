"use client";

import { useEffect, useState, ReactNode } from "react";
import { PublicClientApplication, AuthenticationResult } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalconfig } from "@/authConfig";
import { useRouter } from "next/navigation";

// Initialize outside to prevent re-renders
export const msalInstance = new PublicClientApplication(msalconfig);

function AuthHandler({ children }: { children: ReactNode }) {
    const { instance, inProgress } = useMsal();
    const router = useRouter();

    useEffect(() => {
        // This runs automatically when the user is redirected back from Microsoft
        const handleAuth = async () => {
            try {
                const response = await instance.handleRedirectPromise();

                if (response) {
                    const account = response.account;
                    const userEmail = account.username.toLowerCase().trim();

                    // 1. Sync with your backend
                    const syncResponse = await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userEmail,
                            name: account.name,
                        }),
                    });

                    const data = await syncResponse.json();

                    if (syncResponse.ok) {
                        console.log("Login successful, redirecting...");
                        router.push('/rooms');
                    } else {
                        // If domain check fails or DB error
                        console.error("Auth Sync Failed:", data.error);
                        alert(data.error || "Unauthorized domain.");
                        instance.logoutRedirect();
                    }
                }
            } catch (error) {
                console.error("MSAL Redirect Error:", error);
            }
        };

        if (inProgress === "none") {
            handleAuth();
        }
    }, [instance, inProgress, router]);

    return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        msalInstance.initialize().then(() => {
            setInitialized(true);
        });
    }, []);

    if (!initialized) return null; // Or a loading spinner

    return (
        <MsalProvider instance={msalInstance}>
            <AuthHandler>{children}</AuthHandler>
        </MsalProvider>
    );
}