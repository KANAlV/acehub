"use client";

import React, { useEffect, useState, useMemo, useCallback, use } from "react";
import {
    Card, Button, Spinner, Label, Progress,
    Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow,
    Badge, Tooltip, Modal, ModalHeader, ModalBody, ModalFooter, Checkbox, TextInput, Toast, ToastToggle
} from "flowbite-react";
import {
    HiUserGroup, HiArrowLeft, HiClock, HiBookOpen, HiCalendar,
    HiTrendingUp, HiTrendingDown, HiCheckCircle, HiExclamationCircle, HiSearch,
    HiCheck, HiExclamation
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import {
    fetchScheduleDetails, fetchTeachers, fetchAllSubjects, fetchSchedulesList,
    fetchSystemSettings, fetchAllTeachers, getAllRoomsData, fetchBreakPeriods, updateScheduleEntries
} from "@/services/userService.ts";
import { getMaxUnitsSync, getOverloadMaxSync, getPrepLimitSync } from "@/lib/teachingLoadUtils.ts";
import { transferSubjectSectionForTeacher, blocksToPayload } from "@/lib/scheduleTransferUtils.ts";

/* ================= CONSTANTS ================= */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(min: number) {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Get max units based on employment type
function getMaxUnitsByEmploymentType(employmentType: string): number {
    switch (employmentType.toLowerCase()) {
        case "regular":
        case "ft":
            return 24; // Full-time teachers
        case "ptfl":
        case "ftpt":
            return 18; // Full-time part-time
        case "pt":
        case "part-time":
            return 12; // Part-time teachers
        case "proby":
            return 20; // Probationary
        default:
            return 24; // Default to full-time
    }
}

// Get employment type display name
function getEmploymentTypeDisplay(employmentType: string): string {
    switch (employmentType.toLowerCase()) {
        case "regular":
        case "ft":
            return "Full-Time";
        case "ptfl":
        case "ftpt":
            return "Full-Time Part-Time";
        case "pt":
        case "part-time":
            return "Part-Time";
        case "proby":
            return "Probationary";
        default:
            return employmentType;
    }
}

export default function TeacherAnalysis({ params }: { params: Promise<{ id: string, teacherId: string }> }) {
    const router = useRouter();
    const {id, teacherId} = use(params);

    const [loading, setLoading] = useState(true);
    const [scheduleExists, setScheduleExists] = useState<boolean | null>(null);
    const [teacherExists, setTeacherExists] = useState<boolean | null>(null);
    const [teacher, setTeacher] = useState<any>(null);
    const [scheduleEntries, setScheduleEntries] = useState<any[]>([]);
    const [allScheduleEntries, setAllScheduleEntries] = useState<any[]>([]);
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [scheduleName, setScheduleName] = useState("");
    const [systemSettings, setSystemSettings] = useState<any>(null);

    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTargetEntry, setTransferTargetEntry] = useState<any | null>(null);
    const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
    const [recipientSearch, setRecipientSearch] = useState("");

    const [transferSaving, setTransferSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastOk, setToastOk] = useState(true);

    const MAX_TRANSFER_RECIPIENTS = 1;

    useEffect(() => {
        const loadTeacherData = async () => {
            setLoading(true);
            setScheduleExists(null);
            setTeacherExists(null);
            
            try {
                // First check if schedule exists
                const scheduleList = await fetchSchedulesList();
                const schedule = scheduleList.find((s: any) => s.id === id);
                
                if (!schedule) {
                    setScheduleExists(false);
                    setLoading(false);
                    return;
                }
                setScheduleExists(true);
                setScheduleName(schedule.name);

                // Then check if teacher exists
                const teachers = await fetchTeachers("", 1);
                const foundTeacher = teachers.find((t: any) => t.pscs_id === teacherId);
                
                if (!foundTeacher) {
                    setTeacherExists(false);
                    setLoading(false);
                    return;
                }
                setTeacherExists(true);
                setTeacher(foundTeacher);

                // Fetch schedule entries and subjects
                const [entries, subjects, settings, teachersAll, roomList] = await Promise.all([
                    fetchScheduleDetails(id),
                    fetchAllSubjects(),
                    fetchSystemSettings(),
                    fetchAllTeachers(),
                    getAllRoomsData()
                ]);

                setAllSubjects(subjects);
                setSystemSettings(settings);
                setAllScheduleEntries(entries);
                setAllTeachers(teachersAll);
                setRooms(Array.isArray(roomList) ? roomList : []);

                // Filter entries for this teacher
                const teacherEntries = entries.filter((entry: any) => entry.teacher_id === teacherId);
                setScheduleEntries(teacherEntries);

            } catch (error) {
                console.error("Error loading teacher data:", error);
                setScheduleExists(false);
                setTeacherExists(false);
            } finally {
                setLoading(false);
            }
        };

        loadTeacherData();
    }, [id, teacherId, router]);

    /** All timetable rows for this teacher for the same course code + section (lec + lab blocks, every day). */
    const transferBundleInfo = useMemo(() => {
        if (!transferTargetEntry) {
            return {
                entries: [] as any[],
                scheduledUnits: 0,
                catalogLec: 0,
                catalogLab: 0,
                catalogTotal: 0,
                transferLoadAdd: 0,
                subjectMeta: null as any,
            };
        }
        const sid = String(transferTargetEntry.subject_id);
        const sec = String(transferTargetEntry.section_id);
        const entries = scheduleEntries.filter(
            (e: any) => String(e.subject_id) === sid && String(e.section_id) === sec
        );
        const scheduledUnits = entries.reduce(
            (t: number, e: any) => t + (e.end_time - e.start_time) / 60,
            0
        );
        const subjectMeta = allSubjects.find((s: any) => s.course_code === sid) || null;
        const catalogLec = Number(subjectMeta?.lecture_units) || 0;
        const catalogLab = Number(subjectMeta?.lab_units) || 0;
        const catalogTotal = catalogLec + catalogLab;
        const transferLoadAdd = catalogTotal > 0 ? catalogTotal : scheduledUnits;
        return {
            entries,
            scheduledUnits,
            catalogLec,
            catalogLab,
            catalogTotal,
            transferLoadAdd,
            subjectMeta,
        };
    }, [transferTargetEntry, scheduleEntries, allSubjects]);

    const otherTeachersWithLoad = useMemo(() => {
        const settings = systemSettings || {};
        const add = transferBundleInfo.transferLoadAdd;
        return allTeachers
            .filter((t: any) => String(t.pscs_id) !== String(teacherId))
            .map((t: any) => {
                const tEntries = allScheduleEntries.filter(
                    (e: any) => String(e.teacher_id) === String(t.pscs_id)
                );
                const currentUnits = tEntries.reduce(
                    (total: number, entry: any) => total + (entry.end_time - entry.start_time) / 60,
                    0
                );
                const maxUnits = getMaxUnitsSync(t.employment_type, settings);
                const projectedUnits = currentUnits + add;
                const utilizationRate = maxUnits > 0 ? (projectedUnits / maxUnits) * 100 : 0;
                let barColor: "green" | "yellow" | "orange" | "red" | "blue" = "green";
                if (utilizationRate > 100) barColor = "red";
                else if (utilizationRate >= 95) barColor = "red";
                else if (utilizationRate >= 85) barColor = "yellow";
                else if (utilizationRate >= 60) barColor = "blue";
                return { teacher: t, currentUnits, projectedUnits, maxUnits, utilizationRate, barColor };
            })
            .sort((a, b) => String(a.teacher.name).localeCompare(String(b.teacher.name)));
    }, [
        allTeachers,
        allScheduleEntries,
        teacherId,
        systemSettings,
        transferBundleInfo.transferLoadAdd,
    ]);

    const filteredRecipientTeachers = useMemo(() => {
        const q = recipientSearch.trim().toLowerCase();
        if (!q) return otherTeachersWithLoad;
        return otherTeachersWithLoad.filter(({ teacher: t }) =>
            [t.name, t.teacher_code, t.pscs_id].some((field) =>
                String(field ?? "").toLowerCase().includes(q)
            )
        );
    }, [otherTeachersWithLoad, recipientSearch]);

    const closeTransferModal = useCallback(() => {
        setTransferModalOpen(false);
        setTransferTargetEntry(null);
        setSelectedRecipientIds([]);
        setRecipientSearch("");
    }, []);

    const openTransferModal = useCallback((entry: any) => {
        setTransferTargetEntry(entry);
        setSelectedRecipientIds([]);
        setRecipientSearch("");
        setTransferModalOpen(true);
    }, []);

    const toggleRecipientSelection = useCallback((id: string) => {
        setSelectedRecipientIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= MAX_TRANSFER_RECIPIENTS) {
                if (MAX_TRANSFER_RECIPIENTS === 1) return [id];
                return prev;
            }
            return [...prev, id];
        });
    }, []);

    const getRoomName = useCallback(
        (roomId: string | number | undefined | null) => {
            if (roomId == null || roomId === "") return "—";
            const r = rooms.find((x: any) => String(x.room_id) === String(roomId));
            return r?.room_name ?? `Room ${roomId}`;
        },
        [rooms]
    );

    const refreshScheduleSlice = useCallback(async () => {
        const entries = await fetchScheduleDetails(id);
        setAllScheduleEntries(entries);
        setScheduleEntries(entries.filter((entry: any) => String(entry.teacher_id) === String(teacherId)));
    }, [id, teacherId]);

    useEffect(() => {
        if (!showToast) return;
        const t = setTimeout(() => setShowToast(false), 4500);
        return () => clearTimeout(t);
    }, [showToast]);

    const handleConfirmTransfer = useCallback(async () => {
        const tid = selectedRecipientIds[0];
        if (!tid || !transferTargetEntry) return;
        setTransferSaving(true);
        try {
            const breaks = await fetchBreakPeriods();
            const recipient = allTeachers.find((t: any) => String(t.pscs_id) === String(tid));
            if (!recipient) {
                setToastMessage("Selected teacher could not be found.");
                setToastOk(false);
                setShowToast(true);
                return;
            }
            const result = transferSubjectSectionForTeacher({
                allRows: allScheduleEntries,
                fromTeacherId: teacherId,
                subjectId: transferTargetEntry.subject_id,
                sectionId: transferTargetEntry.section_id,
                toTeacherId: tid,
                recipientTeacher: recipient,
                rooms,
                breaks,
                systemSettings: systemSettings || {},
            });
            if (result.ok === false) {
                setToastMessage(result.message);
                setToastOk(false);
                setShowToast(true);
                return;
            }
            const res = await updateScheduleEntries(id, blocksToPayload(result.blocks));
            if (res !== "200") {
                setToastMessage("Saving the schedule failed. Please try again.");
                setToastOk(false);
                setShowToast(true);
                return;
            }
            await refreshScheduleSlice();
            closeTransferModal();
            setToastMessage("Subject–section transferred successfully.");
            setToastOk(true);
            setShowToast(true);
        } catch (e) {
            console.error(e);
            setToastMessage("Something went wrong while transferring.");
            setToastOk(false);
            setShowToast(true);
        } finally {
            setTransferSaving(false);
        }
    }, [
        selectedRecipientIds,
        transferTargetEntry,
        allScheduleEntries,
        teacherId,
        allTeachers,
        rooms,
        systemSettings,
        id,
        refreshScheduleSlice,
        closeTransferModal,
    ]);

    if (loading) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl"/>
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
                            <HiExclamationCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Schedule Not Found
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            The schedule with ID "{id}" does not exist or may have been deleted.
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

    if (teacherExists === false) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                            <HiExclamationCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Teacher Not Found
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            The teacher with ID "{teacherId}" does not exist or may have been removed.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button 
                                color="alternative" 
                                onClick={() => router.push(`/schedules/${id}`)}
                            >
                                <HiArrowLeft className="mr-2" />
                                Back to Schedule
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

    // Calculate teacher's current units and unique subjects
    const currentUnits = scheduleEntries.reduce((total, entry) => {
        const durationHours = (entry.end_time - entry.start_time) / 60;
        return total + durationHours;
    }, 0);

    const uniqueSubjects = new Set(scheduleEntries.map(entry => entry.subject_id)).size;
    const maxUnits = getMaxUnitsSync(teacher.employment_type, systemSettings || {});
    const overloadMax = getOverloadMaxSync(systemSettings || {});
    const absoluteMax = maxUnits + overloadMax;
    const prepLimit = getPrepLimitSync(teacher.employment_type, systemSettings || {});
    const remainingUnits = maxUnits - currentUnits;
    const utilizationRate = maxUnits > 0 ? (currentUnits / maxUnits) * 100 : 0;

    // Determine status and colors
    let statusColor = "green";
    let statusText = "Available";
    let statusIcon = HiCheckCircle;

    if (currentUnits > absoluteMax) {
        statusColor = "red";
        statusText = "Overloaded";
        statusIcon = HiExclamationCircle;
    } else if (currentUnits > maxUnits) {
        statusColor = "orange";
        statusText = "Overloaded (Within Limit)";
        statusIcon = HiExclamationCircle;
    } else if (utilizationRate > 95) {
        statusColor = "red";
        statusText = "At Max Capacity";
        statusIcon = HiExclamationCircle;
    } else if (utilizationRate >= 85) {
        statusColor = "yellow";
        statusText = "Near Capacity";
        statusIcon = HiExclamationCircle;
    } else if (utilizationRate >= 60) {
        statusColor = "blue";
        statusText = "Moderate Load";
        statusIcon = HiTrendingUp;
    } else {
        statusColor = "green";
        statusText = "Available";
        statusIcon = HiCheckCircle;
    }

    // Group entries by day
    const entriesByDay: Record<string, any[]> = {};
    DAYS.forEach(day => entriesByDay[day] = []);
    scheduleEntries.forEach(entry => {
        if (entriesByDay[entry.day]) {
            entriesByDay[entry.day].push(entry);
        }
    });

    // Sort entries by start time
    Object.keys(entriesByDay).forEach(day => {
        entriesByDay[day].sort((a, b) => a.start_time - b.start_time);
    });

    return (
        <div className="p-8 space-y-6 h-full w-full overflow-y-auto font-sans">
            {/* Header */}
            <div
                className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <Button color="gray" size="sm" onClick={() => router.push(`/schedules/${id}`)}>
                        <HiArrowLeft/>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{teacher.name}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Teacher Analysis • {scheduleName}
                        </p>
                    </div>
                </div>
                <Badge color={statusColor} size="lg" className="flex items-center gap-2">
                    {React.createElement(statusIcon, {className: "h-4 w-4"})}
                    {statusText}
                </Badge>
            </div>

            {/* Teacher Info & Units Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Teacher Information */}
                <Card className="border-none shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiUserGroup className="h-5 w-5"/>
                        Teacher Information
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs text-gray-500">Full Name</Label>
                            <p className="font-medium">{teacher.name}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">PSCS ID</Label>
                            <p className="font-medium">{teacher.pscs_id}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Teacher Code</Label>
                            <p className="font-medium">{teacher.teacher_code}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Employment Type</Label>
                            <p className="font-medium">{getEmploymentTypeDisplay(teacher.employment_type)}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Specialization</Label>
                            <p className="font-medium">{teacher.specialization || "Not specified"}</p>
                        </div>
                    </div>
                </Card>

                {/* Units Analysis */}
                <Card className="border-none shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HiClock className="h-5 w-5"/>
                        Units Analysis
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{currentUnits.toFixed(1)}</div>
                            <p className="text-sm text-gray-500">Current Units</p>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-gray-600">{maxUnits}</div>
                            <p className="text-sm text-gray-500">Max Units</p>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-orange-600">{absoluteMax}</div>
                            <p className="text-sm text-gray-500">Absolute Max</p>
                        </div>
                        <div className="text-center">
                            <Badge
                                color={remainingUnits >= 0 ? "success" : "failure"}
                                size="xl"
                                className="text-lg px-4 py-2"
                            >
                                {remainingUnits >= 0 ? "+" : ""}{remainingUnits.toFixed(1)}
                            </Badge>
                            <p className="text-sm text-gray-500 mt-1">Remaining Units</p>
                        </div>
                    </div>

                    {/* Subjects Section */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{uniqueSubjects}</div>
                                <p className="text-sm text-gray-600">Unique Subjects</p>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-indigo-600">{prepLimit}</div>
                                <p className="text-sm text-gray-600">Prep Limit</p>
                            </div>
                        </div>
                        {uniqueSubjects > 0 && (
                            <div className="mt-3">
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Prep Utilization</span>
                                    <span className="font-medium">{((uniqueSubjects / prepLimit) * 100).toFixed(1)}%</span>
                                </div>
                                <Progress
                                    progress={Math.min(100, (uniqueSubjects / prepLimit) * 100)}
                                    color={uniqueSubjects >= prepLimit ? "failure" : uniqueSubjects >= prepLimit * 0.8 ? "warning" : "success"}
                                    size="sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span>Utilization Rate</span>
                            <span className="font-medium">{utilizationRate.toFixed(1)}%</span>
                        </div>
                        <Progress
                            progress={Math.min(100, Math.max(0, utilizationRate))}
                            color={statusColor}
                            size="md"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0%</span>
                            {utilizationRate > 100 ? (
                                <span
                                    className="text-red-500 font-bold">Overloaded by {(utilizationRate - 100).toFixed(1)}%</span>
                            ) : (
                                <span>100%</span>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Schedule by Day */}
            <Card className="border-none shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <HiCalendar className="h-5 w-5"/>
                    Schedule by Day
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {DAYS.map(day => {
                        const dayEntries = entriesByDay[day];
                        const dayUnits = dayEntries.reduce((total, entry) => {
                            return total + (entry.end_time - entry.start_time) / 60;
                        }, 0);

                        return (
                            <div key={day} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-semibold">{day}</h4>
                                    <Badge color={dayEntries.length > 0 ? "success" : "gray"} size="sm">
                                        {dayUnits.toFixed(1)} units
                                    </Badge>
                                </div>

                                {dayEntries.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No classes scheduled</p>
                                ) : (
                                    <div className="space-y-2">
                                        {dayEntries.map((entry, idx) => {
                                            const subject = allSubjects.find(s => s.course_code === entry.subject_id);
                                            return (
                                                <div key={idx}
                                                     className="flex bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                                                    <div className={"w-full flex-1"}>
                                                        <div className="font-medium">
                                                            {subject?.course_name || entry.subject_id}
                                                        </div>
                                                        <div className="text-gray-500">
                                                            {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                                                        </div>
                                                        <div className="text-gray-400">
                                                            Room: {getRoomName(entry.room_id)} • Section: {entry.section_id}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="xs"
                                                        color="light"
                                                        type="button"
                                                        onClick={() => openTransferModal(entry)}
                                                    >
                                                        Transfer
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Subject Breakdown */}
            <Card className="border-none shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <HiBookOpen className="h-5 w-5"/>
                    Subject Breakdown
                </h3>
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Subject</TableHeadCell>
                            <TableHeadCell>Code</TableHeadCell>
                            <TableHeadCell>Units</TableHeadCell>
                            <TableHeadCell>Schedule</TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {scheduleEntries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-gray-400 italic">
                                    No subjects assigned
                                </TableCell>
                            </TableRow>
                        ) : (
                            scheduleEntries.map((entry, idx) => {
                                const subject = allSubjects.find(s => s.course_code === entry.subject_id);
                                const units = (entry.end_time - entry.start_time) / 60;

                                return (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">
                                            {subject?.course_name || entry.subject_id}
                                        </TableCell>
                                        <TableCell>{entry.subject_id}</TableCell>
                                        <TableCell>
                                            <Badge color="blue" size="sm">
                                                {units.toFixed(1)} units
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600">
                                            {entry.day} {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Modal
                show={transferModalOpen}
                onClose={() => {
                    if (!transferSaving) closeTransferModal();
                }}
                size="7xl"
            >
                <ModalHeader>Transfer subject–section</ModalHeader>
                <ModalBody className="overflow-x-hidden">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                        {/* Left: context, bundle, selection */}
                        <div className="min-w-0 flex-1 space-y-4">
                            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                You are transferring a <strong className="text-gray-900 dark:text-gray-100">subject–section</strong> assignment: every class block this teacher holds for that course and section moves together, including separate lecture and laboratory hours scheduled under the same course code for that section (for example, Computer Programming for BSIT 612).
                            </p>

                            {transferTargetEntry && (
                                <>
                                    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-800 dark:bg-blue-900/25">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
                                            Assignment
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                            {transferBundleInfo.subjectMeta?.course_name ||
                                                transferTargetEntry.subject_id}
                                        </p>
                                        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-mono">{transferTargetEntry.subject_id}</span>
                                            <span className="text-gray-500 dark:text-gray-400"> · </span>
                                            Section{" "}
                                            <span className="font-medium">{transferTargetEntry.section_id}</span>
                                        </p>
                                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                            From <span className="font-medium text-gray-800 dark:text-gray-200">{teacher?.name}</span> on this schedule.
                                        </p>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-800/80">
                                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Catalog units </span>
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {transferBundleInfo.catalogLec > 0 || transferBundleInfo.catalogLab > 0
                                                        ? `${transferBundleInfo.catalogLec} lec + ${transferBundleInfo.catalogLab} lab = ${transferBundleInfo.catalogTotal.toFixed(1)}`
                                                        : "—"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Scheduled hours (this bundle) </span>
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {transferBundleInfo.scheduledUnits.toFixed(1)} h
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Load added to recipient </span>
                                                <span className="font-medium text-blue-700 dark:text-blue-300">
                                                    +{transferBundleInfo.transferLoadAdd.toFixed(1)} units
                                                </span>
                                                <span className="text-gray-500 dark:text-gray-400">
                                                    {" "}
                                                    ({transferBundleInfo.catalogTotal > 0 ? "from subject catalog" : "from scheduled time"})
                                                </span>
                                            </div>
                                        </div>
                                        {transferBundleInfo.entries.length > 0 && (
                                            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-gray-200 pt-2 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-400">
                                                {[...transferBundleInfo.entries]
                                                    .sort(
                                                        (a, b) =>
                                                            DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
                                                            a.start_time - b.start_time
                                                    )
                                                    .map((e: any, i: number) => (
                                                        <li key={i}>
                                                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                                                {e.day}
                                                            </span>{" "}
                                                            {formatTime(e.start_time)} – {formatTime(e.end_time)} ·{" "}
                                                            {getRoomName(e.room_id)}
                                                        </li>
                                                    ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div>
                                        <Label className="mb-2 block text-sm">
                                            Candidate teachers ({selectedRecipientIds.length} / {MAX_TRANSFER_RECIPIENTS})
                                        </Label>
                                        {selectedRecipientIds.length === 0 ? (
                                            <p className="text-sm italic text-gray-500 dark:text-gray-400">
                                                None selected yet — choose one teacher from the list on the right.
                                            </p>
                                        ) : (
                                            <ul className="flex flex-wrap gap-2">
                                                {selectedRecipientIds.map((rid) => {
                                                    const t = allTeachers.find(
                                                        (x: any) => String(x.pscs_id) === String(rid)
                                                    );
                                                    if (!t) return null;
                                                    return (
                                                        <li key={rid}>
                                                            <Badge color="info" className="px-2 py-1 text-xs font-normal">
                                                                {t.name}{" "}
                                                                <span className="opacity-75">({t.teacher_code})</span>
                                                            </Badge>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: search + teacher list */}
                        <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[min(100%,30rem)] xl:w-[34rem]">
                            <Label htmlFor="recipient-teacher-search" className="text-sm">
                                Available teachers
                            </Label>
                            <TextInput
                                id="recipient-teacher-search"
                                type="search"
                                placeholder="Search name, code, or ID…"
                                icon={HiSearch}
                                value={recipientSearch}
                                onChange={(e) => setRecipientSearch(e.target.value)}
                                sizing="md"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Utilization shows load after this transfer (+{transferBundleInfo.transferLoadAdd.toFixed(1)} units).
                            </p>
                            {MAX_TRANSFER_RECIPIENTS > 1 &&
                                selectedRecipientIds.length >= MAX_TRANSFER_RECIPIENTS && (
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Maximum {MAX_TRANSFER_RECIPIENTS} teachers selected.
                                </p>
                            )}
                            <div className="max-h-[min(420px,50vh)] flex-1 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                {filteredRecipientTeachers.length === 0 ? (
                                    <p className="p-4 text-sm text-gray-500">
                                        {otherTeachersWithLoad.length === 0
                                            ? "No other teachers found."
                                            : "No teachers match your search."}
                                    </p>
                                ) : (
                                    <Table hoverable>
                                        <TableHead>
                                            <TableRow>
                                                <TableHeadCell className="w-10 px-2"></TableHeadCell>
                                                <TableHeadCell>Teacher</TableHeadCell>
                                                <TableHeadCell className="hidden sm:table-cell">Units</TableHeadCell>
                                                <TableHeadCell>After</TableHeadCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredRecipientTeachers.map(
                                                ({
                                                    teacher: t,
                                                    currentUnits,
                                                    projectedUnits,
                                                    maxUnits,
                                                    utilizationRate,
                                                    barColor,
                                                }) => {
                                                    const tid = String(t.pscs_id);
                                                    const selected = selectedRecipientIds.includes(tid);
                                                    const atCap =
                                                        MAX_TRANSFER_RECIPIENTS > 1 &&
                                                        selectedRecipientIds.length >= MAX_TRANSFER_RECIPIENTS &&
                                                        !selected;
                                                    return (
                                                        <TableRow
                                                            key={tid}
                                                            className={
                                                                atCap
                                                                    ? "cursor-not-allowed opacity-50"
                                                                    : "cursor-pointer"
                                                            }
                                                            onClick={() => {
                                                                if (!atCap) toggleRecipientSelection(tid);
                                                            }}
                                                        >
                                                            <TableCell className="pointer-events-none w-10 px-2">
                                                                <Checkbox
                                                                    checked={selected}
                                                                    disabled={atCap}
                                                                    readOnly
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium leading-tight">{t.name}</div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {t.teacher_code}
                                                                </div>
                                                                <div className="mt-1 sm:hidden">
                                                                    <span className="text-xs text-gray-500">
                                                                        {currentUnits.toFixed(1)} →{" "}
                                                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                                                            {projectedUnits.toFixed(1)}
                                                                        </span>
                                                                        /{maxUnits}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="hidden text-sm sm:table-cell">
                                                                {currentUnits.toFixed(1)} →{" "}
                                                                <span className="font-medium">
                                                                    {projectedUnits.toFixed(1)}
                                                                </span>
                                                                <span className="text-gray-500"> / {maxUnits}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex w-24 flex-col gap-0.5">
                                                                    <span className="text-[10px] text-gray-600 dark:text-gray-300">
                                                                        {utilizationRate.toFixed(0)}%
                                                                    </span>
                                                                    <Progress
                                                                        progress={Math.min(
                                                                            100,
                                                                            Math.max(0, utilizationRate)
                                                                        )}
                                                                        color={barColor}
                                                                        size="sm"
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className={"justify-end"}>
                    <Button color="alternative" type="button" disabled={transferSaving} onClick={closeTransferModal}>
                        Cancel
                    </Button>
                    <Button
                        color="blue"
                        type="button"
                        disabled={selectedRecipientIds.length === 0 || transferSaving}
                        onClick={() => void handleConfirmTransfer()}
                    >
                        {transferSaving ? (
                            <>
                                <Spinner size="sm" className="mr-2" />
                                Saving…
                            </>
                        ) : (
                            "Confirm"
                        )}
                    </Button>
                </ModalFooter>
            </Modal>

            {showToast && (
                <Toast className="fixed bottom-6 right-6 z-[100] max-w-md shadow-lg">
                    <div
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            toastOk
                                ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                        }`}
                    >
                        {toastOk ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 text-sm font-normal text-gray-700 dark:text-gray-200">{toastMessage}</div>
                    <ToastToggle onDismiss={() => setShowToast(false)} />
                </Toast>
            )}
        </div>
    )
}