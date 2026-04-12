"use client";

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/app/authConfig.ts";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
    const { instance, inProgress } = useMsal();
    const searchParams = useSearchParams();
    
    // Check if we were just at the auth-callback to show a loading state instead of the login button
    const isReturningFromAuth = searchParams.get("state") || searchParams.get("code");

    const handleLogin = async () => {
        if (inProgress !== "none") return;

        try {
            await instance.loginRedirect(loginRequest);
        } catch (e) {
            console.error("Login redirect failed:", e);
        }
    };

    if (isReturningFromAuth || inProgress !== "none") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Completing secure sign-in...</p>
            </div>
        );
    }

    return (
        <section className="bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
                <div className="w-full bg-white rounded-xl shadow-lg dark:border md:mt-0 sm:max-w-md xl:p-0 dark:bg-gray-800 dark:border-gray-700">
                    <div className="p-8 space-y-6">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                Academic Head Portal
                            </h1>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Please sign in with your organizational account to manage faculty schedules.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={handleLogin}
                                disabled={inProgress !== "none"}
                                type="button"
                                className="w-full inline-flex items-center justify-center py-3 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 transition-colors duration-200 disabled:opacity-50"
                            >
                                <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23">
                                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                                </svg>
                                {inProgress !== "none" ? "Redirecting..." : "Login with Microsoft 365"}
                            </button>
                        </div>

                        <div className="text-center text-xs text-gray-400">
                            Use your @alabang.sti.edu.ph account
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function Login() {
    return (
        <div className="w-dvw h-dvh overflow-auto">
            <Suspense fallback={<div>Loading...</div>}>
                <LoginContent />
            </Suspense>
        </div>
    );
}
