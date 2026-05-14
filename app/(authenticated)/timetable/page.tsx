"use client";

import React, { useEffect, useState } from "react";
import {
    Card, Button, Spinner, Label, Select
} from "flowbite-react";
import { HiArrowLeft, HiExclamation } from "react-icons/hi";
import { useRouter } from "next/navigation";
import {
    getDisplay,
    fetchScheduleDetails,
    fetchTeachers,
    getAllRoomsData,
    fetchSchedulesList,
    fetchAllSubjects
} from "@/services/userService";

/* ================= CONSTANTS ================= */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const START_MIN = 7 * 60;
const END_MIN = 20 * 60;
const SLOT = 30;
const SLOT_HEIGHT = 48;

const TIME_SLOTS: number[] = [];
for (let t = START_MIN; t < END_MIN; t += SLOT) TIME_SLOTS.push(t);

function formatTime(min: number) {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function TimetableViewer() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
    const [scheduleName, setScheduleName] = useState("No Active Schedule");

    // Entity Data
    const [rooms, setRooms] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);

    // View State
    const [viewMode, setViewMode] = useState<"sections" | "rooms" | "teachers">("sections");
    const [selectedRoom, setSelectedRoom] = useState<string>("all");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [selectedTeacher, setSelectedTeacher] = useState<string>("");
    const [uniqueVirtualSections, setUniqueVirtualSections] = useState<string[]>([]);


    const loadTimetableData = async () => {
        setLoading(true);
        try {
            const rawDisplayId = await getDisplay();
            const displayId = String(rawDisplayId).replace(/^"|"$/g, '');

            if (!displayId || displayId === "null") {
                setLoading(false);
                return;
            }

            setActiveScheduleId(displayId);

            const [details, teacherData, roomData, subjectData, list] = await Promise.all([
                fetchScheduleDetails(displayId),
                fetchTeachers("", 1, "All"),
                getAllRoomsData(),
                fetchAllSubjects(),
                fetchSchedulesList()
            ]);

            const meta = list.find((s: any) => String(s.id) === String(displayId));
            if (meta) setScheduleName(meta.name);

            const mappedEntries = details.map((e: any) => ({
                id: e.id,
                subjectId: e.subject_id,
                teacherId: e.teacher_id,
                roomId: e.room_id.toString(),
                sectionId: e.section_id,
                day: e.day,
                start: e.start_time,
                end: e.end_time
            }));
            setSchedules(mappedEntries);

            const vSections = Array.from(new Set(mappedEntries.map((e: any) => e.sectionId)));
            setUniqueVirtualSections(vSections as string[]);

            setTeachers(Array.isArray(teacherData) ? teacherData : (teacherData as any)?.data || []);
            setRooms(roomData);
            setAllSubjects(subjectData);

        } catch (error) {
            console.error("Timetable Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTimetableData(); }, []);

    const getSubjectByCode = (code: string) => allSubjects.find(s => s.course_code === code);
    const getTeacher = (pscsId: string) => teachers.find(t => t.pscs_id === pscsId);
    const getRoom = (roomId: string) => rooms.find(r => r.room_id.toString() === roomId);

    const renderTimetable = () => {
        const filterValue = viewMode === "rooms" ? selectedRoom :
            viewMode === "teachers" ? selectedTeacher : selectedSection;

        if (!filterValue) return <div className="p-12 text-center italic text-gray-400">Select a context to view the timetable</div>;

        return (
            <>
                <div className="flex items-center gap-4 mb-3 text-xs">
                    <span className="font-bold text-gray-500">Legend:</span>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-600 rounded"></div>
                        <span className="text-gray-600 dark:text-gray-400">Active (in current context)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-violet-500 rounded"></div>
                        <span className="text-gray-600 dark:text-gray-400">Context mismatch (different room/section)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-300 rounded opacity-30"></div>
                        <span className="text-gray-600 dark:text-gray-400">Inactive (not in current context)</span>
                    </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                    <div className="grid grid-cols-[80px_repeat(6,1fr)] bg-gray-50 dark:bg-gray-800 border-b border-gray-200">
                        <div className="border-r border-gray-200" />
                        {DAYS.map(d => <div key={d} className="py-2 text-center font-bold text-xs">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-[80px_repeat(6,1fr)] max-h-[600px] overflow-y-auto relative text-gray-900 dark:text-white">
                        <div className="bg-gray-50 dark:bg-gray-800 sticky left-0 z-20 border-r border-gray-200">
                            {TIME_SLOTS.map(t => (
                                <div key={t} style={{ height: SLOT_HEIGHT }} className="flex items-center justify-center text-[10px] text-gray-400 border-b border-gray-100">{formatTime(t)}</div>
                            ))}
                        </div>
                        {DAYS.map(day => {
                            return (
                                <div key={day} className="relative border-r border-gray-100 last:border-r-0" style={{ height: TIME_SLOTS.length * SLOT_HEIGHT }}>
                                    {TIME_SLOTS.map((_, i) => <div key={i} className="absolute left-0 right-0 border-t border-gray-50 dark:border-gray-800" style={{ top: i * SLOT_HEIGHT }} />)}

                                    {schedules.filter(s => s.day === day && (
                                        (viewMode === "sections" && (s.sectionId === selectedSection || (selectedRoom !== "all" && s.roomId === selectedRoom))) ||
                                        (viewMode === "rooms" && (s.roomId === selectedRoom || (selectedSection !== "all" && s.sectionId === selectedSection))) ||
                                        (viewMode === "teachers" && s.teacherId === selectedTeacher)
                                    )).map(s => {
                                        const isActive = (viewMode === "sections" && s.sectionId === selectedSection) ||
                                            (viewMode === "rooms" && s.roomId === selectedRoom) ||
                                            (viewMode === "teachers" && s.teacherId === selectedTeacher);

                                        const top = ((s.start - START_MIN) / SLOT) * SLOT_HEIGHT;
                                        const height = ((s.end - s.start) / SLOT) * SLOT_HEIGHT;
                                        const sub = getSubjectByCode(s.subjectId);
                                        const tea = getTeacher(s.teacherId);
                                        const rom = getRoom(s.roomId);

                                        return (
                                            <div key={s.id}
                                                 className={`absolute left-0.5 right-0.5 text-[10px] rounded p-1 shadow shadow-black/10 transition-all ${
                                                     !isActive ? "bg-gray-300 text-gray-500 opacity-30 z-0" :
                                                         (viewMode === "sections" && s.roomId !== selectedRoom && selectedRoom !== "all") || (viewMode === "rooms" && s.sectionId !== selectedSection && selectedSection !== "all") ? "bg-violet-500 text-white z-10" : "bg-blue-600 text-white z-10"
                                                 }`} style={{ top, height }}>
                                                <div className="font-bold truncate">{sub?.course_name || s.subjectId}</div>
                                                <div className="opacity-80 truncate">{tea?.name || 'No Teacher'}</div>
                                                <div className="opacity-80 truncate">{rom?.room_name}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </>
        );
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Spinner size="xl" /></div>;

    if (!activeScheduleId) return (
        <Card className="m-8 text-center max-w-2xl mx-auto">
            <HiExclamation className="mx-auto h-12 w-12 text-yellow-400" />
            <h3 className="text-xl font-bold mt-4">No Active Schedule Set</h3>
            <Button className="mt-4 mx-auto" onClick={() => router.push('/schedules')}>Go to Schedules</Button>
        </Card>
    );

    return (
        <div className="p-8 space-y-6 h-full w-full overflow-y-auto font-sans">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <Button color="gray" size="sm" onClick={() => router.push('/dashboard')}><HiArrowLeft /></Button>
                    <div>
                        <h1 className="text-xl font-black truncate max-w-xs">{scheduleName || "Unnamed Schedule"}</h1>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Timetable Viewer</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-none shadow-sm">
                        <Label className="text-xs font-bold uppercase text-gray-400">View Mode</Label>
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {(["sections", "rooms", "teachers"] as const).map(m => (
                                <button key={m} onClick={() => setViewMode(m)} className={`flex-1 py-1 text-[10px] font-bold rounded ${viewMode === m ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm" : "text-gray-500"}`}>{m.toUpperCase()}</button>
                            ))}
                        </div>

                        <div className="space-y-3 mt-4">
                            {viewMode === "sections" && (
                                <>
                                    <div><Label>Context Section</Label><Select sizing="sm" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}><option value="">Select Section</option>{uniqueVirtualSections.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                                    <div><Label>Target Room (Base)</Label><Select sizing="sm" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}><option value="all">Show All Rooms (Overlay)</option>{rooms.map(r => <option key={r.room_id} value={r.room_id.toString()}>{r.room_name}</option>)}</Select></div>
                                </>
                            )}
                            {viewMode === "rooms" && (
                                <>
                                    <div><Label>Context Room</Label><Select sizing="sm" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}><option value="">Select Room</option>{rooms.map(r => <option key={r.room_id} value={r.room_id.toString()}>{r.room_name}</option>)}</Select></div>
                                    <div><Label>Focus Section</Label><Select sizing="sm" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}><option value="all">Show All Sections (Overlay)</option>{uniqueVirtualSections.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                                </>
                            )}
                            {viewMode === "teachers" && (
                                <div><Label>Context Teacher</Label><Select sizing="sm" value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}><option value="">Select Teacher</option>{teachers.map(t => <option key={t.pscs_id} value={t.pscs_id}>{t.name}</option>)}</Select></div>
                            )}
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-3">
                    {renderTimetable()}
                </div>
            </div>
        </div>
    );
}