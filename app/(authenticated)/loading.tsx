"use client";

import { Spinner } from "flowbite-react";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <Spinner size="xl" />
                <p className="text-gray-600 dark:text-gray-400 font-bold animate-pulse uppercase tracking-widest text-xs">
                    Syncing Acehub...
                </p>
            </div>
        </div>
    );
}
