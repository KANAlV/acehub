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
    fetchSchedulesList,
    fetchSystemSettings, getCurrentUser,
    getTeacherScheduleMetrics,
    fetchUserPermissions
} from "@/services/userService";
import { getOverloadMaxSync, getPrepLimitSync } from "@/lib/teachingLoadUtils";

type Metrics =
{
    totalTeachers: number;
    activeTeachers: number;
    totalUnitsAssigned: number;
    averageUtilization: number;
    teacherLoads: Record<string, any>[];
    activeRooms: number;
    activeSections: number;
    totalEntries: number;
}

export default function DashboardSummary() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<Metrics>();

    const [loading, setLoading] = useState(true);
    const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
    const [scheduleName, setScheduleName] = useState("No Active Schedule");

    const [teachers, setTeachers] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [systemSettings, setSystemSettings] = useState<any>(null);
    const [userPerms, setUserPerms] = useState<any>(null);

    useEffect(() => {
        async function initPermissions() {
            try {
                const uRole = await fetchUserPermissions();
                setUserPerms(uRole); // Now safely storing the actual object data!
            } catch (error) {
                console.error("Failed to load user permissions:", error);
            }
        }
        initPermissions();
    }, []);

    // Logic for max units as defined in your reference
    const getMaxUnits = (employmentType: string): number => {
        const type = String(employmentType || "").toLowerCase();
        if (type === "regular" || type === "ft" || type === "full-time") return 24;
        if (type === "ptfl" || type === "ftpt") return 18;
        if (type === "pt" || type === "part-time") return 12;
        if (type === "proby") return 20;
        return 24;
    };

    async function fetchFacultyAnalytics(scheduleId: string) {
            try {
                if (!scheduleId) return null;
    
                // Calls your existing DB metric extractor directly
                const data = await getTeacherScheduleMetrics(scheduleId);
                return data;
                
            } catch (error) {
                console.error("[USER_SERVICE_ERROR]: Failed to retrieve schedule metrics:", error);
                return null;
            }
        }

    async function getMetrics(dID){
        const res = await fetchFacultyAnalytics(dID);
        setMetrics(res);
    }

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
            getMetrics(displayId);

            const [details, teacherResponse, list, settings] = await Promise.all([
                fetchScheduleDetails(displayId),
                fetchTeachers("", 1, "All"),
                fetchSchedulesList(),
                fetchSystemSettings()
            ]);

            const processedTeachers = Array.isArray(teacherResponse)
                ? teacherResponse
                : (teacherResponse as any)?.data || [];

            const meta = list.find((s: any) => String(s.id) === String(displayId));
            if (meta) setScheduleName(meta.name);

            setSchedules(details || []);
            setTeachers(processedTeachers);
            setSystemSettings(settings);

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

    if (scheduleName != "No Active Schedule") return (
        <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{scheduleName}</h1>
                    <p className="text-sm text-gray-500 italic">Active Display ID: {activeScheduleId}</p>
                </div>
                <Button color="blue" onClick={() => userPerms?.schedules?
                        router.push(`/schedules/${activeScheduleId}/timetable`) :
                        router.push(`./timetable`)
                }>
                    {userPerms?.schedules == true ?
                        <HiPencilAlt className="mr-2 h-5 w-5" /> :
                        <HiCalendar className="mr-2 h-5 w-5" />
                    }
                    {userPerms?.schedules == true ? "Edit Timetable":"View Timetable"}
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBox label="Total Entries" value={stats.totalEntries} icon={HiCalendar} color="text-blue-500" />
                <StatBox label="Active Teachers" value={metrics?.activeTeachers ?? 0} icon={HiUserGroup} color="text-green-500" />
                <StatBox label="Subjects" value={stats.uniqueSubjects} icon={HiBookOpen} color="text-purple-500" />
                <StatBox label="Total Units" value={metrics?.totalUnitsAssigned ?? 0} icon={HiClock} color="text-orange-500" />
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Total Teachers</p>
                            <p className="font-bold text-lg">{metrics?.totalTeachers ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Active in Schedule</p>
                            <p className="font-bold text-lg text-green-600">
                                {metrics?.activeTeachers ?? 0}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Overloaded</p>
                            <p className="font-bold text-lg text-red-600">
                                {metrics?.teacherLoads ? metrics.teacherLoads.filter((t: any) => {
                                    const maxUnits = getMaxUnits(t.type);
                                    return t.load > maxUnits;
                                }).length : 0}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Total Units Assigned</p>
                            <p className="font-bold text-lg text-blue-600">{metrics?.totalUnitsAssigned ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Avg Utilization</p>
                            <p className="font-bold text-lg text-purple-600">
                                {metrics?.averageUtilization ? metrics.averageUtilization.toFixed(1) : "0.0"}%
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
                        const overloadMax = getOverloadMaxSync(systemSettings);
                        const absoluteMax = maxUnits + overloadMax;
                        const utilizationRate = maxUnits > 0 ? (teacherUnits / maxUnits) * 100 : 0;
                        const remainingUnits = maxUnits - teacherUnits;

                        let statusColor = "green";
                        let statusText = "Available";
                        if (teacherUnits > absoluteMax) { statusColor = "red"; statusText = "Overloaded"; }
                        else if (teacherUnits > maxUnits) { statusColor = "orange"; statusText = "Overloaded (Within Limit)"; }
                        else if (teacherUnits >= maxUnits * 0.95) { statusColor = "red"; statusText = "At Max Capacity"; }
                        else if (teacherUnits >= maxUnits * 0.85) { statusColor = "yellow"; statusText = "Near Capacity"; }
                        else if (teacherUnits >= maxUnits * 0.6) { statusColor = "blue"; statusText = "Moderate Load"; }

                        return (
                            <div key={teacher.pscs_id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-all"
                                 onClick={() => userPerms?.schedules? router.push(`/schedules/${activeScheduleId}/teachers/${teacher.pscs_id}`) : router.push(`./overview/${teacher.pscs_id}`) }>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-semibold text-sm">{teacher.fname} {teacher.mi ? teacher.mi + "." : ""} {teacher.sname} {teacher.suffix ? `, ${teacher.suffix}` : ""}</h4>
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
                                        <span>Absolute Max:</span><span className="font-medium text-orange-600">{absoluteMax}</span>
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

                                    {/* Show assigned subjects count */}
                                    {teacherUnits > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                Assigned Subjects: {new Set(schedules.filter(s => String(s.teacher_id) === String(teacher.pscs_id)).map(s => s.subjectId)).size}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Max Allowed: {getPrepLimitSync(teacher.employment_type, systemSettings || {})}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* View All Card */}
                    <div onClick={() => (userPerms?.schedules? router.push(`/schedules/${activeScheduleId}/teachers`) : router.push(`/overview`))}
                         className="flex items-center justify-center p-4 text-center text-gray-500 bg-transparent hover:bg-blue-500/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-md transition-all">
                        View All Teachers
                    </div>
                </div>
            </Card>
        </div>
    );
    else return (
        <div className="flex flex-col items-center justify-center w-full h-[90%] bg-gray-50 dark:bg-gray-900 px-4 text-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Schedule Set</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    The Academic Head has yet to set a schedule to display on the dashboard. Please wait till further notice
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-500 italic mb-6">
                    Thank you for your patience.
                </div>
            </div>
        </div>
    )
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