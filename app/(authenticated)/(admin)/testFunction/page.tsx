"use client";

import React, { useEffect, useState } from "react";
import {
    Tooltip, Modal, ModalHeader, ModalBody, ModalFooter, Button,
    Toast, ToastToggle, Progress, Spinner, Label, Select, TextInput, Card
} from "flowbite-react";
import {HiExclamation, HiCheck, HiOutlineExclamationCircle, HiClock, HiPlus, HiOutlineTrash} from "react-icons/hi";

/* ================= TYPES ================= */

type Subject = {
    id: string;
    name: string;
    units: number;
    teacherIds: string[];
};

type Teacher = {
    id: string;
    name: string;
};

type Room = {
    id: string;
    name: string;
};

type SectionSubject = {
    subjectId: string;
    teacherId: string;
};

type Section = {
    id: string;
    name: string;
    subjects: SectionSubject[];
};

type Schedule = {
    id: string;
    subjectId: string;
    teacherId: string;
    roomId: string;
    sectionId: string;
    day: string;
    start: number;
    end: number;
};

/* ================= CONSTANTS ================= */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const START_MIN = 7 * 60;
const END_MIN = 20 * 60;
const SLOT = 30;
const SLOT_HEIGHT = 48;

/* generate time slots */
const TIME_SLOTS: number[] = [];
for (let t = START_MIN; t < END_MIN; t += SLOT) TIME_SLOTS.push(t);

/* ================= TIME FORMAT ================= */

