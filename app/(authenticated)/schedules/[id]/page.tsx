"use client";

import React, { useEffect, useState, use } from "react";
import { 
    Card, Button, Spinner, Progress, 
    Badge, Toast, ToastToggle
} from "flowbite-react";
import { 
    HiCalendar, HiUserGroup, HiBookOpen, HiCheck, HiExclamation,
    HiArrowLeft, HiClock, HiChartBar, HiPencilAlt, HiTrash
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import {
    fetchScheduleDetails, getAllRoomsData, getAllProgramsData, fetchTeachers,
    fetchAllSubjects, fetchSchedulesList, deleteGeneratedSchedule, setDisplay, getDisplay
} from "services/userService";

export default function ScheduleSummary({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [loading, setLoading] = useState(true);
    const [scheduleName, setScheduleName] = useState("");
    
    // Entity Data
    const [rooms, setRooms] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    
    // Schedule Data
    const [schedules, setSchedules] = useState<any[]>([]);

    // UI State
    const [showToast, setShowToast] = useState(false);
    const [statusCode, setStatusCode] = useState("");
    const [progress, setProgress] = useState(100);

    const [currentDisplayId, setCurrentDisplayId] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // 1. Fetch the current display ID from the database on mount
    const checkCurrentDisplay = async () => {
        const activeId = await getDisplay();
        setCurrentDisplayId(activeId);
    };

    useEffect(() => {
        checkCurrentDisplay();
    }, [id]);

    // 2. Handle the update
    const handleSetDisplay = async () => {
        setIsUpdating(true);
        const result = await setDisplay(id);

        if (result.success) {
            setCurrentDisplayId(id); // Update local state to disable button immediately
        }
        setIsUpdating(false);
    };

    // 3. Determine if this button should be disabled
    const isAlreadyDisplay = currentDisplayId === id;

    // Helper function to get max units based on employment type
    const getMaxUnits = (employmentType: string): number => {
        switch (employmentType?.toLowerCase()) {
            case "regular":
            case "ft":
                return 24;
            case "ptfl":
            case "ftpt":
                return 18;
            case "pt":
            case "part-time":
                return 12;
            case "proby":
                return 20;
            default:
                return 24;
        }
    };

    const STATUS_MESSAGES = {
        "204": "Schedule deleted successfully.",
        "500": "Error occurred. Please try again."
    };

    useEffect(() => {
        if (showToast) {
            setProgress(100);
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 100);
            const timer = setTimeout(() => {
                setShowToast(false);
                setProgress(0);
            }, 5000);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [showToast]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [list, currs, subs, teachs, rms, scheduleDetails] = await Promise.all([
                fetchSchedulesList(),
                getAllProgramsData(),
                fetchAllSubjects(),
                fetchTeachers("", 1, "All"),
                getAllRoomsData(),
                fetchScheduleDetails(id)
            ]);

            const schedule = list.find((s: any) => s.id === id);
            if (schedule) {
                setScheduleName(schedule.name);
            }

            setAllSubjects(subs);
            setTeachers(teachs);
            setSections([]); // Set empty array since fetchSections doesn't exist
            setRooms(rms);
            setSchedules(scheduleDetails);

        } catch (error) {
            console.error("Error loading schedule data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this schedule? This action cannot be undone.")) {
            return;
        }

        try {
            const statusCode = await deleteGeneratedSchedule(id);
            setStatusCode(statusCode);
            setShowToast(true);
            
            if (statusCode === "204") {
                setTimeout(() => {
                    router.push("/schedules");
                }, 2000);
            }
        } catch (error) {
            console.error("Error deleting schedule:", error);
            setStatusCode("500");
            setShowToast(true);
        }
    };

    // Calculate statistics
    const stats = {
        totalEntries: schedules.length,
        uniqueTeachers: new Set(schedules.map(s => s.teacher_id)).size,
        uniqueRooms: new Set(schedules.map(s => s.room_id)).size,
        uniqueSections: new Set(schedules.map(s => s.section_id)).size,
        uniqueSubjects: new Set(schedules.map(s => s.subject_id)).size,
        totalUnits: schedules.reduce((total, s) => total + (s.end_time - s.start_time) / 60, 0)
    };

    if (loading) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 h-full w-full overflow-y-auto font-sans">
            <div className={"flex justify-between w-full"}>
                <Button color="alternative" size="sm" onClick={() => router.push("/schedules")}>
                    <HiArrowLeft />
                </Button>

                <Button
                    color={isAlreadyDisplay ? "success" : "alternative"}
                    size="sm"
                    onClick={handleSetDisplay}
                    disabled={isAlreadyDisplay || isUpdating}
                >
                    {isAlreadyDisplay ? (
                        <>
                            <HiCheck className="mr-2 h-4 w-4" />
                            Currently Displayed on Dashboard
                        </>
                    ) : (
                        "Set as Display on Dashboard"
                    )}
                </Button>
            </div>
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">{scheduleName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Schedule ID: {id} • Summary Overview
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button color="blue" size="sm" onClick={() => router.push(`${id}/timetable`)}>
                        <HiPencilAlt className="mr-2" />
                        Open Editor
                    </Button>
                    <Button color="failure" size="sm" onClick={handleDelete}>
                        <HiTrash className="mr-2" />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
                            <p className="text-2xl font-bold">{stats.totalEntries}</p>
                        </div>
                        <HiCalendar className="h-8 w-8 text-blue-500" />
                    </div>
                </Card>
                
                <Card className="border-none shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Active Teachers</p>
                            <p className="text-2xl font-bold">{stats.uniqueTeachers}</p>
                        </div>
                        <HiUserGroup className="h-8 w-8 text-green-500" />
                    </div>
                </Card>
                
                <Card className="border-none shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Subjects</p>
                            <p className="text-2xl font-bold">{stats.uniqueSubjects}</p>
                        </div>
                        <HiBookOpen className="h-8 w-8 text-purple-500" />
                    </div>
                </Card>
                
                <Card className="border-none shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Units</p>
                            <p className="text-2xl font-bold">{stats.totalUnits.toFixed(1)}</p>
                        </div>
                        <HiClock className="h-8 w-8 text-orange-500" />
                    </div>
                </Card>
            </div>

            {/* Schedule Overview */}
            <Card className="border-none shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <HiChartBar className="h-5 w-5" />
                    Schedule Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-medium mb-3">Resource Utilization</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Teachers</span>
                                <div className="flex items-center gap-2">
                                    <Progress 
                                        progress={teachers.length > 0 ? (stats.uniqueTeachers / teachers.length) * 100 : 0} 
                                        size="sm" 
                                        color="blue"
                                        className="w-20"
                                    />
                                    <span className="text-sm font-medium">
                                        {stats.uniqueTeachers}/{teachers.length}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Rooms</span>
                                <div className="flex items-center gap-2">
                                    <Progress 
                                        progress={rooms.length > 0 ? (stats.uniqueRooms / rooms.length) * 100 : 0} 
                                        size="sm" 
                                        color="green"
                                        className="w-20"
                                    />
                                    <span className="text-sm font-medium">
                                        {stats.uniqueRooms}/{rooms.length}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Sections</span>
                                <div className="flex items-center gap-2">
                                    <Progress 
                                        progress={sections.length > 0 ? (stats.uniqueSections / sections.length) * 100 : 0} 
                                        size="sm" 
                                        color="purple"
                                        className="w-20"
                                    />
                                    <span className="text-sm font-medium">
                                        {stats.uniqueSections}/{sections.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-medium mb-3">Schedule Details</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Schedule Name:</span>
                                <span className="font-medium">{scheduleName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total Units:</span>
                                <span className="font-medium">{stats.totalUnits.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Daily Average:</span>
                                <span className="font-medium">{(stats.totalUnits / 5).toFixed(1)} units/day</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Avg Class Duration:</span>
                                <span className="font-medium">
                                    {stats.totalEntries > 0 ? (stats.totalUnits / stats.totalEntries).toFixed(1) : 0} hours
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Teacher Analysis Section */}
            <Card className="border-none shadow-sm">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <HiUserGroup className="h-5 w-5" />
                        Teacher Analysis
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Click on a teacher to view detailed analysis
                    </p>
                </div>

                {/* Summary Statistics for This Schedule */}
                <div className=" mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-sm mb-3 text-blue-800 dark:text-blue-200">Teacher Workload Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Total Teachers</p>
                            <p className="font-bold text-lg">{teachers.length}</p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Active in Schedule</p>
                            <p className="font-bold text-lg text-green-600">
                                {teachers.filter(t =>
                                    schedules.some(s => s.teacher_id === t.pscs_id)
                                ).length}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Total Units Assigned</p>
                            <p className="font-bold text-lg text-blue-600">
                                {stats.totalUnits.toFixed(1)}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Avg Utilization</p>
                            <p className="font-bold text-lg text-purple-600">
                                {teachers.length > 0 ?
                                    (teachers.reduce((avg, teacher) => {
                                        const teacherUnits = schedules.reduce((total, schedule) => {
                                            if (schedule.teacher_id === teacher.pscs_id) {
                                                return total + (schedule.end_time - schedule.start_time) / 60;
                                            }
                                            return total;
                                        }, 0);
                                        const maxUnits = getMaxUnits(teacher.employment_type);
                                        return avg + (maxUnits > 0 ? (teacherUnits / maxUnits) * 100 : 0);
                                    }, 0) / teachers.length).toFixed(1) : 0}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachers.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-gray-400 italic">
                            No teachers available for analysis
                        </div>
                    ) : (
                        teachers.slice(0, 5).map(teacher => { // Limited to 5 teachers
                            // Calculate current units for this specific schedule
                            const teacherUnits = schedules.reduce((total, schedule) => {
                                if (schedule.teacher_id === teacher.pscs_id) {
                                    const durationHours = (schedule.end_time - schedule.start_time) / 60;
                                    return total + durationHours;
                                }
                                return total;
                            }, 0);

                            const maxUnits = getMaxUnits(teacher.employment_type);
                            const utilizationRate = maxUnits > 0 ? (teacherUnits / maxUnits) * 100 : 0;
                            const remainingUnits = maxUnits - teacherUnits;

                            // Debug logging (remove in production)
                            console.log(`Teacher ${teacher.name}: units=${teacherUnits}, max=${maxUnits}, type=${teacher.employment_type}, rate=${utilizationRate}%`);

                            // Determine status color based on actual capacity remaining
                            let statusColor = "green";
                            let statusText = "Available";
                            if (teacherUnits > maxUnits) {
                                statusColor = "red";
                                statusText = "Overloaded";
                            } else if (teacherUnits >= maxUnits * 0.95) {
                                statusColor = "red";
                                statusText = "At Max Capacity";
                            } else if (teacherUnits >= maxUnits * 0.85) {
                                statusColor = "yellow";
                                statusText = "Near Capacity";
                            } else if (teacherUnits >= maxUnits * 0.6) {
                                statusColor = "blue";
                                statusText = "Moderate Load";
                            }

                            return (
                                <div 
                                    key={teacher.pscs_id} 
                                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                                    onClick={() => router.push(`${id}/teachers/${teacher.pscs_id}`)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-semibold text-sm hover:text-blue-600 transition-colors">{teacher.name}</h4>
                                            <p className="text-xs text-gray-500">{teacher.pscs_id}</p>
                                            <p className="text-xs text-gray-500">{teacher.teacher_code}</p>
                                        </div>
                                        <Badge color={statusColor} size="sm">
                                            {statusText}
                                        </Badge>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span>Current Units:</span>
                                            <span className="font-medium">{teacherUnits.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Max Units:</span>
                                            <span className="font-medium">{maxUnits}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>Available:</span>
                                            <span className={`font-medium ${remainingUnits >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {remainingUnits >= 0 ? '+' : ''}{remainingUnits.toFixed(1)}
                                            </span>
                                        </div>
                                        
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Utilization</span>
                                                <span>{utilizationRate.toFixed(1)}%</span>
                                            </div>
                                            <Progress 
                                                progress={Math.min(100, Math.max(0, utilizationRate))} 
                                                color={statusColor}
                                                size="sm"
                                                className="h-2"
                                            />
                                            {utilizationRate > 100 && (
                                                <div className="text-xs text-red-500 mt-1">
                                                    Overloaded by {(utilizationRate - 100).toFixed(1)}%
                                                </div>
                                            )}
                                        </div>

                                        {/* Show assigned subjects count */}
                                        {teacherUnits > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    Assigned Subjects: {schedules.filter(s => s.teacher_id === teacher.pscs_id).length}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* View All Card */}
                    <div onClick={() => router.push(`/maintenance`)}
                         className="flex items-center justify-center
                        p-4 text-center text-gray-500
                        bg-transparent hover:bg-blue-500/20
                        border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300
                        rounded-lg  cursor-pointer hover:shadow-md transition-all
                        "
                    >
                        <div>
                            View All Teachers
                        </div>
                    </div>
                </div>
            </Card>

            {/* Toast */}
            <Toast className={`fixed z-50 bottom-10 right-10 transition-all ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-start">
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusCode.startsWith('2') ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
                        {statusCode.startsWith('2') ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 flex-1">
                        <div className="text-sm font-normal">{STATUS_MESSAGES[statusCode as keyof typeof STATUS_MESSAGES] || "Operation complete"}</div>
                        <Progress progress={progress} size="sm" className="mt-2" color={statusCode.startsWith('2') ? "green" : "red"} />
                    </div>
                    <ToastToggle onDismiss={() => {
                        setShowToast(false);
                        setProgress(0);
                    }} />
                </div>
            </Toast>
        </div>
    );
}