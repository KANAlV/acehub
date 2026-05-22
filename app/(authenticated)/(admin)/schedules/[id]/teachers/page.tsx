"use client";

import React, { useEffect, useState, use } from "react";
import {
    Button,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    TextInput,
    Pagination,
    Dropdown,
    DropdownItem
} from "flowbite-react";
import { HiExclamation, HiArrowLeft } from "react-icons/hi";
import { IoMdArrowDropdown } from "react-icons/io";
import { useRouter } from "next/navigation";
import {
    fetchSchedulesList,
    fetchTeachers,
    fetchScheduleDetails,
    fetchTeachersCount,
    fetchSystemSettings, fetchAllTeachers
} from "@/services/userService.ts";

export default function ScheduleTeachers({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id: scheduleId } = use(params);

    const [loading, setLoading] = useState(true);
    const [scheduleExists, setScheduleExists] = useState<boolean | null>(null);
    const [systemSettings, setSystemSettings] = useState<any>(null);

    // Teacher table states
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    const [filterType, setFilterType] = useState("All"); // New state for filter type

    // pagination consts
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setRowCount] = useState(1);
    const totalPageCount = Math.ceil(rowCount / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, rowCount);

    const checkScheduleExists = async () => {
        setLoading(true);
        try {
            const scheduleList = await fetchSchedulesList();
            const schedule = scheduleList.find((s: any) => s.id === scheduleId);

            if (schedule) {
                setScheduleExists(true);
            } else {
                setScheduleExists(false);
            }
        } catch (error) {
            console.error("Error checking schedule:", error);
            setScheduleExists(false);
        } finally {
            setLoading(false);
        }
    };

    const loadTeacherData = async () => {
        setLoading(true);
        try {
            const [teachs, scheduleDetails, settings] = await Promise.all([
                fetchAllTeachers(),
                fetchScheduleDetails(scheduleId),
                fetchSystemSettings()
            ]);

            setAllTeachers(teachs);
            setSchedules(scheduleDetails);
            setSystemSettings(settings);

            // Calculate load for each teacher
            const teachersWithLoad = teachs.map(teacher => {
                const teacherUnits = (scheduleDetails as any[]).reduce((total: number, schedule: any) => {
                    if (schedule.teacher_id === teacher.pscs_id) {
                        const durationHours = (schedule.end_time - schedule.start_time) / 60;
                        return total + durationHours;
                    }
                    return total;
                }, 0);

                const assignedSubjects = new Set(
                    scheduleDetails
                        .filter((s: any) => s.teacher_id === teacher.pscs_id)
                        .map((s: any) => s.subjectId)
                ).size;

                return {
                    ...teacher,
                    load_units: teacherUnits,
                    assigned_subjects: assignedSubjects
                };
            });

            // Filter teachers based on search and type
            const filteredTeachers = teachersWithLoad.filter(teacher => {
                const matchesSearch = !debouncedSearch ||
                    (teacher.fname + " " + (teacher.mi? teacher.mi + " ":"") + teacher.sname + (teacher.suffix? " " + teacher.suffix : "")).toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                    teacher.pscs_id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                    teacher.teacher_code.toLowerCase().includes(debouncedSearch.toLowerCase());

                const matchesType = filterType === "All" || teacher.employment_type === filterType;

                return matchesSearch && matchesType;
            });

            // Set row count based on filtered results
            setRowCount(filteredTeachers.length);

            // Apply pagination
            const offset = (currentPage - 1) * itemsPerPage;
            const paginatedTeachers = filteredTeachers.slice(offset, offset + itemsPerPage);

            setTeachers(paginatedTeachers);
        } catch (error) {
            console.error("Error fetching teachers:", error);
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    };

    const onPageChange = (page: number) => setCurrentPage(page);

    useEffect(() => {
        checkScheduleExists();
    }, [scheduleId]);

    useEffect(() => {
        if (scheduleExists) {
            loadTeacherData();
        }
    }, [currentPage, debouncedSearch, filterType, scheduleExists]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, filterType]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(handler);
    }, [search]);

    if (loading && scheduleExists === null) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl" />
                </div>
            </div>
        );
    }

    if (scheduleExists === false) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                            <HiExclamation className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Schedule Not Found
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            The schedule with ID "{scheduleId}" does not exist or may have been deleted.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button
                                color="alternative"
                                onClick={() => router.push("/schedules")}
                            >
                                <HiArrowLeft className="mr-2" />
                                Back to Schedules
                            </Button>
                            <Button
                                color="blue"
                                onClick={() => window.location.reload()}
                            >
                                Try Again
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 h-full w-full overflow-y-auto font-sans">
            <div className="flex justify-between items-center">
                <Button color="gray" size="sm" onClick={() => router.push(`/schedules/${scheduleId}`)}>
                    <HiArrowLeft />
                </Button>
                <h1 className="text-2xl font-bold">Teacher Analysis - Schedule {scheduleId}</h1>
                <div></div>
            </div>

            <div className="flex gap-4 mb-4">
                <TextInput
                    className="w-62"
                    placeholder="Search teachers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading && (
                <div className="text-center py-12">
                    <Spinner size="xl" />
                </div>
            )}

            {!loading && (
                <>
                    <Table hoverable>
                        <TableHead>
                            <TableRow>
                                <TableHeadCell>ID</TableHeadCell>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell>Code</TableHeadCell>
                                <TableHeadCell>Spec.</TableHeadCell>
                                <TableHeadCell>
                                    <Dropdown
                                        label="Type"
                                        inline
                                        dismissOnClick={true}
                                        renderTrigger={() => (
                                            <span className="cursor-pointer flex items-center gap-1 hover:text-blue-500">
                                                Type {filterType !== "All" && `(${filterType})`} <IoMdArrowDropdown />
                                            </span>
                                        )}
                                    >
                                        <DropdownItem onClick={() => setFilterType("All")}>All Types</DropdownItem>
                                        <DropdownItem onClick={() => setFilterType("FT")}>FT</DropdownItem>
                                        <DropdownItem onClick={() => setFilterType("PTFL")}>PTFL</DropdownItem>
                                        <DropdownItem onClick={() => setFilterType("PT")}>PT</DropdownItem>
                                    </Dropdown>
                                </TableHeadCell>
                                <TableHeadCell>Load/Units</TableHeadCell>
                                <TableHeadCell>Assigned Subjects</TableHeadCell>
                            </TableRow>
                        </TableHead>
                        <TableBody className="divide-y">
                            {teachers.length > 0 ? (
                                teachers.map((t) => (
                                    <TableRow key={t.pscs_id} onClick={() => router.push("/schedules/" + scheduleId + "/teachers/" + t.pscs_id + "/")}>
                                        <TableCell className="font-bold">{t.pscs_id}</TableCell>
                                        <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{t.fname} {t.mi? t.mi + ". ":""} {t.sname} {t.suffix}</TableCell>
                                        <TableCell>{t.teacher_code}</TableCell>
                                        <TableCell>{t.specialization}</TableCell>
                                        <TableCell>{t.employment_type}</TableCell>
                                        <TableCell>{t.load_units || 0} units</TableCell>
                                        <TableCell>{t.assigned_subjects || 0} subjects</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-4">No teachers found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    <div className="mt-6 flex flex-col items-center">
                        <p className="text-sm mb-2">{rowCount > 0 ? `Showing ${startItem} to ${endItem} of ${rowCount} Entries` : ""}</p>
                        <div className={`${totalPageCount > 1? "":"hidden"}`}>
                            <Pagination currentPage={currentPage} totalPages={totalPageCount || 1} onPageChange={onPageChange} showIcons />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
