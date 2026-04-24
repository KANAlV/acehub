"use client"
import {
    Button,
    Dropdown,
    DropdownItem,
    Label,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Pagination,
    Progress,
    Select, Spinner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    TextInput,
    Toast,
    ToastToggle
} from "flowbite-react";
import React, {useEffect, useRef, useState} from "react";
import {HiCheck, HiExclamation, HiOutlineTrash, HiPlus} from "react-icons/hi";
import {
    fetchTeachers,
    fetchTeachersCount,
    insertTeacher,
    updateTeacher,
    deleteTeacher,
    getAllTeachersData
} from "@/services/userService.ts";
import {VscSave} from "react-icons/vsc";
import {sanitizeMediumName, sanitizeVeryShortName} from "@/lib/validation.ts";

/** --- Helper Components --- **/
const AvailabilityManager = ({ availability, onUpdate }: { availability: any[], onUpdate: (val: any[]) => void }) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const addSlot = () => {
        onUpdate([...availability, { day: "Monday", time: "7:30 AM - 5:00 PM" }]);
    };

    const removeSlot = (index: number) => {
        onUpdate(availability.filter((_, i) => i !== index));
    };

    const updateSlot = (index: number, field: string, value: string) => {
        const newSlots = [...availability];
        newSlots[index] = { ...newSlots[index], [field]: value };
        onUpdate(newSlots);
    };

    return (
        <div className="mt-4 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
                <Label className="font-bold">Availability Slots</Label>
                <Button size="xs" color="gray" onClick={addSlot}><HiPlus className="mr-1" /> Add</Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {availability.map((slot, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                        <Select 
                            value={slot.day} 
                            onChange={(e) => updateSlot(idx, 'day', e.target.value)}
                            className="flex-1"
                            sizing="sm"
                        >
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </Select>
                        <TextInput 
                            value={slot.time} 
                            onChange={(e) => updateSlot(idx, 'time', e.target.value)}
                            placeholder="e.g. 7:30AM - 5:00PM"
                            className="flex-1"
                            sizing="sm"
                        />
                        <Button color="failure" size="xs" onClick={() => removeSlot(idx)}><HiOutlineTrash /></Button>
                    </div>
                ))}
                {availability.length === 0 && <p className="text-xs text-gray-500 italic">No availability set.</p>}
            </div>
        </div>
    );
};

