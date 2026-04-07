"use client";

import {
    Button,
    Drawer,
    DrawerHeader,
    DrawerItems,
    Sidebar,
    SidebarItem,
    SidebarItemGroup,
    SidebarItems
} from "flowbite-react";
import { BiBuoy } from "react-icons/bi";
import {
    HiLibrary, HiChartPie, HiBookOpen, HiClipboardCheck, HiTable, HiAcademicCap, HiViewBoards, HiBriefcase, HiLogout,
    HiOutlineMenu
} from "react-icons/hi";
import Link from "next/link";
import {useState} from "react";

export function SidebarComponent() {
    const [isOpen, setIsOpen] = useState(false);

    const handleClose = () => setIsOpen(false);

    const sideBar = () => {
        return(
            <Sidebar className={"h-auto"}>
                <SidebarItems>
                    <SidebarItemGroup>
                        <SidebarItem as={Link} href="/" icon={HiChartPie} onClick={() => setIsOpen(false)}>
                            Dashboard (WIP)
                        </SidebarItem>
                        <SidebarItem as={Link} href="#" icon={HiTable} onClick={() => setIsOpen(false)}>
                            Schedules (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/rooms" icon={HiLibrary} onClick={() => setIsOpen(false)}>
                            Rooms
                        </SidebarItem>
                        <SidebarItem as={Link} href="/courses" icon={HiBriefcase} onClick={() => setIsOpen(false)}>
                            Courses
                        </SidebarItem>
                        <SidebarItem as={Link} href="#" icon={HiAcademicCap} onClick={() => setIsOpen(false)}>
                            Teachers (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/subjects" icon={HiBookOpen} onClick={() => setIsOpen(false)}>
                            Subjects
                        </SidebarItem>
                        <SidebarItem as={Link} href="#" icon={HiClipboardCheck} onClick={() => setIsOpen(false)}>
                            Acad. Quals (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="/testFunction" icon={HiViewBoards} onClick={() => setIsOpen(false)}>
                            test
                        </SidebarItem>
                    </SidebarItemGroup>
                    <SidebarItemGroup>
                        <SidebarItem as={Link} href="#" icon={BiBuoy}>
                            Help (*)
                        </SidebarItem>
                        <SidebarItem as={Link} href="#" icon={HiLogout} onClick={() => setIsOpen(false)}>
                            Log Out (*)
                        </SidebarItem>
                    </SidebarItemGroup>
                </SidebarItems>
            </Sidebar>
        )
    }
    return (
        <>
            <div className={"flex md:hidden py-1 dark:bg-slate-800"}>
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

            <div className={"hidden md:block dark:bg-slate-800"}>
                <div className={"flex my-2 items-center"}>
                    <p className={"font-bold mx-5 text-xl"}>𝒜</p> ACEHUB
                </div>
                {sideBar()}
            </div>
        </>
    );
}
