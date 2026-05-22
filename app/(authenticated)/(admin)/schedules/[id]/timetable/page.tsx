"use client";

import React, { useEffect, useState, use, useRef } from "react";
import { 
    Tooltip, Modal, ModalHeader, ModalBody, ModalFooter, Button, 
    Toast, ToastToggle, Progress, Spinner, Label, Select, TextInput, Card
} from "flowbite-react";
import { HiExclamation, HiCheck, HiOutlineExclamationCircle, HiSave, HiArrowLeft, HiSearch } from "react-icons/hi";
import { useRouter } from "next/navigation";
import { 
    fetchScheduleDetails, updateScheduleEntries, 
    getAllRoomsData, getAllProgramsData, fetchAllTeachers, fetchAllSubjects, 
    fetchSchedulesList 
} from "@/services/userService.ts";

/** --- Helper Component: Autocomplete Select --- **/
const AutocompleteSelect = ({
    options,
    value,
    onChange,
    placeholder,
    noOptionsMessage = "No results found"
}: {
    options: { id: string, label: string, subLabel?: string }[],
    value: string,
    onChange: (id: string) => void,
    placeholder: string,
    noOptionsMessage?: string
}) => {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.id === value);

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(query.toLowerCase()))
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <TextInput
                value={isOpen ? query : (selectedOption?.label || "")}
                placeholder={placeholder}
                onFocus={() => { setIsOpen(true); setQuery(""); }}
                onChange={(e) => setQuery(e.target.value)}
                icon={HiSearch}
                sizing="sm"
                autoComplete="off"
            />
            {isOpen && (
                <div className="absolute z-100 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filtered.length > 0 ? (
                        filtered.map(opt => (
                            <div
                                key={opt.id}
                                className="px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b last:border-0 border-gray-100 dark:border-gray-600"
                                onClick={() => {
                                    onChange(opt.id);
                                    setIsOpen(false);
                                    setQuery("");
                                }}
                            >
                                <div className="text-xs font-bold text-gray-900 dark:text-white">{opt.label}</div>
                                {opt.subLabel && <div className="text-sm text-blue-500 font-extrabold italic">{opt.subLabel}</div>}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-4 text-center text-xs text-gray-400 italic">{noOptionsMessage}</div>
                    )}
                </div>
            )}
        </div>
    );
};

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

