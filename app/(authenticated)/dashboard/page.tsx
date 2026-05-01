"use client";

import React, { useEffect, useState } from "react";
import {
    Card, Button, Spinner, Progress,
    Badge
} from "flowbite-react";
import {
    HiCalendar, HiUserGroup, HiBookOpen, HiClock,
    HiPencilAlt, HiExclamation
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import {
    getDisplay,
    fetchScheduleDetails,
    fetchTeachers,
    getAllRoomsData,
    fetchSchedulesList
} from "@/services/userService";

export default function DashboardSummary() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
    const [scheduleName, setScheduleName] = useState("No Active Schedule");

    const [teachers, setTeachers] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);

    // Logic for max units as defined in your reference
    const getMaxUnits = (employmentType: string): number => {
        const type = String(employmentType || "").toLowerCase();
        if (type === "regular" || type === "ft" || type === "full-time") return 24;
        if (type === "ptfl" || type === "ftpt") return 18;
        if (type === "pt" || type === "part-time") return 12;
        if (type === "proby") return 20;
        return 24;
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const rawDisplayId = await getDisplay();
            const displayId = String(rawDisplayId).replace(/^"|"$/g, '');

            if (!displayId || displayId === "null") {
                setLoading(false);
                return;
            }

            setActiveScheduleId(displayId);

            const [details, teacherResponse, list] = await Promise.all([
                fetchScheduleDetails(displayId),
                fetchTeachers("", 1, "All"),
                fetchSchedulesList()
            ]);

            const processedTeachers = Array.isArray(teacherResponse)
                ? teacherResponse
                : (teacherResponse as any)?.data || [];

            const meta = list.find((s: any) => String(s.id) === String(displayId));
            if (meta) setScheduleName(meta.name);

            setSchedules(details || []);
            setTeachers(processedTeachers);

        } catch (error) {
            console.error("Dashboard Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const stats = {
        totalEntries: schedules.length,
        uniqueTeachers: new Set(schedules.map(s => String(s.teacher_id))).size,
        uniqueSubjects: new Set(schedules.map(s => String(s.subject_id))).size,
        totalUnits: schedules.reduce((total, s) => {
            return total + (Number(s.end_time) - Number(s.start_time)) / 60;
        }, 0)
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Spinner size="xl" /></div>;

    if (!activeScheduleId) return (
        <Card className="m-8 text-center max-w-2xl mx-auto">
            <HiExclamation className="mx-auto h-12 w-12 text-yellow-400" />
            <h3 className="text-xl font-bold mt-4">No Dashboard Display Set</h3>
            <Button className="mt-4 mx-auto" onClick={() => router.push('/schedules')}>Go to Schedules</Button>
        </Card>
    );

    return (
        <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{scheduleName}</h1>
                    <p className="text-sm text-gray-500 italic">Active Display ID: {activeScheduleId}</p>
                </div>
                <Button color="blue" onClick={() => router.push(`/schedules/${activeScheduleId}/timetable`)}>
                    <HiPencilAlt className="mr-2 h-5 w-5" /> Edit Full Timetable
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBox label="Total Entries" value={stats.totalEntries} icon={HiCalendar} color="text-blue-500" />
                <StatBox label="Active Teachers" value={stats.uniqueTeachers} icon={HiUserGroup} color="text-green-500" />
                <StatBox label="Subjects" value={stats.uniqueSubjects} icon={HiBookOpen} color="text-purple-500" />
                <StatBox label="Total Units" value={stats.totalUnits.toFixed(1)} icon={HiClock} color="text-orange-500" />
            </div>

            {/* REPLICATED TEACHER ANALYSIS SECTION */}
            <Card className="border-none shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <HiUserGroup className="h-5 w-5" /> Teacher Analysis
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Click on a teacher to view detailed analysis
                    </p>
                </div>

                {/* Blue Summary Header */}
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-sm mb-3 text-blue-800 dark:text-blue-200">Teacher Workload Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Total Teachers</p>
                            <p className="font-bold text-lg">{teachers.length}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Active in Schedule</p>
                            <p className="font-bold text-lg text-green-600">
                                {teachers.filter(t => schedules.some(s => String(s.teacher_id) === String(t.pscs_id))).length}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Total Units Assigned</p>
                            <p className="font-bold text-lg text-blue-600">{stats.totalUnits.toFixed(1)}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Avg Utilization</p>
                            <p className="font-bold text-lg text-purple-600">
                                {teachers.length > 0 ? (teachers.reduce((avg, t) => {
                                    const tUnits = schedules.reduce((acc, s) => String(s.teacher_id) === String(t.pscs_id) ? acc + (Number(s.end_time) - Number(s.start_time))/60 : acc, 0);
                                    const max = getMaxUnits(t.employment_type);
                                    return avg + (max > 0 ? (tUnits / max) * 100 : 0);
                                }, 0) / teachers.length).toFixed(1) : 0}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachers.slice(0, 5).map(teacher => {
                        const teacherUnits = schedules.reduce((total, s) => {
                            if (String(s.teacher_id) === String(teacher.pscs_id)) {
                                return total + (Number(s.end_time) - Number(s.start_time)) / 60;
                            }
                            return total;
                        }, 0);

                        const maxUnits = getMaxUnits(teacher.employment_type);
                        const utilizationRate = maxUnits > 0 ? (teacherUnits / maxUnits) * 100 : 0;
                        const remainingUnits = maxUnits - teacherUnits;

                        let statusColor = "green";
                        let statusText = "Available";
                        if (teacherUnits > maxUnits) { statusColor = "red"; statusText = "Overloaded"; }
                        else if (teacherUnits >= maxUnits * 0.95) { statusColor = "red"; statusText = "At Max Capacity"; }
                        else if (teacherUnits >= maxUnits * 0.85) { statusColor = "yellow"; statusText = "Near Capacity"; }
                        else if (teacherUnits >= maxUnits * 0.6) { statusColor = "blue"; statusText = "Moderate Load"; }

                        return (
                            <div key={teacher.pscs_id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-all"
                                 onClick={() => router.push(`/schedules/${activeScheduleId}/teachers/${teacher.pscs_id}`)}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-semibold text-sm">{teacher.name}</h4>
                                        <p className="text-xs text-gray-500">{teacher.pscs_id}</p>
                                    </div>
                                    <Badge color={statusColor} size="sm">{statusText}</Badge>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span>Current Units:</span><span className="font-medium">{teacherUnits.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span>Max Units:</span><span className="font-medium">{maxUnits}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span>Available:</span>
                                        <span className={`font-medium ${remainingUnits >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {remainingUnits >= 0 ? '+' : ''}{remainingUnits.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="mt-3">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>Utilization</span><span>{utilizationRate.toFixed(1)}%</span>
                                        </div>
                                        <Progress progress={Math.min(100, Math.max(0, utilizationRate))} color={statusColor} size="sm" className="h-2" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* View All Card */}
                    <div onClick={() => router.push(`/maintenance`)}
                         className="flex items-center justify-center p-4 text-center text-gray-500 bg-transparent hover:bg-blue-500/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-md transition-all">
                        View All Teachers
                    </div>
                </div>
            </Card>
        </div>
    );
}

function StatBox({ label, value, icon: Icon, color }: any) {
    return (
        <Card className="border-none shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                <Icon className={`h-8 w-8 ${color}`} />
            </div>
        </Card>
    );
}