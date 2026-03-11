"use client";

import { Sidebar, SidebarItem, SidebarItemGroup, SidebarItems } from "flowbite-react";
import { BiBuoy } from "react-icons/bi";
import { HiArrowSmRight, HiChartPie, HiInbox, HiShoppingBag, HiTable, HiUser, HiViewBoards } from "react-icons/hi";
import Link from "next/link";

export function SidebarComponent() {
    return (
        <Sidebar className={"h-dvh"}>
            <SidebarItems>
                <SidebarItemGroup>
                    <SidebarItem as={Link} href="/" icon={HiChartPie}>
                        Dashboard
                    </SidebarItem>
                    <SidebarItem as={Link} href="/testFunction" icon={HiViewBoards}>
                        test
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiInbox}>
                        Inbox
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiUser}>
                        Users
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiShoppingBag}>
                        Products
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiArrowSmRight}>
                        Sign In
                    </SidebarItem>
                    <SidebarItem as={Link} href="#" icon={HiTable}>
                        Sign Up
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
