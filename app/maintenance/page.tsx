"use client";

export default function Maintenance() {
    return (
        <div className="flex flex-col items-center justify-center min-w-screen min-h-screen bg-gray-50 dark:bg-gray-900 px-4 text-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Under Maintenance</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    We're currently performing some scheduled updates to improve your experience. We'll be back online shortly.
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-500 italic">
                    Thank you for your patience.
                </div>
            </div>
        </div>
    );
}
