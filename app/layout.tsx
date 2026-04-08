import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarComponent } from "@/components/SidebarComponent";
import { Providers } from "@/components/Provider"; // Import your Providers component

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

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body
            className={`block md:flex ${geistSans.variable} ${geistMono.variable} antialiased`}
        >
        {/* 1. Wrap EVERYTHING inside Providers */}
        <Providers>
            <SidebarComponent />
            {/* 2. Use flex-1 instead of w-dvw.
                       This ensures that when the sidebar is hidden (on the login page),
                       this div expands to fill 100% of the screen automatically.
                    */}
            <div className="flex-1 h-dvh overflow-auto">
                {children}
            </div>
        </Providers>
        </body>
        </html>
    );
}