import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { SidebarComponent } from "@/components/SidebarComponent";
import { getCurrentUser } from "@/services/userService";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Acehub | Faculty Scheduling",
    description: "Web-based faculty scheduling management system",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Fetch the logged-in user on the server
    const user = await getCurrentUser();
    const username = user?.username || "Guest";

    return (
        <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden">
            <SidebarComponent username={username} />
            <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
                {children}
            </main>
        </div>
    );
}