export default function ScheduleEditor({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [loading, setLoading] = useState(true);
    const [scheduleExists, setScheduleExists] = useState<boolean | null>(null);
    const [scheduleName, setScheduleName] = useState("");
    
    // Entity Data
    const [rooms, setRooms] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    
    // Editor State
    const [schedules, setSchedules] = useState<any[]>([]);
    const [scheduleSubTab, setScheduleSubTab] = useState<"sections" | "rooms" | "teachers">("sections");
    const [selectedRoom, setSelectedRoom] = useState<string>("all");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [selectedTeacher, setSelectedTeacher] = useState<string>("");
    const [resizingId, setResizingId] = useState<string | null>(null);

    // Filter Logic Data
    const [availablePayload, setAvailablePayload] = useState<any[]>([]);
    const [uniqueVirtualSections, setUniqueVirtualSections] = useState<string[]>([]);

    // UI Feedback
    const [conflictInfo, setConflictInfo] = useState<{ message: string, details: string } | null>(null);
    const [moveConfirmInfo, setMoveConfirmInfo] = useState<{ old: any, updated: any } | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [progress, setProgress] = useState(100);

    const triggerNotification = (msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
        setProgress(100);
    };

    useEffect(() => {
        if (showToast) {
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 50);
            setTimeout(() => setShowToast(false), 2500);
            return () => clearInterval(interval);
        }
    }, [showToast]);

    const loadEditorData = async () => {
        setLoading(true);
        try {
            const [roomData, sectionData, teacherData, subjectData, scheduleList, currentEntries] = await Promise.all([
                getAllRoomsData(),
                getAllProgramsData(),
                fetchAllTeachers(),
                fetchAllSubjects(),
                fetchSchedulesList(),
                fetchScheduleDetails(id)
            ]);

            const meta = scheduleList.find((s: any) => s.id === id);
            if (meta) {
                setScheduleExists(true);
                setScheduleName(meta.name);
                const config = meta.generation_config || {};
                const selectedIds = config.subjects || [];
                const assignments = config.assignments || {};
                
                const payload = selectedIds.map((sid: string) => {
                    const sub = subjectData.find((s: any) => s.id === sid);
                    const teacherId = assignments[sid];
                    const teacher = teacherData.find((t: any) => t.pscs_id === teacherId);
                    return {
                        subjectId: sid,
                        courseCode: sub?.course_code,
                        courseName: sub?.course_name,
                        teacherId: teacherId,
                        teacherName: teacher?.name || "Unassigned"
                    };
                }).filter((p: any) => p.courseCode);
                setAvailablePayload(payload);
            } else {
                setScheduleExists(false);
                setLoading(false);
                return; // Exit early if schedule doesn't exist
            }

            setRooms(roomData);
            setSections(sectionData);
            setTeachers(teacherData);
            setAllSubjects(subjectData);

            const mappedEntries = currentEntries.map((e: any) => ({
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
            
        } catch (e) {
            console.error(e);
            setScheduleExists(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadEditorData(); }, [id]);

    const getSubjectByCode = (code: string) => allSubjects.find(s => s.course_code === code);
    const getTeacher = (pscsId: string) => teachers.find(t => t.pscs_id === pscsId);
    const getRoom = (roomId: string) => rooms.find(r => r.room_id.toString() === roomId);

    const checkConflict = (candidate: any, showAlert = true): boolean => {
        for (const s of schedules) {
            if (s.id === candidate.id) continue;
            const overlap = s.day === candidate.day && !(candidate.end <= s.start || candidate.start >= s.end);
            if (!overlap) continue;

            let type: string | null = null;
            if (s.roomId === candidate.roomId) type = "room";
            else if (s.teacherId === candidate.teacherId) type = "teacher";
            else if (s.sectionId === candidate.sectionId) type = "section";

            if (!type) continue;

            if (showAlert) {
                const sub = getSubjectByCode(s.subjectId);
                const tea = getTeacher(s.teacherId);
                const rom = getRoom(s.roomId);
                let message = "";
                if (type === "teacher") message = `Teacher ${tea?.fname + " " + (tea.mi? tea.mi + ". " : "") + tea?.sname + (tea.suffix ? " " + tea.suffix : "")} already scheduled.`;
                else if (type === "room") message = `Room ${rom?.room_name} occupied.`;
                else if (type === "section") message = `Section ${s.sectionId} already scheduled.`;
                setConflictInfo({ message, details: `${sub?.course_name || s.subjectId} (${formatTime(s.start)} - ${formatTime(s.end)})` });
            }
            return true;
        }
        return false;
    };

    const dragPayload = (courseCode: string, teacherId: string) => (e: React.DragEvent) => {
        e.dataTransfer.setData("text", JSON.stringify({ type: "new", subjectId: courseCode, teacherId }));
    };

    const dragSchedule = (scheduleId: string) => (e: React.DragEvent) => {
        e.dataTransfer.setData("text", JSON.stringify({ type: "move", scheduleId }));
    };

    const dropSchedule = (day: string, startMin: number) => (e: React.DragEvent) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData("text"));

        if (data.type === "move") {
            const old = schedules.find(s => s.id === data.scheduleId);
            if (!old) return;
            const duration = old.end - old.start;
            const updated = {
                ...old, day, start: startMin, end: startMin + duration,
                roomId: scheduleSubTab === "sections" ? (selectedRoom === "all" ? old.roomId : selectedRoom || old.roomId) : 
                        (scheduleSubTab === "rooms" ? selectedRoom : old.roomId),
                sectionId: scheduleSubTab === "sections" ? selectedSection : 
                           (scheduleSubTab === "rooms" ? (selectedSection === "all" ? old.sectionId : selectedSection) : old.sectionId),
            };

            if (scheduleSubTab === "sections" && old.sectionId === selectedSection && old.roomId !== selectedRoom && selectedRoom !== "all") {
                setMoveConfirmInfo({ old, updated });
                return;
            }

            if (checkConflict(updated)) return;
            setSchedules(prev => prev.map(s => s.id === old.id ? updated : s));
        }

        if (data.type === "new") {
            if (scheduleSubTab === "teachers") return;
            const targetRoomId = scheduleSubTab === "rooms" ? selectedRoom : (selectedRoom === "all" ? "" : selectedRoom);
            const targetSectionId = scheduleSubTab === "sections" ? selectedSection : (selectedSection === "all" ? "" : selectedSection);
            
            if (!targetRoomId || !targetSectionId) {
                setConflictInfo({ message: "Incomplete Context", details: "Select specific Room and Section first to place blocks." });
                return;
            }
            const newSched = {
                id: crypto.randomUUID(), subjectId: data.subjectId, teacherId: data.teacherId,
                day, start: startMin, end: startMin + 90, roomId: targetRoomId, sectionId: targetSectionId
            };
            if (checkConflict(newSched)) return;
            setSchedules(prev => [...prev, newSched]);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        const res = await updateScheduleEntries(id, schedules);
        if (res === "200") triggerNotification("Changes saved to database");
        setLoading(false);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, schedule: any) => {
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
            setSchedules(prev => prev.map(s => s.id === schedule.id ? updated : s));
        };
        const onUp = () => {
            setResizingId(null);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const renderTimetable = () => {
        const filterValue = scheduleSubTab === "rooms" ? selectedRoom : 
                          scheduleSubTab === "teachers" ? selectedTeacher : selectedSection;
        
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
                            <div key={day} className="relative border-r border-gray-100 last:border-r-0" style={{ height: TIME_SLOTS.length * SLOT_HEIGHT }}
                                 onDragOver={e => e.preventDefault()}
                                 onDrop={e => {
                                     const rect = e.currentTarget.getBoundingClientRect();
                                     const slotIndex = Math.floor((e.clientY - rect.top) / SLOT_HEIGHT);
                                     dropSchedule(day, START_MIN + slotIndex * SLOT)(e);
                                 }}>
                                {TIME_SLOTS.map((_, i) => <div key={i} className="absolute left-0 right-0 border-t border-gray-50 dark:border-gray-800" style={{ top: i * SLOT_HEIGHT }} />)}
                                
                                {schedules.filter(s => s.day === day && (
                                    (scheduleSubTab === "sections" && (s.sectionId === selectedSection || (selectedRoom !== "all" && s.roomId === selectedRoom))) ||
                                    (scheduleSubTab === "rooms" && (s.roomId === selectedRoom || (selectedSection !== "all" && s.sectionId === selectedSection))) ||
                                    (scheduleSubTab === "teachers" && s.teacherId === selectedTeacher)
                                )).map(s => {
                                    const isActive = (scheduleSubTab === "sections" && s.sectionId === selectedSection) || 
                                                     (scheduleSubTab === "rooms" && s.roomId === selectedRoom) ||
                                                     (scheduleSubTab === "teachers" && s.teacherId === selectedTeacher);
                                    
                                    const top = ((s.start - START_MIN) / SLOT) * SLOT_HEIGHT;
                                    const height = ((s.end - s.start) / SLOT) * SLOT_HEIGHT;
                                    const sub = getSubjectByCode(s.subjectId);
                                    const tea = getTeacher(s.teacherId);
                                    const rom = getRoom(s.roomId);

                                    return (
                                        <div key={s.id} draggable={isActive && resizingId !== s.id} onDragStart={dragSchedule(s.id)}
                                             className={`absolute left-0.5 right-0.5 text-[10px] rounded p-1 shadow shadow-black/10 transition-all ${
                                                 !isActive ? "bg-gray-300 text-gray-500 opacity-30 z-0" : 
                                                 (scheduleSubTab === "sections" && s.roomId !== selectedRoom && selectedRoom !== "all") || (scheduleSubTab === "rooms" && s.sectionId !== selectedSection && selectedSection !== "all") ? "bg-violet-500 text-white z-10" : "bg-blue-600 text-white z-10"
                                             }`} style={{ top, height }}>
                                            <button onClick={() => setSchedules(prev => prev.filter(x => x.id !== s.id))} className={`absolute top-0.5 right-0.5 text-[14px] leading-none ${!isActive ? 'hidden' : ''}`}>×</button>
                                            <div className="font-bold truncate">{sub?.course_name || s.subjectId}</div>
                                            <div className="opacity-80 truncate">{tea?.fname + " " + (tea.mi? tea.mi + ". " : "") + tea?.sname + (tea.suffix ? " " + tea.suffix : "") || 'No Teacher'}</div>
                                            <div className="opacity-80 truncate">{rom?.room_name}</div>
                                            {isActive && <div onMouseDown={e => handleResizeMouseDown(e, s)} className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />}
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

    return (
        <div className="p-8 space-y-6 h-full w-full overflow-y-auto font-sans">
            {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"><Spinner size="xl" /></div>}

            {scheduleExists === false && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                            <HiExclamation className="h-8 w-8 text-red-600 dark:text-red-400" />
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
            )}

            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <Button color="gray" size="sm" onClick={() => router.push(`/schedules/${id}`)}><HiArrowLeft /></Button>
                    <div>
                        <h1 className="text-xl font-black truncate max-w-xs">{scheduleName || "Unnamed Schedule"}</h1>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Live Visual Editor</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button color="blue" onClick={handleSave}><HiSave className="mr-2" /> Save Changes</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-none shadow-sm">
                        <Label className="text-xs font-bold uppercase text-gray-400">View Mode</Label>
                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {(["sections", "rooms", "teachers"] as const).map(m => (
                                <button key={m} onClick={() => setScheduleSubTab(m)} className={`flex-1 py-1 text-[10px] font-bold rounded ${scheduleSubTab === m ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm" : "text-gray-500"}`}>{m.toUpperCase()}</button>
                            ))}
                        </div>

                        <div className="space-y-3 mt-4">
                            {scheduleSubTab === "sections" && (
                                <>
                                    <div><Label>Context Section</Label><Select sizing="sm" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}><option value="">Select Section</option>{uniqueVirtualSections.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                                    <div><Label>Target Room (Base)</Label><Select sizing="sm" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}><option value="all">Show All Rooms (Overlay)</option>{rooms.map(r => <option key={r.room_id} value={r.room_id.toString()}>{r.room_name}</option>)}</Select></div>
                                </>
                            )}
                            {scheduleSubTab === "rooms" && (
                                <>
                                    <div><Label>Context Room</Label><Select sizing="sm" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}><option value="">Select Room</option>{rooms.map(r => <option key={r.room_id} value={r.room_id.toString()}>{r.room_name}</option>)}</Select></div>
                                    <div><Label>Focus Section</Label><Select sizing="sm" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}><option value="all">Show All Sections (Overlay)</option>{uniqueVirtualSections.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                                </>
                            )}
                            {scheduleSubTab === "teachers" && (
                                <div>
                                    <Label>Select Teacher</Label>
                                    <AutocompleteSelect 
                                        options={teachers.map(t => ({ 
                                            id: t.pscs_id, 
                                            label: t.fname + " " + (t.mi? t.mi + ". " : "")  + t.sname + (t.suffix ? " " + t.suffix : ""),
                                            subLabel: `${t.pscs_id} | ${t.teacher_code}` 
                                        }))}
                                        value={selectedTeacher}
                                        onChange={setSelectedTeacher}
                                        placeholder="Search Teachers..."
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm text-gray-900 dark:text-white">
                        <Label className="text-xs font-bold uppercase text-gray-400">Generation Payload</Label>
                        <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto pr-1 text-gray-900 dark:text-white">
                            {availablePayload.length === 0 ? (
                                <div className="text-xs text-gray-400 italic">No configured subjects found.</div>
                            ) : (
                                availablePayload.map(p => (
                                    <div key={p.subjectId} draggable onDragStart={dragPayload(p.courseCode, p.teacherId)} 
                                         className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded cursor-grab active:cursor-grabbing hover:border-blue-300">
                                        <div className="font-bold text-[10px]">{p.courseName}</div>
                                        <div className="text-[9px] text-gray-500 font-medium">Teacher: {p.teacherName}</div>
                                        <div className="text-[9px] text-blue-500">{p.courseCode}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-3">
                    {renderTimetable()}
                </div>
            </div>

            <Modal show={!!conflictInfo} size="sm" onClose={() => setConflictInfo(null)} popup>
                <ModalHeader />
                <ModalBody className="text-center text-gray-900 dark:text-white">
                    <HiExclamation className="mx-auto size-12 text-red-500 mb-4" />
                    <h3 className="font-bold">{conflictInfo?.message}</h3>
                    <p className="text-xs text-gray-500 mt-2">{conflictInfo?.details}</p>
                    <Button color="failure" size="sm" className="mt-6 w-full" onClick={() => setConflictInfo(null)}>Dismiss</Button>
                </ModalBody>
            </Modal>

            <Modal show={!!moveConfirmInfo} size="sm" onClose={() => setMoveConfirmInfo(null)} popup>
                <ModalHeader />
                <ModalBody className="text-center text-gray-900 dark:text-white">
                    <HiOutlineExclamationCircle className="mx-auto size-12 text-yellow-400 mb-4" />
                    <h3 className="font-bold">Displace Section?</h3>
                    <p className="text-xs text-gray-500 mt-2">Moving this will change the room assignment for this specific block.</p>
                    <div className="flex gap-2 mt-6">
                        <Button color="blue" size="sm" className="flex-1" onClick={() => { 
                            if (moveConfirmInfo) {
                                setSchedules(prev => prev.map(s => s.id === moveConfirmInfo.old.id ? moveConfirmInfo.updated : s)); 
                                triggerNotification("Schedule moved successfully!");
                            }
                            setMoveConfirmInfo(null); 
                        }}>Move</Button>
                        <Button color="gray" size="sm" onClick={() => setMoveConfirmInfo(null)}>Cancel</Button>
                    </div>
                </ModalBody>
            </Modal>

            <Toast className={`fixed z-60 bottom-10 right-10 transition-all ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center">
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-500`}><HiCheck className="h-5 w-5" /></div>
                    <div className="ml-3 text-xs font-medium">{toastMessage}</div>
                    <ToastToggle onDismiss={() => setShowToast(false)} />
                </div>
                <Progress progress={progress} size="sm" className="mt-2" color="green" />
            </Toast>
        </div>
    );
}
