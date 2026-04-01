"use client";

import { Sidebar, SidebarItem, SidebarItemGroup, SidebarItems } from "flowbite-react";
import { BiBuoy } from "react-icons/bi";
import { HiLibrary, HiChartPie, HiBookOpen, HiClipboardCheck, HiTable, HiAcademicCap, HiViewBoards, HiBriefcase } from "react-icons/hi";
import Link from "next/link";

export function SidebarComponent() {
    return (
        <Sidebar className={"h-dvh"}>
            <SidebarItems>
                <SidebarItemGroup className={"flex items-center"}>
                    <h1 className={"font-bold mx-5 text-xl"}>𝒜</h1> ACEHUB
                </SidebarItemGroup>
                <SidebarItemGroup>
                    <SidebarItem as={Link} href="/" icon={HiChartPie}>
                        Dashboard
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiTable}>
                        Schedules
                    </SidebarItem>
                    <SidebarItem as={Link} href="/rooms" icon={HiLibrary}>
                        Rooms
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiBriefcase}>
                        Courses
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiAcademicCap}>
                        Teachers
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiBookOpen}>
                        Subjects
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiClipboardCheck}>
                        Acad. Quals
                    </SidebarItem>
                    <SidebarItem as={Link} href="/testFunction" icon={HiViewBoards}>
                        test
                    </SidebarItem>
                </SidebarItemGroup>
                <SidebarItemGroup>
                    <SidebarItem as={Link} href="#" icon={HiChartPie}>
                        Upgrade to Pro
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiViewBoards}>
                        Documentation
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={BiBuoy}>
                        Help
                    </SidebarItem>
                </SidebarItemGroup>
            </SidebarItems>
        </Sidebar>
    );
}