export default function TeacherManager() {
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI consts
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [warningType, setWarningType] = useState("");

    const [activeChanges, setActiveChanges] = useState(false);
    const AddModalIdInput = useRef<HTMLInputElement>(null);
    const EditModalIdInput = useRef<HTMLInputElement>(null);

    const [showToast, setShowToast] = useState(false);
    const [progress, setProgress] = useState(100);

    // form useStates
    const [pscsId, setPscsId] = useState("");
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [spec, setSpec] = useState("");
    const [type, setType] = useState("Regular");
    const [availability, setAvailability] = useState<any[]>([]);

    // Search
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // pagination consts
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setRowCount] = useState(1);
    const totalPageCount = Math.ceil(rowCount / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, rowCount);

    const STATUS_MESSAGES = {
        "200": "Teacher updated successfully.",
        "201": "Teacher added successfully.",
        "204": "Teacher removed successfully.",
        "400": "Invalid input provided.",
        "409": "Conflict: Code or ID already exists.",
        "500": "Server error. Please try again."
    };

    /** UI Functions **/
    function editModalValue(id: string) {
        const teacher = teachers.find(t => t.pscs_id === id);
        if (!teacher) return;

        setPscsId(teacher.pscs_id);
        setName(teacher.name);
        setCode(teacher.teacher_code);
        setSpec(teacher.specialization);
        setType(teacher.employment_type);
        setAvailability(teacher.availability || []);
        setEditModal(true);
    }

    function discardEntry() {
        setPscsId("");
        setName("");
        setCode("");
        setSpec("");
        setType("Regular");
        setAvailability([]);
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    /** Queries **/
    const loadInitialData = async () => {
        const data = await fetchTeachers(search, currentPage);
        setTeachers(data);
        setLoading(false);
    }

    const loadRowCount = async () => {
        const count = await fetchTeachersCount(search);
        setRowCount(count);
    }

    const onPageChange = (page: number) => setCurrentPage(page);

    async function submitTeacher() {
        if (!pscsId || !name || !code) return;
        setLoading(true);
        const stat = await insertTeacher(pscsId, name, code, spec, type, availability);
        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);
        if (stat === "201") {
            discardEntry();
            loadRowCount();
            loadInitialData();
        }
    }

    async function updateEntry() {
        setLoading(true);
        const stat = await updateTeacher(pscsId, name, code, spec, type, availability);
        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);
        if (stat === "200") {
            discardEntry();
            loadRowCount();
            loadInitialData();
        }
    }

    async function deleteRow() {
        setLoading(true);
        const stat = await deleteTeacher(pscsId);
        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);
        if (stat === "204") {
            discardEntry();
            loadRowCount();
            loadInitialData();
        }
    }

    /** Import/Export **/
    async function handleExportToExcel() {
        try {
            const data = await getAllTeachersData();
            if (!data || data.length === 0) return "404";

            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Teachers List');

            worksheet.columns = [
                { header: 'PSCS ID', key: 'pscs_id', width: 15 },
                { header: 'Full Name', key: 'name', width: 35 },
                { header: 'Code', key: 'teacher_code', width: 10 },
                { header: 'Specialization', key: 'specialization', width: 20 },
                { header: 'Employment Type', key: 'employment_type', width: 20 },
                { header: 'Availability', key: 'availability_str', width: 50 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };

            const rows = data.map(t => ({
                ...t,
                availability_str: (t.availability || []).map((s: any) => `${s.day}: ${s.time}`).join(' | ')
            }));

            worksheet.addRows(rows);
            worksheet.autoFilter = 'A1:F1';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Teachers_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            return "200";
        } catch (error) {
            console.error(error);
            return "500";
        }
    }

    async function downloadImportTemplate() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Import Template');

            worksheet.columns = [
                { header: 'PSCS ID', key: 'id', width: 15 },
                { header: 'Full Name', key: 'name', width: 35 },
                { header: 'Code', key: 'code', width: 10 },
                { header: 'Specialization', key: 'spec', width: 20 },
                { header: 'Employment Type', key: 'type', width: 20 },
                { header: 'Availability (Day: Time | Day: Time)', key: 'availability', width: 50 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };

            worksheet.addRow({ 
                id: '########',
                name: 'Ivan Winzle S. Diocampo',
                code: 'IWD',
                spec: 'Information Technology',
                type: 'Regular', 
                availability: 'Monday: 5:00 PM - 8:00 PM | Saturday: 7:30 AM - 5:00 PM' 
            });

            worksheet.addRow({
                id: '########',
                name: 'James Murfhy C. Reurreccion',
                code: 'JMR',
                spec: 'Business and Management',
                type: 'Regular',
                availability: 'Monday: 5:00 PM - 8:00 PM | Saturday: 7:30 AM - 5:00 PM'
            });

            const typeOptions = ['Regular', 'PTFL', 'PT', 'Proby'];
            for (let i = 2; i <= 100; i++) {
                worksheet.getCell(`E${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${typeOptions.join(',')}"`]
                };
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, 'Teacher_Import_Template.xlsx');
            return "200";
        } catch (error) {
            console.error(error);
            return "500";
        }
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const worksheet = workbook.getWorksheet(1);
            
            const teachersToImport: any[] = [];
            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    const id = row.getCell(1).value?.toString().trim();
                    const name = row.getCell(2).value?.toString().trim();
                    const code = row.getCell(3).value?.toString().trim();
                    const spec = row.getCell(4).value?.toString().trim() || "";
                    const type = row.getCell(5).value?.toString().trim() || "Regular";
                    const availStr = row.getCell(6).value?.toString().trim() || "";

                    if (id && name && code) {
                        const availability = availStr.split('|').filter(s => s.includes(':')).map(s => {
                            const [day, ...timeParts] = s.trim().split(':');
                            return { day: day.trim(), time: timeParts.join(':').trim() };
                        });
                        teachersToImport.push({ id, name, code, spec, type, availability });
                    }
                }
            });

            if (teachersToImport.length === 0) {
                setStatusCode("400");
                return;
            }

            let successCount = 0;
            for (const t of teachersToImport) {
                const res = await insertTeacher(t.id, t.name, t.code, t.spec, t.type, t.availability);
                if (res === "201") successCount++;
            }

            setStatusCode(successCount > 0 ? "201" : "409");
            await loadInitialData();
            await loadRowCount();
        } catch (error) {
            console.error(error);
            setStatusCode("500");
        } finally {
            setLoading(false);
            setShowToast(true);
            if (e.target) e.target.value = "";
        }
    }

    /** Filtering **/
    const [statusCode, setStatusCode] = useState("");

    useEffect(() => {
        let isCancelled = false;
        const fetchData = async () => {
            try {
                await Promise.all([loadRowCount(), loadInitialData()]);
                if (isCancelled) return;
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        return () => { isCancelled = true; };
    }, [currentPage, debouncedSearch]);

    useEffect(() => {
        if (showToast) {
            setProgress(100);
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 100);
            const timer = setTimeout(() => setShowToast(false), 5000);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [showToast]);

    useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 1000);
        return () => clearTimeout(handler);
    }, [search]);

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            <div className={`${loading? "":"hidden"} fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm`}>
                <Spinner size="xl" />
            </div>

            <div className="flex items-center justify-between">
                <h1 className="mb-4 font-bold text-2xl">Manage Teachers:</h1>
                <div className="flex space-x-3">
                    <Dropdown color={"alternative"} label={"Actions"} dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadImportTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>Import</DropdownItem>
                        <DropdownItem onClick={() => handleExportToExcel()}>Export</DropdownItem>
                    </Dropdown>
                    <Button onClick={() => setAddModal(true)}>Add Teacher</Button>
                </div>
            </div>

            <TextInput
                className="mb-4 w-62"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            <Table hoverable>
                <TableHead>
                    <TableRow>
                        <TableHeadCell>ID</TableHeadCell>
                        <TableHeadCell>Name</TableHeadCell>
                        <TableHeadCell>Code</TableHeadCell>
                        <TableHeadCell>Spec.</TableHeadCell>
                        <TableHeadCell>Type</TableHeadCell>
                        <TableHeadCell>Availability</TableHeadCell>
                        <TableHeadCell><span className="sr-only">Edit</span></TableHeadCell>
                    </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                    {teachers.length > 0 ? (
                        teachers.map((t) => (
                            <TableRow key={t.pscs_id}>
                                <TableCell className="font-bold">{t.pscs_id}</TableCell>
                                <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{t.name}</TableCell>
                                <TableCell>{t.teacher_code}</TableCell>
                                <TableCell>{t.specialization}</TableCell>
                                <TableCell>{t.employment_type}</TableCell>
                                <TableCell>
                                    <div className="text-xs space-y-1">
                                        {(t.availability || []).map((s, i) => (
                                            <div key={i} className="whitespace-nowrap bg-blue-50 dark:bg-blue-900/20 px-1 rounded">{s.day}: {s.time}</div>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="flex justify-end">
                                    <Button color="alternative" onClick={() => editModalValue(t.pscs_id)}>Edit</Button>
                                </TableCell>
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

            {/* Add Modal */}
            <Modal show={addModal} onClose={() => setAddModal(false)} size="md">
                <ModalHeader>Add Teacher</ModalHeader>
                <ModalBody className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>PSCS ID</Label>
                            <TextInput value={pscsId} onChange={e => { setPscsId(e.target.value); setActiveChanges(true); }} placeholder="0001" />
                        </div>
                        <div>
                            <Label>Teacher Code</Label>
                            <TextInput value={code} onChange={e => { setCode(sanitizeVeryShortName(e.target.value)); setActiveChanges(true); }} placeholder="ABC" />
                        </div>
                    </div>
                    <div>
                        <Label>Full Name</Label>
                        <TextInput value={name} onChange={e => { setName(sanitizeMediumName(e.target.value)); setActiveChanges(true); }} placeholder="John Doe" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Specialization</Label>
                            <TextInput value={spec} onChange={e => { setSpec(e.target.value); setActiveChanges(true); }} placeholder="IT / GE" />
                        </div>
                        <div>
                            <Label>Emp. Type</Label>
                            <Select value={type} onChange={e => { setType(e.target.value); setActiveChanges(true); }}>
                                <option>Regular</option>
                                <option>PTFL</option>
                                <option>PT</option>
                                <option>Proby</option>
                            </Select>
                        </div>
                    </div>
                    <AvailabilityManager availability={availability} onUpdate={setAvailability} />
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="alternative" onClick={activeChanges ? () => setOpenWarningModal(true) : discardEntry}>
                        {activeChanges ? "Discard" : "Cancel"}
                    </Button>
                    <Button onClick={submitTeacher}>Save</Button>
                </ModalFooter>
            </Modal>

            {/* Edit Modal */}
            <Modal show={editModal} onClose={() => setEditModal(false)} size="md">
                <ModalHeader>Editing: {name}</ModalHeader>
                <ModalBody className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>PSCS ID (Read-only)</Label>
                            <TextInput value={pscsId} readOnly disabled />
                        </div>
                        <div>
                            <Label>Teacher Code</Label>
                            <TextInput value={code} onChange={e => { setCode(sanitizeVeryShortName(e.target.value)); setActiveChanges(true); }} />
                        </div>
                    </div>
                    <div>
                        <Label>Full Name</Label>
                        <TextInput value={name} onChange={e => { setName(sanitizeMediumName(e.target.value)); setActiveChanges(true); }} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Specialization</Label>
                            <TextInput value={spec} onChange={e => { setSpec(e.target.value); setActiveChanges(true); }} />
                        </div>
                        <div>
                            <Label>Emp. Type</Label>
                            <Select value={type} onChange={e => { setType(e.target.value); setActiveChanges(true); }}>
                                <option>Regular</option>
                                <option>PTFL</option>
                                <option>PT</option>
                                <option>Proby</option>
                            </Select>
                        </div>
                    </div>
                    <AvailabilityManager availability={availability} onUpdate={(v) => { setAvailability(v); setActiveChanges(true); }} />
                </ModalBody>
                <ModalFooter>
                    <Button color="failure" onClick={() => setOpenWarningModal(true)}><HiOutlineTrash className="size-5" /></Button>
                    <div className="flex-1 flex justify-end space-x-2">
                        <Button color="alternative" onClick={activeChanges ? () => setOpenWarningModal(true) : discardEntry}>
                            {activeChanges ? "Discard" : "Cancel"}
                        </Button>
                        <Button onClick={updateEntry}>Update</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Simple Warning Modal */}
            <Modal show={openWarningModal} size="sm" onClose={() => setOpenWarningModal(false)}>
                <ModalBody className="text-center py-6">
                    <HiExclamation className="mx-auto size-12 text-yellow-400 mb-4" />
                    <p className="font-bold">Are you sure?</p>
                    <div className="flex justify-center gap-4 mt-6">
                        <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                        <Button color="red" onClick={editModal ? deleteRow : discardEntry}>Yes, proceed</Button>
                    </div>
                </ModalBody>
            </Modal>

            {/* Toast */}
            <Toast className={`fixed z-50 bottom-10 right-10 transition-all ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center">
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusCode.startsWith('2') ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
                        {statusCode.startsWith('2') ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 text-sm font-normal">{STATUS_MESSAGES[statusCode] || "Operation complete"}</div>
                    <ToastToggle onDismiss={() => {
                        setShowToast(false);
                        setProgress(0);
                    }} />
                </div>
                <Progress progress={progress} size="sm" className="mt-2" color={statusCode.startsWith('2') ? "green" : "red"} />
            </Toast>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx"
                onChange={handleImport}
            />
        </div>
    );
}
