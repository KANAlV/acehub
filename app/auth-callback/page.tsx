"use client";

export default function AuthCallback() {
    return (
        <div className="flex flex-col items-center justify-center w-dvw h-screen space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Completing secure sign-in...</p>
        </div>
    );
}
