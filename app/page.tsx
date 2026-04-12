"use client";

import Link from "next/link";

export default function Login() {
    return (
        <div className="w-dvw h-dvh overflow-auto">
            <section className="bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
                <Link href="/login">Login</Link>
            </section>
        </div>
    );
}