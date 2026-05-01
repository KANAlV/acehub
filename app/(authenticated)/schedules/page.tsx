"use client";

import React, { useEffect, useState, useRef } from "react";
import {
    Button, Card, Label, Modal, ModalBody, ModalFooter, ModalHeader,
    Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow,
    TextInput, Toast, ToastToggle, Select, Tabs, TabItem, Checkbox, Accordion, AccordionPanel, AccordionTitle,
    AccordionContent, Progress, Tooltip
} from "flowbite-react";
import { 
    HiPlus, HiTrash, HiExternalLink, HiCheck, HiExclamation, 
    HiArrowRight, HiArrowLeft, HiBookOpen, HiUserGroup, HiClock, HiArrowCircleRight, HiArrowCircleLeft, HiSearch,
    HiIdentification
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import { 
    fetchSchedulesList, deleteGeneratedSchedule, saveGeneratedSchedule,
    fetchCurriculumVersions, fetchAllSubjects, fetchAllTeachers, getAllProgramsData
} from "@/services/userService";

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
                                {opt.subLabel && <div className="text-[10px] text-gray-500 dark:text-gray-400 italic">{opt.subLabel}</div>}
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

export default function SchedulesDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<any[]>([]);
    
    // --- Generator State ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const tabsRef = useRef<any>(null);
    
    // Configuration Data
    const [curriculums, setCurriculums] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [allSections, setAllSections] = useState<any[]>([]);

    // Selection State
    const [newScheduleName, setNewScheduleName] = useState("");
    const [semester, setSemester] = useState("1"); // 1 or 2
    const [batchCurriculum, setBatchCurriculum] = useState("");
    const [subjectSearch, setSubjectSearch] = useState("");
    
    // Step 1 State: Subjects
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
    const [mergeLecLab, setMergeLecLab] = useState<Record<string, boolean>>({}); // subject.id -> boolean

    // Step 2 State: Static Assignments (Optional)
    const [assignments, setAssignments] = useState<{id: string, subjectId: string, teacherId: string}[]>([]);
    
    // Step 3 State: Availability Overrides (Optional)
    const [overrideTeacherIds, setOverrideTeacherIds] = useState<string[]>([]);
    const [teacherOverrides, setTeacherOverrides] = useState<Record<string, any[]>>({});

    // Toast State
    const [showToast, setShowToast] = useState(false);
    const [statusCode, setStatusCode] = useState("");
    const [progress, setProgress] = useState(100);

    const STATUS_MESSAGES = {
        "201": "Schedule initialized successfully!",
        "204": "Schedule deleted.",
        "400": "Name, Subjects, and Sections are required.",
        "500": "Server error occurred."
    };

    useEffect(() => {
        if (showToast) {
            setProgress(100);
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 100);
            const timer = setTimeout(() => setShowToast(false), 5000);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [showToast]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [list, currs, subs, teachs, secs] = await Promise.all([
                fetchSchedulesList(),
                fetchCurriculumVersions(),
                fetchAllSubjects(),
                fetchAllTeachers(),
                getAllProgramsData()
            ]);
            setSchedules(list);
            setCurriculums(currs);
            setAllSubjects(subs);
            setAllTeachers(teachs);
            setAllSections(secs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Filter available curriculum versions
    const availableCurriculums = curriculums.filter(c => {
        const subjectsInCurr = allSubjects.filter(s => s.curriculumn_version === c.version);
        return subjectsInCurr.length > 0 && subjectsInCurr.some(s => !selectedSubjectIds.includes(s.id));
    });

    // Split subjects for Tab 1
    const availableSubjects = allSubjects
        .filter(s => !selectedSubjectIds.includes(s.id))
        .filter(s => 
            s.course_name.toLowerCase().includes(subjectSearch.toLowerCase()) || 
            s.course_code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
            (s.curriculumn_version && s.curriculumn_version.toLowerCase().includes(subjectSearch.toLowerCase()))
        );

    const chosenSubjects = allSubjects.filter(s => selectedSubjectIds.includes(s.id));

    const handleBatchAdd = (version: string) => {
        if (!version) return;
        const subjectsFromCurr = allSubjects
            .filter(s => s.curriculumn_version === version)
            .map(s => s.id);
        setSelectedSubjectIds(prev => Array.from(new Set([...prev, ...subjectsFromCurr])));
        setBatchCurriculum("");
    };

    const addSubject = (id: string) => {
        if (!selectedSubjectIds.includes(id)) {
            setSelectedSubjectIds(prev => [...prev, id]);
        }
    };

    const removeSubject = (id: string) => {
        setSelectedSubjectIds(prev => prev.filter(sid => sid !== id));
        setAssignments(prev => prev.filter(a => a.subjectId !== id));
        setMergeLecLab(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const toggleMergeLecLab = (id: string) => {
        setMergeLecLab(prev => ({ ...prev, [id]: !prev[id] }));
    };


    const addAssignmentRow = () => {
        setAssignments(prev => [...prev, { id: crypto.randomUUID(), subjectId: "", teacherId: "" }]);
    };

    const updateAssignment = (id: string, field: 'subjectId' | 'teacherId', value: string) => {
        setAssignments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const removeAssignmentRow = (id: string) => {
        setAssignments(prev => prev.filter(a => a.id !== id));
    };

    const addOverrideTeacher = (teacherId: string) => {
        if (!teacherId || overrideTeacherIds.includes(teacherId)) return;
        setOverrideTeacherIds(prev => [...prev, teacherId]);
        if (!teacherOverrides[teacherId]) {
            const teacher = allTeachers.find(t => t.pscs_id === teacherId);
            setTeacherOverrides(prev => ({ ...prev, [teacherId]: teacher?.availability || [] }));
        }
    };

    const removeOverrideTeacher = (teacherId: string) => {
        setOverrideTeacherIds(prev => prev.filter(id => id !== teacherId));
    };

    const handleCreate = async () => {
        if (!newScheduleName || chosenSubjects.length === 0) {
            setStatusCode("400");
            setShowToast(true);
            return;
        }

        setLoading(true);
        const finalAssignments: Record<string, string> = {};
        assignments.forEach(a => {
            const sub = allSubjects.find(s => s.id === a.subjectId);
            if (sub && a.teacherId) finalAssignments[sub.id] = a.teacherId;
        });

        const activeOverrides: Record<string, any[]> = {};
        overrideTeacherIds.forEach(id => { activeOverrides[id] = teacherOverrides[id] || []; });

        const config = {
            name: newScheduleName,
            semester: semester,
            subjects: selectedSubjectIds,
            assignments: finalAssignments,
            overrides: teacherOverrides,
            mergeLecLab: mergeLecLab
        };
        
        const res = await saveGeneratedSchedule(newScheduleName, config);
        if (res.status === "201") {
            router.push(`/schedules/generated_schedule/${res.id}`);
        } else {
            setLoading(false);
            setStatusCode("500");
            setShowToast(true);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this schedule snapshot?")) return;
        const res = await deleteGeneratedSchedule(id);
        setStatusCode(res);
        setShowToast(true);
        loadData();
    };

    const TeacherOverrideItem = ({ teacher }: { teacher: any }) => {
        const overrides = teacherOverrides[teacher.pscs_id] || [];
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const updateSlot = (idx: number, field: string, val: string) => {
            const newArr = [...overrides];
            newArr[idx] = { ...newArr[idx], [field]: val };
            setTeacherOverrides(prev => ({ ...prev, [teacher.pscs_id]: newArr }));
        };
        const addSlot = () => {
            setTeacherOverrides(prev => ({ 
                ...prev, 
                [teacher.pscs_id]: [...overrides, { day: "Monday", time: "7:30 AM - 5:00 PM" }] 
            }));
        };
        const removeSlot = (idx: number) => {
            setTeacherOverrides(prev => ({ 
                ...prev, 
                [teacher.pscs_id]: overrides.filter((_, i) => i !== idx) 
            }));
        };
        return (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-blue-600">{teacher.name}</span>
                        <span className="text-[10px] bg-gray-200 px-1 rounded uppercase">{teacher.pscs_id}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button size="xs" color="gray" onClick={addSlot}><HiPlus className="mr-1" /> Add Slot</Button>
                        <Button size="xs" color="failure" onClick={() => removeOverrideTeacher(teacher.pscs_id)}><HiTrash /></Button>
                    </div>
                </div>
                <div className="space-y-2">
                    {overrides.map((slot: any, i: number) => (
                        <div key={i} className="flex gap-2">
                            <Select sizing="sm" value={slot.day} onChange={e => updateSlot(i, 'day', e.target.value)}>
                                {days.map(d => <option key={d} value={d}>{d}</option>)}
                            </Select>
                            <TextInput sizing="sm" value={slot.time} onChange={e => updateSlot(i, 'time', e.target.value)} />
                            <Button size="xs" color="failure" onClick={() => removeSlot(i)}><HiTrash /></Button>
                        </div>
                    ))}
                    {overrides.length === 0 && <p className="text-[10px] text-gray-400 italic text-center py-2">No slots added. Click Add Slot to begin.</p>}
                </div>
            </div>
        );
    };

    const groupedSelected = chosenSubjects.reduce((acc: any, sub) => {
        const curr = sub.curriculumn_version || "Unassigned";
        if (!acc[curr]) acc[curr] = [];
        acc[curr].push(sub);
        return acc;
    }, {});

    return (
        <div className="p-8 h-full w-full overflow-y-auto font-sans text-gray-900 dark:text-white">
            {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"><Spinner size="xl" /></div>}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Generated Schedules</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and view your institutional timetables</p>
                </div>
                <Button onClick={() => { 
                    setActiveTab(0); 
                    setNewScheduleName("");
                    setSemester("1");
                    setSelectedSubjectIds([]);
                    setAssignments([]);
                    setOverrideTeacherIds([]);
                    setTeacherOverrides({});
                    setMergeLecLab({});
                    setShowCreateModal(true); 
                }}>
                    <HiPlus className="mr-2 h-5 w-5" /> Create New Schedule
                </Button>
            </div>

            <Card className="border-none shadow-sm">
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Schedule Name</TableHeadCell>
                            <TableHeadCell>Date Created</TableHeadCell>
                            <TableHeadCell className="text-right">Actions</TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {schedules.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-bold">{s.name}</TableCell>
                                <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        <Button size="xs" color="info" onClick={() => router.push(`/schedules/${s.id}`)}>
                                            <HiExternalLink className="mr-1" /> Open Editor
                                        </Button>
                                        <Button size="xs" color="failure" onClick={() => handleDelete(s.id)}><HiTrash /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="7xl">
                <ModalHeader>Configure New Schedule Generation</ModalHeader>
                <ModalBody className="p-0 bg-gray-50 dark:bg-gray-900 min-h-[70vh]">
                    <Tabs aria-label="Generation steps" variant="fullWidth" onActiveTabChange={(tab) => setActiveTab(tab)} ref={tabsRef}>
                        
                        <TabItem active={activeTab === 0} title="1. Configuration" icon={HiBookOpen}>
                            <div className="p-4 space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div><Label>Schedule Name</Label><TextInput value={newScheduleName} onChange={e => setNewScheduleName(e.target.value)} placeholder="e.g. 1st Sem 2024" /></div>
                                    <div className="col-span-1">
                                        <Label>Target Semester</Label>
                                        <Select value={semester} onChange={e => setSemester(e.target.value)}>
                                            <option value="1">1st Semester / Grade 11 & 12</option>
                                            <option value="2">2nd Semester / Grade 11 & 12</option>
                                        </Select>
                                    </div>
                                    <div className="relative">
                                        <Label>Batch Add by Curriculum</Label>
                                        <AutocompleteSelect 
                                            options={availableCurriculums.map(c => ({ id: c.version, label: c.version }))}
                                            value={batchCurriculum}
                                            onChange={handleBatchAdd}
                                            placeholder="Search Curriculum..."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="flex flex-col col-span-1 h-[50vh]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-sm text-gray-500 flex items-center gap-2">
                                                Available Subjects
                                                <span className="bg-gray-200 px-2 rounded text-xs text-gray-700">{availableSubjects.length}</span>
                                            </h4>
                                            <div className="w-32"><TextInput sizing="sm" placeholder="Search..." icon={HiSearch} value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} /></div>
                                        </div>
                                        <div className="flex-1 border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-inner">
                                            <div className="h-full overflow-y-auto">
                                                <Table hoverable>
                                                    <TableHead className="sticky top-0 z-10">
                                                        <TableRow>
                                                            <TableHeadCell>Curr</TableHeadCell>
                                                            <TableHeadCell>Code</TableHeadCell>
                                                            <TableHeadCell>Name</TableHeadCell>
                                                            <TableHeadCell></TableHeadCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody className="divide-y text-gray-900 dark:text-white">{availableSubjects.map(s => (
                                                        <TableRow key={s.id} className="hover:bg-gray-500/30">
                                                            <TableCell className="text-xs">
                                                                <Tooltip content={(
                                                                    <>
                                                                        <div>Lec: {s.lecture_units}</div>
                                                                        <div>Lab: {s.lab_units}</div>
                                                                    </>
                                                                )}>
                                                                    {s.curriculumn_version}
                                                                </Tooltip>
                                                            </TableCell>
                                                            <TableCell className="font-mono text-[10px]">
                                                                <Tooltip content={(
                                                                    <>
                                                                        <div>Lec: {s.lecture_units}</div>
                                                                        <div>Lab: {s.lab_units}</div>
                                                                    </>
                                                                )}>
                                                                    {s.course_code}
                                                                </Tooltip>
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                <Tooltip content={(
                                                                    <>
                                                                        <div>Lec: {s.lecture_units}</div>
                                                                        <div>Lab: {s.lab_units}</div>
                                                                    </>
                                                                )}>
                                                                    {s.course_name}
                                                                </Tooltip>
                                                            </TableCell>
                                                            <TableCell><Button size="xs" color="blue" onClick={() => addSubject(s.id)}><HiArrowRight size="18" /></Button></TableCell>
                                                        </TableRow>
                                                    ))}</TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 col-span-1 h-[50vh]">
                                        <div className="flex flex-col col-span-2 h-[50vh] text-gray-900 dark:text-white">
                                            <h4 className="font-bold text-sm mb-2 text-blue-600 flex items-center justify-between">Selected Subjects <span className="bg-blue-100 px-2 rounded text-xs text-blue-700">{chosenSubjects.length}</span></h4>
                                            <div className="flex-1 border border-blue-200 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-inner overflow-y-auto">
                                                {chosenSubjects.length === 0 ? (
                                                    <div className="text-center py-12 text-gray-400 italic font-medium h-full flex items-center justify-center">No subjects selected</div>
                                                ) : (
                                                    <Accordion collapseAll>
                                                        {Object.entries(groupedSelected).map(([curr, subs]: [string, any]) => {
                                                            const totalInCurr = allSubjects.filter(s => s.curriculumn_version === curr).length;
                                                            const isFullCurr = subs.length === totalInCurr && curr !== "Unassigned";
                                                            return (
                                                                <AccordionPanel key={curr}>
                                                                    <AccordionTitle className={`p-3 ${isFullCurr ? 'text-blue-600' : 'text-blue-700'}`}>
                                                                        <div className="flex justify-between items-center w-full pr-4 text-xs">
                                                                            <span>{curr}</span>
                                                                            <span className="pl-2 font-bold text-blue-500">({subs.length})</span>
                                                                            {isFullCurr && (<span className={"pl-3 font-bold text-green-500"}>[FULL]</span>)}
                                                                        </div>
                                                                    </AccordionTitle>
                                                                    <AccordionContent className="p-0 border-none  overflow-x-auto">
                                                                        <Table hoverable>
                                                                            <TableBody className="divide-y text-gray-900 dark:text-white">{subs.map((s: any) => (
                                                                                <TableRow key={s.id} className="bg-white dark:bg-gray-800">
                                                                                    <TableCell className="p-2">
                                                                                        <Tooltip content={(
                                                                                            <>
                                                                                                <div>Lec: {s.lecture_units}</div>
                                                                                                <div>Lab: {s.lab_units}</div>
                                                                                            </>
                                                                                        )}>
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-mono text-xs">{s.course_code}</span>
                                                                                                <span className="text-xs font-semibold truncate max-w-30">{s.course_name}</span>
                                                                                            </div>
                                                                                        </Tooltip>
                                                                                    </TableCell>
                                                                                    <TableCell className="p-1">
                                                                                        <Tooltip content={(
                                                                                            <>
                                                                                                <div>Lec: {s.lecture_units}</div>
                                                                                                <div>Lab: {s.lab_units}</div>
                                                                                            </>
                                                                                        )}>
                                                                                            <div className="flex items-center gap-1">
                                                                                                <Checkbox
                                                                                                    id={`merge-${s.id}`}
                                                                                                    checked={!!mergeLecLab[s.id]}
                                                                                                    onChange={() => toggleMergeLecLab(s.id)}
                                                                                                />
                                                                                                <Label htmlFor={`merge-${s.id}`} className="text-xs whitespace-nowrap">Merge Lec/Lab</Label>
                                                                                            </div>
                                                                                        </Tooltip>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right pr-2"><Button size="xs" color="red" onClick={() => removeSubject(s.id)}><HiArrowLeft size="16" /></Button></TableCell>
                                                                                </TableRow>
                                                                            ))}</TableBody>
                                                                        </Table>
                                                                    </AccordionContent>
                                                                </AccordionPanel>
                                                            );
                                                        })}
                                                    </Accordion>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col min-w-32 h-[50vh]">
                                            <h4 className="font-bold text-sm mb-2 text-gray-500">Available Courses (Reference)</h4>
                                            <div className="flex-1 border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 shadow-inner">
                                                <div className="h-full overflow-y-auto p-2 space-y-2">
                                                    {allSections.map(sec => (
                                                        <div key={sec.program_code} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded border border-gray-100 dark:border-gray-600 text-gray-900 dark:text-white">
                                                            <Tooltip placement={"bottom"}
                                                                     animation={"duration-800"}
                                                                     content={Object.entries(sec.students || {}).map(([year, count]) => (
                                                                         <div key={year} className="mr-2">Y{year}: {Number(count)}</div>
                                                                     ))}>
                                                                <div className={"flex w-32"}>
                                                                    <div className="text-xs font-medium">{sec.program_code}</div>
                                                                    <div className="pl-2 text-xs text-gray-500">({sec.level})</div>
                                                                </div>
                                                            </Tooltip>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabItem>

                        <TabItem active={activeTab === 1} title="2. Assignments (Optional)" icon={HiUserGroup}>
                            <div className="p-6 space-y-4 min-h-[60vh]">
                                <div className="flex justify-between items-center text-gray-900 dark:text-white">
                                    <p className="text-sm text-gray-500 italic">Optional: Pre-assign teachers to subjects.</p>
                                    <Button size="xs" color="blue" onClick={addAssignmentRow} disabled={chosenSubjects.length === 0}>
                                        <HiPlus className="mr-1" /> Add Assignment Row
                                    </Button>
                                </div>
                                <div className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm max-h-[50vh] overflow-visible">
                                    <Table hoverable>
                                        <TableHead className="sticky top-0 z-10"><TableRow><TableHeadCell>Subject</TableHeadCell><TableHeadCell>Teacher</TableHeadCell><TableHeadCell></TableHeadCell></TableRow></TableHead>
                                        <TableBody className="divide-y">{assignments.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="w-[45%] overflow-visible">
                                                    <AutocompleteSelect 
                                                        options={chosenSubjects.map(s => ({ id: s.id, label: s.course_name, subLabel: s.course_code }))}
                                                        value={row.subjectId}
                                                        onChange={(val) => updateAssignment(row.id, 'subjectId', val)}
                                                        placeholder="Search Subject..."
                                                    />
                                                </TableCell>
                                                <TableCell className="w-[45%] overflow-visible">
                                                    <AutocompleteSelect 
                                                        options={allTeachers.map(t => ({ id: t.pscs_id, label: t.name, subLabel: t.pscs_id }))}
                                                        value={row.teacherId}
                                                        onChange={(val) => updateAssignment(row.id, 'teacherId', val)}
                                                        placeholder="Search Teacher..."
                                                    />
                                                </TableCell>
                                                <TableCell><Button size="xs" color="failure" onClick={() => removeAssignmentRow(row.id)}><HiTrash /></Button></TableCell>
                                            </TableRow>
                                        ))}</TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabItem>

                        <TabItem active={activeTab === 2} title="3. Overrides (Optional)" icon={HiClock}>
                            <div className="p-6 space-y-4 h-[60vh] overflow-y-auto">
                                <div className="flex justify-between items-center text-gray-900 dark:text-white">
                                    <p className="text-sm text-gray-500 italic">Override teacher availability for this session.</p>
                                    <div className="w-80">
                                        <AutocompleteSelect 
                                            options={allTeachers.map(t => ({ id: t.pscs_id, label: t.name, subLabel: t.pscs_id }))}
                                            value=""
                                            onChange={(val) => addOverrideTeacher(val)}
                                            placeholder="Add Teacher to Override List..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 pb-8 text-gray-900 dark:text-white">
                                    {allTeachers.filter(t => overrideTeacherIds.includes(t.pscs_id)).map(t => <TeacherOverrideItem key={t.pscs_id} teacher={t} />)}
                                </div>
                            </div>
                        </TabItem>
                    </Tabs>
                </ModalBody>
                <ModalFooter className="justify-between bg-gray-50 dark:bg-gray-800">
                    <Button color="gray" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <div className="flex gap-2">
                        {activeTab > 0 && <Button color="alternative" onClick={() => tabsRef.current?.setActiveTab(activeTab - 1)}><HiArrowLeft className="mr-2" /> Back</Button>}
                        <Button 
                            onClick={activeTab < 2 ? () => tabsRef.current?.setActiveTab(activeTab + 1) : handleCreate} 
                            disabled={!newScheduleName || chosenSubjects.length === 0}
                        >
                            {activeTab < 2 ? <>{activeTab === 0 ? "Customize (Optional)" : "Availability (Optional)"} <HiArrowRight className="ml-2" /></> : <><HiCheck className="mr-2" /> Initialize Schedule</>}
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Toast */}
            <Toast className={`fixed z-50 bottom-10 right-10 transition-all ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center">
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusCode.startsWith('2') ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
                        {statusCode.startsWith('2') ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 text-sm font-normal">{STATUS_MESSAGES[statusCode as keyof typeof STATUS_MESSAGES] || "Error"}</div>
                    <ToastToggle onDismiss={() => {
                        setShowToast(false);
                        setProgress(0);
                    }} />
                </div>
                <Progress progress={progress} size="sm" className="mt-2" color={statusCode.startsWith('2') ? "green" : "red"} />
            </Toast>
        </div>
    );
}
