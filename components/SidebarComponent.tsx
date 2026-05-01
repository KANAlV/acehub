"use client";

import {
    Button,
    Drawer,
    DrawerHeader,
    DrawerItems, Popover,
    Sidebar,
    SidebarItem,
    SidebarItemGroup,
    SidebarItems
} from "flowbite-react";
import {
    HiLibrary, HiChartPie, HiBookOpen, HiClipboardCheck, HiTable, HiAcademicCap, HiViewBoards, HiLogout,
    HiOutlineMenu, HiUserGroup, HiChevronDown, HiQuestionMarkCircle
} from "react-icons/hi";
import Link from "next/link";
import {useState} from "react";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import {IoMdSettings} from "react-icons/io";

export function SidebarComponent({ username }: { username: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { instance, accounts } = useMsal();

    const show = pathname === "/" || pathname === "/login" || pathname === "/auth-callback";

    const customTheme = {
        root: {
            inner: 'bg-transparent'
        }
    }

    if (show) {
        return null;
    }

    const handleLogout = async () => {
        setIsOpen(false);

        try {
            if (accounts.length > 0) {
                // @ts-ignore
                await instance.logout({
                    account: accounts[0],
                    onRedirectNavigate: () => {
                        return false;
                    }
                });
            }
        } catch (error) {
            console.error("Local logout failed:", error);
        } finally {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = "/";
        }
    };

    const handleClose = () => setIsOpen(false);

    const sideBar = () => {
        return(
            <Sidebar theme={customTheme} className={"h-auto"}>
                <SidebarItems>
                    <SidebarItemGroup>
                        <Popover content={
                            <div className="w-64 text-sm text-gray-500 dark:text-gray-400">
                                <div className="px-3 py-2">
                                    <SidebarItem
                                        as="button"
                                        icon={HiLogout}
                                        onClick={handleLogout}
                                        className="w-full text-left hover:bg-gray-500/14"
                                    >
                                        Log Out
                                    </SidebarItem>
                                </div>
                            </div>
                        }>
                            <Button color={"alternative"}
                                    outline={true}
                                    className={"py-6 w-full text-left hover:bg-gray-500/14"}>
                                <div className="flex items-center justify-between w-full">
                                    <span className="truncate mr-2">{username || "Guest"}</span>
                                    <HiChevronDown size={"20"}/>
                                </div>
                            </Button>
                        </Popover>
                        <SidebarItem as={Link} href="/dashboard" className={"hover:bg-gray-500/14"} icon={HiChartPie} onClick={() => setIsOpen(false)}>
                            Dashboard
                        </SidebarItem>
                        <SidebarItem as={Link} href="/schedules" className={"hover:bg-gray-500/14"} icon={HiTable} onClick={() => setIsOpen(false)}>
                            Schedules
                        </SidebarItem>
                        <SidebarItem as={Link} href="/rooms" className={"hover:bg-gray-500/14"} icon={HiLibrary} onClick={() => setIsOpen(false)}>
                            Rooms
                        </SidebarItem>
                        <SidebarItem as={Link} href="/courses" className={"hover:bg-gray-500/14"} icon={HiUserGroup} onClick={() => setIsOpen(false)}>
                            courses
                        </SidebarItem>
                        <SidebarItem as={Link} href="/teachers" className={"hover:bg-gray-500/14"} icon={HiAcademicCap} onClick={() => setIsOpen(false)}>
                            Teachers
                        </SidebarItem>
                        <SidebarItem as={Link} href="/subjects" className={"hover:bg-gray-500/14"} icon={HiBookOpen} onClick={() => setIsOpen(false)}>
                            Subjects
                        </SidebarItem>
                        <SidebarItem as={Link} href="/maintenance" className={"hover:bg-gray-500/14"} icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            MAQ (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/maintenance" className={"hover:bg-gray-500/14"} icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            FCCE (*)
                        </SidebarItem>
                    </SidebarItemGroup>
                    <SidebarItemGroup>
                        <SidebarItem as={Link} href="#" className={"hover:bg-gray-500/14"} icon={HiQuestionMarkCircle}>
                            Help (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/settings" className={"hover:bg-gray-500/14"} icon={IoMdSettings}>
                            Settings
                        </SidebarItem>
                    </SidebarItemGroup>
                </SidebarItems>
            </Sidebar>
        )
    }
    return (
        <>
            <div className={"flex md:hidden py-1 bg-gray-500/14 dark:bg-gray-800"}>
                <Button
                    outline
                    color={"alternative"}
                    onClick={() => setIsOpen(true)}
                >
                    <HiOutlineMenu size={30}/>
                </Button>

                <div className={"flex my-2 items-center"}>
                    <p className={"font-bold mx-5 text-xl"}>𝒜</p> ACEHUB
                </div>
            </div>

            <Drawer open={isOpen} onClose={handleClose} className={"md:hidden"}>
                <DrawerHeader title="ACEHUB" titleIcon={() => <p className={"font-bold mx-5 text-xl"}>𝒜</p>} />
                <DrawerItems>
                    {sideBar()}
                </DrawerItems>
            </Drawer>

            <div className={"hidden md:block overflow-y-auto bg-gray-500/14 dark:bg-gray-800"}>
                <div className={"flex my-2 items-center"}>
                    <p className={"font-bold mx-5 text-xl"}>𝒜</p> ACEHUB
                </div>
                {sideBar()}
            </div>
        </>
    );
}
