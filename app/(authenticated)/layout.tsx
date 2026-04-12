import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import {SidebarComponent} from "@/components/SidebarComponent";
import {Providers} from "@/components/Provider.tsx";

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
        <>
            <SidebarComponent />
            <div className="w-dvw h-dvh overflow-auto">
                {children}
            </div>
        </>
    );
}
