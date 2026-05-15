"use client";

import {useMsal} from "@azure/msal-react";

export default function FilterStudents() {

    const { instance, accounts } = useMsal();

    const handleLogout = async () => {
        try {
            if (accounts.length > 0) {
                // @ts-ignore
                await instance.logout({
                    account: accounts[0],
                    onRedirectNavigate: () => {
                        return false;
                    }
                });
            }
        } catch (error) {
            console.error("Local logout failed:", error);
        } finally {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = "/";
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-w-screen min-h-screen bg-gray-50 dark:bg-gray-900 px-4 text-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                <div className={"w-full text-left"}>
                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors bg-transparent border-none cursor-pointer"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        Return to Login
                    </button>
                </div>
                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Unauthorized Access</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Only School faculty members of STI College Alabang are allowed to access ACEHUB.
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-500 italic mb-6">
                    Thank you for your understanding.
                </div>
            </div>
        </div>
    );
}