function formatTime(min: number) {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/* ================= PAGE ================= */

export default function Page() {

    /* ================= STATE ================= */

    const [mainTab, setMainTab] = useState<
        "subjects" | "teachers" | "grade-sections" | "rooms" | "schedules"
    >("subjects");

    const [scheduleSubTab, setScheduleSubTab] = 
        useState<"sections" | "rooms" | "teachers">("sections")

    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<string>();

    const [selectedRoom, setSelectedRoom] = useState<string>();
    const [selectedSection, setSelectedSection] = useState<string>();

    const [newSubject, setNewSubject] = useState("");
    const [newUnits, setNewUnits] = useState(3);
    const [newTeacher, setNewTeacher] = useState("");
    const [newSection, setNewSection] = useState("");

    const [resizingId, setResizingId] = useState<string | null>(null);

    const [floorCount, setFloorCount] = useState(1);
    const [roomsPerFloor, setRoomsPerFloor] = useState(1);

    // UI States for Flowbite Modals/Toasts
    const [conflictInfo, setConflictInfo] = useState<{ message: string, details: string } | null>(null);
    const [moveConfirmInfo, setMoveConfirmInfo] = useState<{ old: Schedule, updated: Schedule } | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [progress, setProgress] = useState(100);

    /* ================= HELPERS ================= */

    const getSubject = (id: string) =>
        subjects.find((s) => s.id === id)!;

    const getTeacher = (id: string) =>
        teachers.find((t) => t.id === id)!;

    const teacherUnits = (teacherId: string) =>
        subjects
            .filter((s) => s.teacherIds.includes(teacherId))
            .reduce((sum, s) => sum + s.units, 0);

    const triggerNotification = (msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
        setProgress(100);
    };

    useEffect(() => {
        if (showToast) {
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 50);
            const timer = setTimeout(() => setShowToast(false), 2500);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [showToast]);

    /* ================= CONFLICT CHECK ================= */

    const checkConflict = (candidate: Schedule, showAlert = true): boolean =>
    {
        for (const s of schedules)
        {
            if (s.id === candidate.id) continue;

            const overlap =
                s.day === candidate.day &&
                !(candidate.end <= s.start ||
                    candidate.start >= s.end);

            if (!overlap) continue;

            let type: "room" | "teacher" | "section" | null = null;

            if (s.roomId === candidate.roomId)
                type = "room";

            else if (s.teacherId === candidate.teacherId)
                type = "teacher";

            else if (s.sectionId === candidate.sectionId)
                type = "section";

            if (!type) continue;

            if (showAlert)
            {
                const subject = getSubject(s.subjectId);
                const teacher = getTeacher(s.teacherId);
                const room = rooms.find(r => r.id === s.roomId);
                const section = sections.find(sec => sec.id === s.sectionId);

                let message = "";
                let footerDetails = "";

                if (type === "teacher")
                {
                    message = `Teacher ${teacher.name} already has a schedule`;
                    footerDetails = `Room: ${room?.name} • Section: ${section?.name}`;
                }
                else if (type === "room")
                {
                    message = `Room ${room?.name} is already occupied`;
                    footerDetails = `Section: ${section?.name} • Teacher: ${teacher.name}`;
                }
                else if (type === "section")
                {
                    message = `Section ${section?.name} already has a schedule`;
                    footerDetails = `Teacher: ${teacher.name} • Room: ${room?.name}`;
                }

                setConflictInfo({
                    message,
                    details: `${subject.name} (${formatTime(s.start)} - ${formatTime(s.end)}) | ${footerDetails}`
                });
            }
            return true;
        }
        return false;
    };

    /* ================= DRAG ================= */

    const dragSubjectTeacher =
        (subjectId: string, teacherId: string) =>
            (e: React.DragEvent<HTMLDivElement>) => {
                e.dataTransfer.setData(
                    "text",
                    JSON.stringify({
                        type: "new",
                        subjectId,
                        teacherId,
                    })
                );
            };

    const dragSchedule =
        (scheduleId: string) =>
            (e: React.DragEvent<HTMLDivElement>) => {
                e.dataTransfer.setData(
                    "text",
                    JSON.stringify({
                        type: "move",
                        scheduleId,
                    })
                );
            };

    /* ================= DROP ================= */

    const dropSchedule =
        (day: string, startMin: number) =>
            (e: React.DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                const data = JSON.parse(e.dataTransfer.getData("text"));

                /* MOVE EXISTING */
                if (data.type === "move") {
                    const old = schedules.find(s => s.id === data.scheduleId);
                    if (!old) return;

                    const duration = old.end - old.start;

                    const updated: Schedule = {
                        ...old,
                        day,
                        start: startMin,
                        end: startMin + duration,
                        roomId: scheduleSubTab === "sections" ? selectedRoom ?? old.roomId : old.roomId,
                        sectionId: scheduleSubTab === "sections" ? selectedSection ?? old.sectionId : old.sectionId,
                        teacherId: old.teacherId
                    };

                    const isOtherRoomForSection =
                        scheduleSubTab === "sections" &&
                        old.sectionId === selectedSection &&
                        old.roomId !== selectedRoom;

                    if (isOtherRoomForSection) {
                        setMoveConfirmInfo({ old, updated });
                        return;
                    }

                    if (checkConflict(updated)) return;

                    setSchedules(prev => prev.map(s => (s.id === old.id ? updated : s)));
                    triggerNotification("Moved successfully");
                }

                /* CREATE NEW */
                if (data.type === "new")
                {
                    if (scheduleSubTab === "teachers") {
                        setConflictInfo({ message: "Action Restricted", details: "Please create schedules in Section or Room view mode." });
                        return;
                    }

                    const subject = getSubject(data.subjectId);
                    const roomId = selectedRoom;
                    const sectionId = selectedSection;

                    if (!roomId || !sectionId) {
                        setConflictInfo({ message: "Incomplete Selection", details: "Please select both a room and a section first." });
                        return;
                    }

                    const newSchedule: Schedule = {
                        id: crypto.randomUUID(),
                        subjectId: subject.id,
                        teacherId: data.teacherId,
                        day,
                        start: startMin,
                        end: startMin + SLOT * 2,
                        roomId,
                        sectionId,
                    };

                    if (checkConflict(newSchedule)) return;

                    setSchedules(prev => [...prev, newSchedule]);
                    triggerNotification("Added successfully");
                }
            };

    const confirmMove = () => {
        if (!moveConfirmInfo) return;
        const { old, updated } = moveConfirmInfo;

        if (checkConflict(updated)) {
            setMoveConfirmInfo(null);
            return;
        }

        setSchedules(prev => prev.map(s => (s.id === old.id ? updated : s)));
        setMoveConfirmInfo(null);
        triggerNotification("Moved successfully");
    };


    /* ================= RESIZE ================= */

    const handleResizeMouseDown = (
        e: React.MouseEvent,
        schedule: Schedule
    )=> {
        e.stopPropagation();
        setResizingId(schedule.id);

        const startY = e.clientY;
        const startEnd = schedule.end;

        const onMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientY - startY;
            const slots = Math.round(delta / SLOT_HEIGHT);
            const newEnd = startEnd + slots * SLOT;

            if (newEnd <= schedule.start + SLOT) return;

            const updated = { ...schedule, end: newEnd };

            if (checkConflict(updated, false)) return;

            setSchedules(prev =>
                prev.map(s => s.id === schedule.id ? updated : s)
            );
        };

        const onUp = () => {
            setResizingId(null);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    /* ================= TIMETABLE ================= */

    const renderTimetable = () => {

        const filterValue =
            scheduleSubTab === "rooms"
                ? selectedRoom
                : selectedSection;

        if (!filterValue)
            return <div className="text-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg italic text-gray-500">Select an item to view timetable</div>;

        const totalHeight =
            TIME_SLOTS.length * SLOT_HEIGHT;

        return (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                {/* HEADER */}
                <div className="grid grid-cols-[80px_repeat(6,1fr)] bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="border-r border-gray-200 dark:border-gray-700" />
                    {DAYS.map(day => (
                        <div key={day} className="py-3 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* BODY */}
                <div className="grid grid-cols-[80px_repeat(6,1fr)] max-h-[600px] overflow-y-auto relative">
                    {/* TIME COLUMN */}
                    <div className="bg-gray-50 dark:bg-gray-800 sticky left-0 z-20 border-r border-gray-200 dark:border-gray-700">
                        {TIME_SLOTS.map(t => (
                            <div key={t} style={{ height: SLOT_HEIGHT }} className="flex items-center justify-center text-[10px] font-medium text-gray-500 border-b border-gray-200 dark:border-gray-700 px-1">
                                {formatTime(t)}
                            </div>
                        ))}
                    </div>

                    {/* DAY COLUMNS */}
                    {DAYS.map(day => {
                        const daySchedules = schedules.filter(s => s.day === day);
                        return (
                            <div
                                key={day}
                                className="relative border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                                style={{ height: totalHeight }}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const y = e.clientY - rect.top;
                                    const slotIndex = Math.floor(y / SLOT_HEIGHT);
                                    const start = START_MIN + slotIndex * SLOT;
                                    dropSchedule(day, start)(e);
                                }}
                            >
                                {/* GRID LINES */}
                                {TIME_SLOTS.map((_, i) => (
                                    <div key={i} className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800" style={{ top: i * SLOT_HEIGHT }} />
                                ))}

                                {/* BLOCKS */}
                                {scheduleSubTab === "sections" &&
                                    daySchedules
                                        .filter(schedule =>
                                            schedule.sectionId === selectedSection ||
                                            schedule.roomId === selectedRoom
                                        )
                                        .map(schedule => {
                                            const isActive = schedule.sectionId === selectedSection;
                                            const isOtherRoomForSection = schedule.sectionId === selectedSection && schedule.roomId !== selectedRoom;
                                            const top = ((schedule.start - START_MIN) / SLOT) * SLOT_HEIGHT;
                                            const height = ((schedule.end - schedule.start) / SLOT) * SLOT_HEIGHT;
                                            const subject = getSubject(schedule.subjectId);
                                            const teacher = getTeacher(schedule.teacherId);
                                            const room = rooms.find(r => r.id === schedule.roomId);

                                            return (
                                                <div
                                                    key={schedule.id}
                                                    draggable={isActive && resizingId !== schedule.id}
                                                    onDragStart={isActive ? dragSchedule(schedule.id) : undefined}
                                                    className={`absolute left-1 right-1 text-[10px] rounded p-1 shadow-md select-none transition-transform active:scale-95 ${
                                                        !isActive ? "bg-gray-400 text-gray-100 opacity-40 cursor-not-allowed z-0" :
                                                        isOtherRoomForSection ? "bg-violet-500 text-white cursor-move z-10" :
                                                        "bg-blue-600 hover:bg-blue-700 text-white cursor-move z-10"
                                                    }`}
                                                    style={{ top, height }}
                                                >
                                                    <button onClick={() => setSchedules(prev => prev.filter(s => s.id !== schedule.id))} className={`absolute top-1 right-1 bg-red-600 text-white size-4 rounded-full flex items-center justify-center hover:bg-red-700 ${!isActive ? "hidden" : ""}`}>×</button>
                                                    <div className="font-bold truncate pr-4">{subject.name}</div>
                                                    <div className="opacity-90">{room?.name} | {teacher.name}</div>
                                                    <div className="opacity-75">{formatTime(schedule.start)} - {formatTime(schedule.end)}</div>
                                                    {isActive && !isOtherRoomForSection && (
                                                        <div onMouseDown={(e) => handleResizeMouseDown(e, schedule)} className="absolute bottom-0 left-0 right-0 h-1.5 bg-blue-800/50 hover:bg-blue-400 cursor-ns-resize rounded-b" />
                                                    )}
                                                </div>
                                            );
                                        })}

                                {/* TEACHER VIEW */}
                                {scheduleSubTab === "teachers" &&
                                    daySchedules
                                        .filter(schedule => schedule.teacherId === selectedTeacher)
                                        .map(schedule => {
                                            const top = ((schedule.start - START_MIN) / SLOT) * SLOT_HEIGHT;
                                            const height = ((schedule.end - schedule.start) / SLOT) * SLOT_HEIGHT;
                                            const subject = getSubject(schedule.subjectId);
                                            const room = rooms.find(r => r.id === schedule.roomId);
                                            const section = sections.find(s => s.id === schedule.sectionId);

                                            return (
                                                <div
                                                    key={schedule.id}
                                                    draggable={resizingId !== schedule.id}
                                                    onDragStart={dragSchedule(schedule.id)}
                                                    className="absolute left-1 right-1 bg-green-600 hover:bg-green-700 text-white text-[10px] rounded p-1 shadow-md cursor-move z-10"
                                                    style={{ top, height }}
                                                >
                                                    <button onClick={() => setSchedules(prev => prev.filter(s => s.id !== schedule.id))} className="absolute top-1 right-1 bg-red-600 text-white size-4 rounded-full flex items-center justify-center hover:bg-red-700">×</button>
                                                    <div className="font-bold truncate pr-4">{subject.name}</div>
                                                    <div className="opacity-90">Room: {room?.name} | {section?.name}</div>
                                                    <div className="opacity-75">{formatTime(schedule.start)} - {formatTime(schedule.end)}</div>
                                                    <div onMouseDown={(e) => handleResizeMouseDown(e, schedule)} className="absolute bottom-0 left-0 right-0 h-1.5 bg-green-800/50 hover:bg-green-400 cursor-ns-resize rounded-b" />
                                                </div>
                                            );
                                        })}

                                {/* ROOM VIEW */}
                                {scheduleSubTab === "rooms" && daySchedules
                                    .filter(schedule => schedule.roomId === selectedRoom)
                                    .map(schedule => {
                                        const isSelectedSection = schedule.sectionId === selectedSection;
                                        const top = ((schedule.start - START_MIN) / SLOT) * SLOT_HEIGHT;
                                        const height = ((schedule.end - schedule.start) / SLOT) * SLOT_HEIGHT;
                                        const subject = getSubject(schedule.subjectId);
                                        const teacher = getTeacher(schedule.teacherId);
                                        const section = sections.find(s => s.id === schedule.sectionId);

                                        return (
                                            <div
                                                key={schedule.id}
                                                draggable={resizingId !== schedule.id}
                                                onDragStart={dragSchedule(schedule.id)}
                                                className={`absolute left-1 right-1 text-[10px] rounded p-1 shadow-md select-none transition-transform active:scale-95 ${
                                                    isSelectedSection ? "bg-blue-600 hover:bg-blue-700 text-white cursor-move z-10" :
                                                    "bg-violet-500 hover:bg-violet-600 text-white cursor-move z-10"
                                                }`}
                                                style={{ top, height }}
                                            >
                                                <button onClick={() => setSchedules(prev => prev.filter(s => s.id !== schedule.id))} className="absolute top-1 right-1 bg-red-600 text-white size-4 rounded-full flex items-center justify-center hover:bg-red-700">×</button>
                                                <div className="font-bold truncate pr-4">{subject.name}</div>
                                                <div className="opacity-90">{section?.name} | {teacher.name}</div>
                                                <div className="opacity-75">{formatTime(schedule.start)} - {formatTime(schedule.end)}</div>
                                                <div onMouseDown={(e) => handleResizeMouseDown(e, schedule)} className={`absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize rounded-b ${isSelectedSection ? "bg-blue-800/50" : "bg-violet-700/50"}`} />
                                            </div>
                                        );
                                    })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    const generateRooms = () => {
        const newRooms: Room[] = [];
        for (let floor = 1; floor <= floorCount; floor++) {
            for (let num = 1; num <= roomsPerFloor; num++) {
                const roomNumber = `${floor}${num.toString().padStart(2, "0")}`;
                newRooms.push({ id: crypto.randomUUID(), name: roomNumber });
            }
        }
        setRooms(newRooms);
        triggerNotification(`Generated ${newRooms.length} rooms`);
    };

    /* ================= UI ================= */

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h1 className="text-2xl font-black text-blue-600 dark:text-blue-400">Scheduler Engine <span className="text-xs font-medium text-gray-400 ml-2">Internal Test v2.1</span></h1>
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    {(["subjects", "teachers", "grade-sections", "rooms", "schedules"] as const).map(t => (
                        <button key={t} onClick={() => setMainTab(t)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mainTab === t ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                            {t.replace('-', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* SUBJECT TAB */}
            {mainTab === "subjects" && (
                <Card className="border-none shadow-sm">
                    <div className="flex gap-4 items-end mb-6">
                        <div className="flex-1">
                            <Label>Subject Name</Label>
                            <TextInput value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. Advanced Data Structures" />
                        </div>
                        <div className="w-24">
                            <Label>Units</Label>
                            <TextInput type="number" value={newUnits} onChange={e => setNewUnits(Number(e.target.value))} />
                        </div>
                        <Button color="blue" onClick={() => { if(!newSubject) return; setSubjects([...subjects, { id:crypto.randomUUID(), name:newSubject, units:newUnits, teacherIds:[], }]); setNewSubject(""); triggerNotification("Added subject"); }}>
                            <HiPlus className="mr-2" /> Add Subject
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subjects.map(s => (
                            <div key={s.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-sm">{s.name}</div>
                                    <div className="text-xs text-gray-500">{s.units} Units</div>
                                </div>
                                <Button color="failure" size="xs" onClick={() => setSubjects(subjects.filter(sub => sub.id !== s.id))}><HiOutlineTrash /></Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ROOMS TAB */}
            {mainTab === "rooms" && (
                <Card className="border-none shadow-sm">
                    <div className="flex gap-4 items-end mb-6">
                        <div>
                            <Label>Number of Floors</Label>
                            <TextInput type="number" min="1" value={floorCount} onChange={(e) => setFloorCount(Number(e.target.value))} />
                        </div>
                        <div>
                            <Label>Rooms per Floor</Label>
                            <TextInput type="number" min="1" value={roomsPerFloor} onChange={(e) => setRoomsPerFloor(Number(e.target.value))} />
                        </div>
                        <Button color="blue" onClick={generateRooms}>Generate Layout</Button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                        {rooms.map(room => (
                            <div key={room.id} className="p-2 text-center text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                {room.name}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* TEACHERS TAB */}
            {mainTab === "teachers" && (
                <Card className="border-none shadow-sm">
                    <div className="flex gap-4 items-end mb-6">
                        <div className="flex-1">
                            <Label>Teacher Full Name</Label>
                            <TextInput value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} placeholder="e.g. Prof. Alan Turing" />
                        </div>
                        <Button color="blue" onClick={() => { if(!newTeacher) return; setTeachers([...teachers, { id: crypto.randomUUID(), name: newTeacher }]); setNewTeacher(""); triggerNotification("Added teacher"); }}>
                            <HiPlus className="mr-2" /> Add Teacher
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {teachers.map((teacher) => (
                            <div key={teacher.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-lg">{teacher.name} <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${teacherUnits(teacher.id) > 24 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>{teacherUnits(teacher.id)}/24 Max Units</span></h3>
                                    <Button color="failure" size="xs" onClick={() => setTeachers(teachers.filter(t => t.id !== teacher.id))}><HiOutlineTrash /></Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {subjects.map((subject) => {
                                        const alreadyAssigned = subject.teacherIds.includes(teacher.id);
                                        return (
                                            <Button 
                                                key={subject.id} 
                                                size="xs" 
                                                outline={!alreadyAssigned}
                                                color={alreadyAssigned ? "success" : "blue"}
                                                onClick={() => {
                                                    if (alreadyAssigned) return;
                                                    if (teacherUnits(teacher.id) + subject.units > 24) {
                                                        setConflictInfo({ message: "Load Limit Exceeded", details: `${teacher.name} cannot handle ${subject.name} as it exceeds the 24-unit maximum load.` });
                                                        return;
                                                    }
                                                    setSubjects(subjects.map((s) => s.id === subject.id ? { ...s, teacherIds: [...s.teacherIds, teacher.id] } : s));
                                                }}
                                            >
                                                {alreadyAssigned ? "✓ " : "+"}{subject.name}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* GRADE SECTIONS TAB */}
            {mainTab === "grade-sections" && (
                <Card className="border-none shadow-sm">
                    <div className="flex gap-4 items-end mb-6">
                        <div className="flex-1">
                            <Label>Section Name</Label>
                            <TextInput value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="e.g. BSIT-3A" />
                        </div>
                        <Button color="blue" onClick={() => { if(!newSection) return; setSections([...sections, { id: crypto.randomUUID(), name: newSection, subjects: [] }]); setNewSection(""); triggerNotification("Added section"); }}>
                            <HiPlus className="mr-2" /> Add Section
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {sections.map(section => (
                            <div key={section.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                                <h3 className="font-bold text-lg mb-3">{section.name}</h3>
                                <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                                    {subjects.map(subject => subject.teacherIds.map(teacherId => {
                                        const teacher = getTeacher(teacherId);
                                        const alreadyAssigned = section.subjects.some(ss => ss.subjectId === subject.id && ss.teacherId === teacherId);
                                        return (
                                            <Button 
                                                key={subject.id + teacherId} 
                                                size="xs" 
                                                outline={!alreadyAssigned}
                                                color={alreadyAssigned ? "success" : "blue"}
                                                onClick={() => {
                                                    if (alreadyAssigned) return;
                                                    setSections(prev => prev.map(sec => sec.id === section.id ? { ...sec, subjects: [...sec.subjects, { subjectId: subject.id, teacherId: teacherId }] } : sec));
                                                }}
                                            >
                                                {alreadyAssigned ? "✓ " : "+"}{subject.name} ({teacher.name})
                                            </Button>
                                        );
                                    }))}
                                </div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned Curriculum</div>
                                <div className="flex flex-wrap gap-2">
                                    {section.subjects.map(ss => {
                                        const subject = getSubject(ss.subjectId);
                                        const teacher = getTeacher(ss.teacherId);
                                        return (
                                            <div key={ss.subjectId + ss.teacherId} className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded flex items-center gap-2">
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{subject.name}</span>
                                                <span className="text-gray-400">|</span>
                                                <span>{teacher.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* SCHEDULE TAB */}
            {mainTab === "schedules" && (
                <div className="space-y-6">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {(["sections", "rooms", "teachers"] as const).map(sub => (
                                <button key={sub} onClick={() => setScheduleSubTab(sub)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${scheduleSubTab === sub ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                    {sub.toUpperCase()} VIEW
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex gap-3">
                            {scheduleSubTab === "sections" && (
                                <>
                                    <Select sizing="sm" value={selectedSection || ""} onChange={(e) => setSelectedSection(e.target.value)}>
                                        <option value="">Select Section</option>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </Select>
                                    <Select sizing="sm" value={selectedRoom || ""} onChange={(e) => setSelectedRoom(e.target.value)}>
                                        <option value="">Select Base Room</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </Select>
                                </>
                            )}
                            {scheduleSubTab === "rooms" && (
                                <>
                                    <Select sizing="sm" value={selectedRoom || ""} onChange={(e) => setSelectedRoom(e.target.value)}>
                                        <option value="">Select Room</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </Select>
                                    <Select sizing="sm" value={selectedSection || ""} onChange={(e) => setSelectedSection(e.target.value)}>
                                        <option value="">Context Section</option>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </Select>
                                </>
                            )}
                            {scheduleSubTab === "teachers" && (
                                <Select sizing="sm" value={selectedTeacher || ""} onChange={(e) => setSelectedTeacher(e.target.value)}>
                                    <option value="">Select Teacher</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </Select>
                            )}
                        </div>
                    </div>

                    <Card className="border-none shadow-sm overflow-hidden">
                        <h4 className="text-sm font-bold text-gray-400 mb-2">Curriculum Payload (Drag & Drop)</h4>
                        <div className="flex flex-wrap gap-2 mb-6 min-h-12 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                            {(() => {
                                const selected = sections.find(s => s.id === selectedSection);
                                if (!selected) return <div className="text-gray-400 text-xs flex items-center italic">Select a section to reveal assigned subjects</div>;
                                if (!selected.subjects?.length) return <div className="text-gray-400 text-xs flex items-center italic">No subjects assigned to this section</div>;
                                
                                return selected.subjects.map(ss => {
                                    const subject = getSubject(ss.subjectId);
                                    const teacher = getTeacher(ss.teacherId);
                                    if (!subject || !teacher) return null;
                                    return (
                                        <div key={ss.subjectId + "-" + ss.teacherId} draggable onDragStart={dragSubjectTeacher(ss.subjectId, ss.teacherId)} className="bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 cursor-grab active:cursor-grabbing text-xs">
                                            <div className="font-bold">{subject.name}</div>
                                            <div className="opacity-80">{teacher.name}</div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div className="flex gap-4 mb-4 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                            <div className="flex items-center gap-1"><div className="size-3 bg-blue-600 rounded" /> Active Unit</div>
                            <div className="flex items-center gap-1"><div className="size-3 bg-violet-500 rounded" /> Section Displacement</div>
                            <div className="flex items-center gap-1"><div className="size-3 bg-gray-400 rounded" /> Room Occupancy</div>
                            <div className="flex items-center gap-1"><div className="size-3 bg-green-600 rounded" /> Teacher Load</div>
                        </div>

                        {renderTimetable()}
                    </Card>
                </div>
            )}

            {/* MODALS */}
            
            {/* Conflict Alert Modal */}
            <Modal show={!!conflictInfo} size="md" onClose={() => setConflictInfo(null)} popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        <HiExclamation className="mx-auto mb-4 h-14 w-14 text-red-500" />
                        <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Schedule Conflict</h3>
                        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">{conflictInfo?.message}</p>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-xs text-left border border-gray-100 dark:border-gray-600 mb-6">
                            {conflictInfo?.details}
                        </div>
                        <Button color="red" onClick={() => setConflictInfo(null)}>Understood</Button>
                    </div>
                </ModalBody>
            </Modal>

            {/* Move Confirmation Modal */}
            <Modal show={!!moveConfirmInfo} size="md" onClose={() => setMoveConfirmInfo(null)} popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-yellow-400" />
                        <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                            Move this schedule to the new room?
                        </h3>
                        <div className="flex justify-center gap-4">
                            <Button color="success" onClick={confirmMove}>Yes, move</Button>
                            <Button color="gray" onClick={() => setMoveConfirmInfo(null)}>Cancel</Button>
                        </div>
                    </div>
                </ModalBody>
            </Modal>

            {/* TOASTS */}
            <Toast className={`fixed z-60 bottom-10 right-10 transition-all ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center">
                    <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200">
                        <HiCheck className="h-5 w-5" />
                    </div>
                    <div className="ml-3 text-sm font-normal">{toastMessage}</div>
                    <ToastToggle onDismiss={() => setShowToast(false)} />
                </div>
                <Progress progress={progress} size="sm" className="mt-2" color="green" />
            </Toast>
        </div>
    );
}
