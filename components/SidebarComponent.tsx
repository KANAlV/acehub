"use client";

import {
    AccordionContent,
    AccordionPanel, AccordionTitle,
    Button,
    Drawer,
    DrawerHeader,
    DrawerItems, Popover,
    Sidebar, SidebarCollapse,
    SidebarItem,
    SidebarItemGroup,
    SidebarItems
} from "flowbite-react";
import {
    HiLibrary, HiChartPie, HiBookOpen, HiClipboardCheck, HiTable, HiAcademicCap, HiLogout,
    HiOutlineMenu, HiUserGroup, HiChevronDown, HiQuestionMarkCircle
} from "react-icons/hi";
import Link from "next/link";
import {useEffect, useState} from "react";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import {IoMdSettings} from "react-icons/io";
import {getTeacherID} from "@/services/userService.ts";

export function SidebarComponent({ username, role, email }: { username: string, role: string, email: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { instance, accounts } = useMsal();
    const [facultyID, setFacultyID] = useState("");

    useEffect(() => {
        if (!email) return;
        if (role == "Faculty"){
            (async () => {
                const id = await getTeacherID(email);
                setFacultyID(id ?? "");
            })();

        }
    }, [email]);

    /** --- Role Detection --- **/
        if (role !== "Viewer"){
            if( pathname.includes("/academic_qualifications")) {
                window.location.href = "/unauthorized";
            }
        }

        if (role !== "Administrator") {
            if( pathname.includes("/schedules") ||
                pathname.includes("/rooms") ||
                pathname.includes("/teachers") ||
                pathname.includes("/subjects")) {
                window.location.href = "/unauthorized";
            }
        }

        if (role !== "Administrator" && role !== "SuperAdmin") {
            if( pathname.includes("/configuration")) {
                window.location.href = "/unauthorized";
            }
        }

        if (role !== "Administrator" && role !== "Registrar") {
            if( pathname.includes("/courses")) {
                window.location.href = "/unauthorized";
            }
        }

    if (role !== "Academic Assistant") {
        if( pathname.includes("/booking")) {
            window.location.href = "/unauthorized";
        }
    }

    /** --- /Role Detection --- **/



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
                        <SidebarItem hidden={role !== "Academic Assistant"}
                                     as={Link} href="/maintenance" className={"hover:bg-gray-500/14"} icon={HiTable} onClick={() => setIsOpen(false)}>
                            Booking
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Faculty"}
                                     as={Link} href={`/overview/${facultyID}`} className={"hover:bg-gray-500/14"} icon={HiTable} onClick={() => setIsOpen(false)}>
                            Personal Schedule
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Faculty"}
                                     as={Link} href="/maintenance" className={"hover:bg-gray-500/14"} icon={HiAcademicCap} onClick={() => setIsOpen(false)}>
                            Acad. Qualifications
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="/schedules" className={"hover:bg-gray-500/14"} icon={HiTable} onClick={() => setIsOpen(false)}>
                            Schedules
                        </SidebarItem>
                        <SidebarCollapse icon={HiUserGroup} label="Courses" className={"hover:bg-gray-500/14"}>
                            <SidebarItem hidden={role !== "Administrator"}
                                         as={Link} href="/courses/shs" className={"hover:bg-gray-500/14"} onClick={() => setIsOpen(false)}>
                                SHS
                            </SidebarItem>
                            <SidebarItem hidden={role !== "Administrator"}
                                         as={Link} href="/courses/tertiary" className={"hover:bg-gray-500/14"} onClick={() => setIsOpen(false)}>
                                Tertiary
                            </SidebarItem>
                        </SidebarCollapse>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="/rooms" className={"hover:bg-gray-500/14"} icon={HiLibrary} onClick={() => setIsOpen(false)}>
                            Rooms
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="/subjects" className={"hover:bg-gray-500/14"} icon={HiBookOpen} onClick={() => setIsOpen(false)}>
                            Subjects
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="/teachers" className={"hover:bg-gray-500/14"} icon={HiAcademicCap} onClick={() => setIsOpen(false)}>
                            Teachers
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="/maintenance" className={"hover:bg-gray-500/14"} icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            MAQ (*)
                        </SidebarItem>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="/maintenance" className={"hover:bg-gray-500/14"} icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            FCCE (*)
                        </SidebarItem>
                    </SidebarItemGroup>
                    <SidebarItemGroup>
                        <SidebarItem hidden={role !== "Administrator"}
                                     as={Link} href="#" className={"hover:bg-gray-500/14"} icon={HiQuestionMarkCircle}>
                            Help (*)
                        </SidebarItem>
                        <SidebarItem hidden={!["SuperAdmin", "Administrator"].includes(role)}
                                     as={Link} href="/configuration" className={"hover:bg-gray-500/14"} icon={IoMdSettings}>
                            Configuration
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
                    <img src="/achehub-logo.png" alt="Achehub Logo" className="h-8 mx-3" /> ACEHUB
                </div>
            </div>

            <Drawer open={isOpen} onClose={handleClose} className={"md:hidden"}>
                <DrawerHeader title="ACEHUB" titleIcon={() => <img src="/achehub-logo.png" alt="Achehub Logo" className="h-8 mx-3" />} />
                <DrawerItems>
                    {sideBar()}
                </DrawerItems>
            </Drawer>

            <div className={"hidden md:block overflow-y-auto bg-gray-500/14 dark:bg-gray-800"}>
                <div className={"flex my-2 items-center"}>
                    <img src="/achehub-logo.png" alt="Achehub Logo" className="h-8 mx-3" /> ACEHUB
                </div>
                {sideBar()}
            </div>
        </>
    );
}
