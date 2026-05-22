import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { redirect } from "next/navigation";
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

    async function studentCheck(username: string) {
        if (username.includes("(Student)")) redirect("/studentfilter");
    }

    // Fetch the logged-in user on the server
    const user = await getCurrentUser();
    const email = user?.email || "";
    const username = user?.username || "Guest";
    const role = user?.role || "Viewer";
    const isStudent = await studentCheck(username);

    return (
        <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden">
            <SidebarComponent username={username} role={role} email={email} />
            <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
                {children}
            </main>
        </div>
    );
}
