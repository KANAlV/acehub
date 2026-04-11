import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {SidebarComponent} from "@/components/SidebarComponent";
import {Providers} from "components/Provider.tsx";
import { usePathname } from "next/navigation";

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
            <Providers>
                <SidebarComponent />
                    <div className="w-dvw h-dvh overflow-auto">
                        {children}
                    </div>
            </Providers>
        </body>
        </html>
    );
}
