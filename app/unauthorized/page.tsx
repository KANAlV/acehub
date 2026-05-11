"use client";

export default function Maintenance() {
    return (
        <div className="flex flex-col items-center justify-center min-w-screen min-h-screen bg-gray-50 dark:bg-gray-900 px-4 text-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                <div className={"w-full text-left"}>
                    <button
                        onClick={() => window.location.href="/dashboard"}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors bg-transparent border-none cursor-pointer"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        Go Back
                    </button>
                </div>
                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You don't have permission to access this page. Please contact your administrator if you believe this is an error.
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-500 italic mb-6">
                    Your current role may not have the required privileges for this content.
                </div>
            </div>
        </div>
    );
}
