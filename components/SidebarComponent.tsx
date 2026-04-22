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
    HiLibrary, HiChartPie, HiBookOpen, HiClipboardCheck, HiTable, HiAcademicCap, HiViewBoards, HiBriefcase, HiLogout,
    HiOutlineMenu, HiUserGroup, HiChevronDown, HiQuestionMarkCircle
} from "react-icons/hi";
import Link from "next/link";
import {useEffect, useState} from "react";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";

export function SidebarComponent() {
    const [isOpen, setIsOpen] = useState(false);
    const [username, setUsername] = useState("Loading...");
    const pathname = usePathname();
    const { instance, accounts } = useMsal();

    const show = pathname === "/" || pathname === "/login" || pathname === "/auth-callback";

    if (show) {
        return null;
    }

    useEffect(() => {
        async function fetchUser() {
            try {
                console.log('Client: Fetching user data...');
                
                const response = await fetch('/api/user', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                console.log('Client: API response status:', response.status);
                
                if (!response.ok) {
                    console.error('Client: API response not ok:', response.status, response.statusText);
                    setUsername("Guest");
                    return;
                }
                
                const result = await response.json();
                console.log('Client: User data received:', result);
                
                if (result && result.username) {
                    setUsername(result.username);
                    console.log('Client: Username set to:', result.username);
                } else {
                    console.log('Client: No username in response, setting to Guest');
                    setUsername("Guest");
                }
            } catch (error) {
                console.error('Client: Error fetching user:', error);
                setUsername("Guest");
            }
        }

        fetchUser();
    }, []);

    const handleLogout = async () => {
        setIsOpen(false);

        try {
            // This clears the account from the local MSAL cache (session/cookies)
            // without redirecting to the global Microsoft logout page.
            if (accounts.length > 0) {
                // @ts-ignore
                await instance.logout({
                    account: accounts[0],
                    onRedirectNavigate: () => {
                        // Return false to prevent MSAL from redirecting to Microsoft's logout page
                        return false;
                    }
                });
            }
        } catch (error) {
            console.error("Local logout failed:", error);
        } finally {
            // Manually clear any remaining storage if necessary and redirect to home
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = "/";
        }
    };

    const handleClose = () => setIsOpen(false);

    const sideBar = () => {
        return(
            <Sidebar className={"h-auto"}>
                <SidebarItems>
                    <SidebarItemGroup>
                        <Popover content={
                            <div className="w-64 text-sm text-gray-500 dark:text-gray-400">
                                <div className="px-3 py-2">
                                    <SidebarItem
                                        as="button"
                                        icon={HiLogout}
                                        onClick={handleLogout}
                                        className="w-full text-left"
                                    >
                                        Log Out
                                    </SidebarItem>
                                </div>
                            </div>
                        }>
                            <Button color={"dark"}
                                    outline={true}
                                    className={"py-6 w-full text-left"}>
                                {username}
                                <HiChevronDown size={"24"}/>
                            </Button>
                        </Popover>
                        <SidebarItem as={Link} href="/" icon={HiChartPie} onClick={() => setIsOpen(false)}>
                            Dashboard (WIP)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/maintenance" icon={HiTable} onClick={() => setIsOpen(false)}>
                            Schedules (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/rooms" icon={HiLibrary} onClick={() => setIsOpen(false)}>
                            Rooms
                        </SidebarItem>
                        <SidebarItem as={Link} href="/courses" icon={HiUserGroup} onClick={() => setIsOpen(false)}>
                            Courses
                        </SidebarItem>
                        <SidebarItem as={Link} href="/maintenance" icon={HiAcademicCap} onClick={() => setIsOpen(false)}>
                            Teachers (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/subjects" icon={HiBookOpen} onClick={() => setIsOpen(false)}>
                            Subjects
                        </SidebarItem>
                        <SidebarItem as={Link} href="/maintenance" icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            MAQ (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/maintenance" icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            FCCE (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/testFunction" icon={HiViewBoards} onClick={() => setIsOpen(false)}>
                            test
                        </SidebarItem>
                    </SidebarItemGroup>
                    <SidebarItemGroup>
                        <SidebarItem as={Link} href="#" icon={HiQuestionMarkCircle}>
                            Help (*)
                        </SidebarItem>
                    </SidebarItemGroup>
                </SidebarItems>
            </Sidebar>
        )
    }
    return (
        <>
            <div className={"flex md:hidden py-1 bg-gray-100 dark:bg-gray-800"}>
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

            <div className={"hidden md:block bg-gray-100 dark:bg-gray-800"}>
                <div className={"flex my-2 items-center"}>
                    <p className={"font-bold mx-5 text-xl"}>𝒜</p> ACEHUB
                </div>
                {sideBar()}
            </div>
        </>
    );
}
