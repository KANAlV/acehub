"use client";

import React, { useEffect, useState, use } from "react";
import {
    Card, Button, Spinner, Label, Progress,
    Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow,
    Badge, Tooltip
} from "flowbite-react";
import {
    HiUserGroup, HiArrowLeft, HiClock, HiBookOpen, HiCalendar,
    HiTrendingUp, HiTrendingDown, HiCheckCircle, HiExclamationCircle
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import {
    fetchScheduleDetails, fetchTeachers, fetchAllSubjects, fetchSchedulesList,
    fetchSystemSettings
} from "services/userService";
import { getMaxUnitsSync, getOverloadMaxSync, getPrepLimitSync } from "@/lib/teachingLoadUtils";

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
    const [teacher, setTeacher] = useState<any>(null);
    const [scheduleEntries, setScheduleEntries] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [scheduleName, setScheduleName] = useState("");
    const [systemSettings, setSystemSettings] = useState<any>(null);

    useEffect(() => {
        const loadTeacherData = async () => {
            setLoading(true);
            try {
                // Fetch teacher data
                const teachers = await fetchTeachers("", 1);
                const foundTeacher = teachers.find((t: any) => t.pscs_id === teacherId);
                if (!foundTeacher) {
                    router.push(`/schedules/generated_schedule/${id}`);
                    return;
                }
                setTeacher(foundTeacher);

                // Fetch schedule entries and subjects
                const [entries, subjects, scheduleList, settings] = await Promise.all([
                    fetchScheduleDetails(id),
                    fetchAllSubjects(),
                    fetchSchedulesList(),
                    fetchSystemSettings()
                ]);

                setAllSubjects(subjects);
                setSystemSettings(settings);

                const scheduleMeta = scheduleList.find((s: any) => s.id === id);
                if (scheduleMeta) {
                    setScheduleName(scheduleMeta.name);
                }

                // Filter entries for this teacher
                const teacherEntries = entries.filter((entry: any) => entry.teacher_id === teacherId);
                setScheduleEntries(teacherEntries);

            } catch (error) {
                console.error("Error loading teacher data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadTeacherData();
    }, [id, teacherId, router]);

    if (loading) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl"/>
                </div>
            </div>
        );
    }

    if (!teacher) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="text-center text-gray-500">
                    Teacher not found
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
                    <Button color="gray" size="sm" onClick={() => router.push(`/schedules/generated_schedule/${id}`)}>
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
                                                     className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                                                    <div className="font-medium">
                                                        {subject?.course_name || entry.subject_id}
                                                    </div>
                                                    <div className="text-gray-500">
                                                        {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                                                    </div>
                                                    <div className="text-gray-400">
                                                        Room: {entry.room_id} • Section: {entry.section_id}
                                                    </div>
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
        </div>
    )
}