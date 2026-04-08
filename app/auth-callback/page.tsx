"use client";
import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";

export default function AuthCallback() {
    const { instance } = useMsal();

    useEffect(() => {
        // This handles the redirect/popup response and closes the window
        instance.handleRedirectPromise().catch((error) => {
            console.error(error);
        });
    }, [instance]);

    return <div className="flex items-center justify-center h-screen">Processing login...</div>;
}