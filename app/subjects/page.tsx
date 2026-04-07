"use client"

import {
    Button,
    Dropdown,
    DropdownItem, Label, Modal, ModalBody, ModalFooter, ModalHeader, Pagination, Progress, Select,
    Table,
    TableBody, TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    TextInput, Toast, ToastToggle, Tooltip, Badge, Textarea
} from "flowbite-react";
import React, {useEffect, useRef, useState} from "react";
import {
    insertSubject,
    updateSubject,
    deleteSubject,
    fetchSubjects,
    fetchSubjectCount,
    getProgramList // We'll need this for the dropdown
} from "@/services/userService.ts";
import {HiCheck, HiExclamation, HiOutlineExclamationCircle, HiOutlineTrash, HiPlus} from "react-icons/hi";

export default function SubjectsManager() {
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const [programs, setPrograms] = useState([]); // List for the Program Dropdown
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // UI Modals
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [warningType, setWarningType] = useState("");
    const [showReq, setShowReq] = useState(false);
    const [activeSubject, setActiveSubject] = useState<any>(null);

    // Form useStates for Subjects
    const [selectedSubjectCode, setSelectedSubjectCode] = useState("");
    const [subjectNameVal, setSubjectNameVal] = useState("");
    const [selectedProgramCode, setSelectedProgramCode] = useState("");

    // Requirements split into AQ and Other
    const [aqTags, setAqTags] = useState([]);
    const [otherTags, setOtherTags] = useState([]);

    const [activeChanges, setActiveChanges] = useState(false);
    const AddModalSubjectNameInput = useRef<HTMLInputElement>(null);
    const EditModalSubjectNameInput = useRef<HTMLInputElement>(null);

    // Toast
    const [showToast, setShowToast] = useState(false);
    const [progress, setProgress] = useState(100);

    // Pagination
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setRowCount] = useState(1);
    const totalPageCount = Math.ceil(rowCount / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, rowCount);

    const [statusCode, setStatusCode] = useState("");
    const STATUS_MESSAGES = {
        "200": "Subject updated successfully.",
        "201": "Subject created successfully.",
        "204": "Subject deleted successfully.",
        "400": "Invalid data or program not found.",
        "409": "Subject code already exists.",
        "500": "Server error. Please try again later."
    };

    /** UI Functions **/
    function viewRequirements(subject: any) {
        setActiveSubject(subject);
        setShowReq(true);
    }

    function editModalValue(code: string) {
        const subject = subjects.find(s => s.subject_code === code);
        if (!subject) return;

        setSelectedSubjectCode(subject.subject_code);
        setSubjectNameVal(subject.subject_name);
        setSelectedProgramCode(subject.program_code);

        // Extract from JSONB
        setAqTags(subject.requirements?.aq || []);
        setOtherTags(subject.requirements?.other || []);

        setEditModal(true);
    }

    function showWarning(type: string) {
        setWarningType(type);
        setOpenWarningModal(true);
    }

    function discardEntry() {
        setSelectedSubjectCode("");
        setSubjectNameVal("");
        setSelectedProgramCode("");
        setAqTags([]);
        setOtherTags([]);
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    const removeAqTag = (tagToRemove: string) => {
        setAqTags(prev => prev.filter(t => t !== tagToRemove));
        setActiveChanges(true);
    };

    const removeOtherTag = (tagToRemove: string) => {
        setOtherTags(prev => prev.filter(t => t !== tagToRemove));
        setActiveChanges(true);
    };

    /** Import/Export **/
    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !e.target) return;

        setLoading(true);

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const worksheet = workbook.getWorksheet(1);
            const rows: any[] = [];

            // Header Validation (Now checking Column 1 for Program Code)
            const firstHeader = worksheet?.getRow(1).getCell(1).value?.toString();
            if (firstHeader !== 'Program Code') {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    // Mapping based on new Column Order: Prog(1), Code(2), Name(3), AQ(4), Other(5)
                    const rawProg = row.getCell(1).value?.toString().trim() || "";
                    const rawCode = row.getCell(2).value?.toString().trim() || "";
                    const rawName = row.getCell(3).value?.toString().trim() || "";
                    const aqRaw = row.getCell(4).value?.toString() || "";
                    const otherRaw = row.getCell(5).value?.toString() || "";

                    const isExample = rawCode.includes("[EXAMPLE]") || rawName.includes("[EXAMPLE]");

                    if (rawCode && rawName && rawProg && !isExample) {
                        rows.push({
                            code: rawCode.toUpperCase(),
                            name: rawName,
                            prog: rawProg.toUpperCase(),
                            requirements: {
                                aq: aqRaw.split(',').map(s => s.trim()).filter(s => s),
                                other: otherRaw.split(';').map(s => s.trim().replace(/\s+/g, ' ')).filter(s => s)
                            }
                        });
                    }
                }
            });

            if (rows.length === 0) {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            let successCount = 0;
            for (const sub of rows) {
                const res = await insertSubject(sub.code, sub.name, sub.requirements, sub.prog);
                if (res === "201") successCount++;
            }

            setStatusCode(successCount > 0 ? "201" : "409");
            setLoading(false);
            setShowToast(true);
            await loadData();

        } catch (error) {
            console.error("[IMPORT_ERROR]:", error);
            setStatusCode("500");
            setLoading(false);
            setShowToast(true);
        } finally {
            if (e.target) e.target.value = "";
        }
    }

    async function downloadImportTemplate() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Subject Import Template');

            worksheet.columns = [
                { header: 'Program Code', key: 'prog', width: 20 },
                { header: 'Subject Code', key: 'code', width: 20 },
                { header: 'Subject Name', key: 'name', width: 40 },
                { header: 'AQ Requirements', key: 'aq', width: 30 },
                { header: 'Other Requirements', key: 'other', width: 100 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };
            headerRow.height = 25;

            const exampleRow = worksheet.addRow({
                prog: 'BSIT',
                code: '[EXAMPLE] INTE1025',
                name: '[EXAMPLE] Science & Technology',
                aq: 'IT, CS',
                other: 'Research Coordinator: Baccalaureate degree relevant to the program; with experience in doing research; full-time faculty classification. Research Adviser: PhD holder or an MA/MS graduate (thesis track or has a research output in the last five (5) years that was presented or published in a journal); full-time faculty classification; with any of the ff: a) at least two (2) years of industry experience aligned to the discipline; b) with industry/faculty certification/s relevant to the discipline'
            });

            exampleRow.font = { italic: true, color: { argb: '94A3B8' } };
            exampleRow.alignment = { wrapText: true, vertical: 'top' };

            worksheet.addRow({}); // Spacer row

            // Validation for Program Code (Column A)
            const programOptions = programs.map(p => p.program_code);
            if (programOptions.length > 0) {
                for (let i = 4; i <= 200; i++) {
                    worksheet.getCell(`A${i}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${programOptions.join(',')}"`],
                    };
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Subject_Import_Template.xlsx`);
            return "200";
        } catch (error) {
            console.error("[TEMPLATE_ERROR]:", error);
            return "500";
        }
    }

    async function handleExportToExcel() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Subjects Inventory');

            worksheet.columns = [
                { header: 'Program Code', key: 'prog', width: 20 },
                { header: 'Subject Code', key: 'code', width: 20 },
                { header: 'Subject Name', key: 'name', width: 40 },
                { header: 'AQ Requirements', key: 'aq', width: 30 },
                { header: 'Other Requirements', key: 'other', width: 100 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };

            const exportData = subjects.map(s => ({
                prog: s.program_code,
                code: s.subject_code,
                name: s.subject_name,
                aq: s.requirements?.aq?.join(', ') || '',
                other: s.requirements?.other?.join('; ') || ''
            }));

            worksheet.addRows(exportData);
            worksheet.autoFilter = 'A1:E1';

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Subjects_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            return "200";
        } catch (error) {
            console.error("[EXPORT_ERROR]:", error);
            return "500";
        }
    }

    /** Queries **/
    async function submitSubject() {
        if (!selectedSubjectCode || !subjectNameVal || !selectedProgramCode) return;

        setLoading(true);
        const requirements = { aq: aqTags, other: otherTags };

        const stat = await insertSubject(
            selectedSubjectCode,
            subjectNameVal,
            requirements,
            selectedProgramCode
        );

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "201") {
            discardEntry();
            setSearch("");
            await loadData();
        }
    }

    async function updateEntry() {
        setLoading(true);
        const requirements = { aq: aqTags, other: otherTags };

        const stat = await updateSubject(
            selectedSubjectCode,
            subjectNameVal,
            requirements,
            selectedProgramCode
        );

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "200") {
            discardEntry();
            await loadData();
        }
    }

    async function deleteRow() {
        const id = selectedSubjectCode;
        setLoading(true);

        const stat = await deleteSubject(id);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "204") {
            discardEntry();
            setSearch("");
            await loadData();
        }
    }

    const loadData = async () => {
        try {
            const [subData, subCount, progList] = await Promise.all([
                fetchSubjects(debouncedSearch, currentPage),
                fetchSubjectCount(debouncedSearch),
                getProgramList()
            ]);
            setSubjects(subData);
            setRowCount(subCount);
            setPrograms(progList);
        } catch (error) {
            console.error("[DATA_ERROR]:", error);
        } finally {
            setLoading(false);
        }
    }

    const onPageChange = (page: number) => {
        setCurrentPage(page);
    };

    /** Effects **/
    useEffect(() => {
        let isCancelled = false;
        const fetchData = async () => {
            await loadData();
            if (!isCancelled) setLoading(false);
        };
        fetchData();
        return () => { isCancelled = true; };
    }, [currentPage, debouncedSearch]);

    useEffect(() => {
        if (showToast) {
            setProgress(100);
            const interval = setInterval(() => {
                setProgress((prev) => Math.max(0, prev - (100 / (5000 / 50))));
            }, 50);
            const timeout = setTimeout(() => setShowToast(false), 5000);
            return () => { clearInterval(interval); clearTimeout(timeout); };
        }
    }, [showToast]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 1000);
        return () => clearTimeout(handler);
    }, [search]);

    /** UI Components **/
    const RequirementsDisplay = ({ reqs }: { reqs: any }) => {
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">
                        AQ Requirements
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {reqs?.aq?.length > 0 ? (
                            reqs.aq.map((tag: string, i: number) => (
                                <Badge key={i} color="info" className="px-3 py-1">
                                    {tag}
                                </Badge>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 italic">No AQ requirements specified.</p>
                        )}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">
                        Other Requirements
                    </h3>
                    <ul className="list-disc pl-5 space-y-3">
                        {reqs?.other?.length > 0 ? (
                            reqs.other.map((item: string, i: number) => (
                                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {item}
                                </li>
                            ))
                        ) : (
                            <li className="text-sm text-gray-500 italic list-none">No other requirements specified.</li>
                        )}
                    </ul>
                </div>
            </div>
        );
    };

    const SubjectTableRow = ({ subject }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell className="font-medium text-gray-900 dark:text-white">
                    {subject.subject_code}
                </TableCell>
                <TableCell>{subject.subject_name}</TableCell>
                <TableCell>{subject.program_code}</TableCell>
                <TableCell>
                    <div onClick={() => viewRequirements(subject)} className="cursor-help text-blue-600 dark:text-blue-400 underline decoration-dotted">
                        View { (subject.requirements?.aq?.length || 0) + (subject.requirements?.other?.length || 0) } Reqs
                    </div>
                </TableCell>
                <TableCell className="flex justify-end">
                    <Button color="alternative" onClick={() => editModalValue(subject.subject_code)}>
                        Edit
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            {/** Loading Overlay **/}
            <div className={`${loading ? "" : "hidden"} fixed inset-0 z-9999 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
                    <p className="text-white font-semibold text-lg">Syncing Subjects...</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h1 className="mb-4 font-bold text-2xl">Manage Subjects:</h1>
                <div className="flex space-x-3">
                    <Dropdown color="alternative" label="Actions" dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadImportTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>Import</DropdownItem>
                        <DropdownItem onClick={() => handleExportToExcel()}>Export</DropdownItem>
                    </Dropdown>
                    <Button onClick={() => setAddModal(true)}>Add Subject</Button>
                </div>
            </div>

            <TextInput
                className="mb-4 w-64"
                placeholder="Search subject code or name..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/** Table **/}
            <div className="w-full h-auto overflow-x-auto">
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Subject Code</TableHeadCell>
                            <TableHeadCell>Subject Name</TableHeadCell>
                            <TableHeadCell>Program</TableHeadCell>
                            <TableHeadCell>Requirements</TableHeadCell>
                            <TableHeadCell><span className="sr-only">Edit</span></TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {subjects.length > 0 ? (
                            subjects.map((s) => <SubjectTableRow key={s.subject_code} subject={s} />)
                        ) : (
                            <TableRow><TableCell colSpan={5} className="text-center">No subjects found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/** Pagination **/}
            <div className="mt-6 justify-self-center">
                <h1 className="text-center text-sm text-gray-500">
                    {rowCount > 0 ? `Showing ${startItem} to ${endItem} of ${rowCount} Subjects` : ""}
                </h1>
                <div className={`${totalPageCount > 1 ? "flex" : "hidden"} sm:justify-center mt-2`}>
                    <Pagination currentPage={currentPage} totalPages={totalPageCount || 1} onPageChange={onPageChange} showIcons />
                </div>
            </div>

            {/** Toast **/}
            <Toast className={`fixed block z-60 bottom-10 right-10 transition-opacity duration-500 ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center">
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${["200", "201", "204"].includes(statusCode) ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"}`}>
                        {["200", "201", "204"].includes(statusCode) ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 text-sm font-normal">{STATUS_MESSAGES[statusCode] || "Unknown error."}</div>
                    <ToastToggle onDismiss={() => setShowToast(false)} />
                </div>
                <Progress size="sm" className="mt-2" progress={progress} />
            </Toast>

            {/** Subject Requirements Modal **/}
            <Modal show={showReq} onClose={() => setShowReq(false)} size="lg">
                <ModalHeader className="border-b">
                    <div className="flex flex-col">
                        <span className="text-xl font-bold">{activeSubject?.subject_name}</span>
                        <span className="text-sm font-mono text-gray-500">{activeSubject?.subject_code}</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    {activeSubject && (
                        <RequirementsDisplay reqs={activeSubject.requirements} />
                    )}
                </ModalBody>
                <ModalFooter className="flex justify-end border-t">
                    <Button color="gray" onClick={() => setShowReq(false)}>
                        Close
                    </Button>
                </ModalFooter>
            </Modal>

            {/** Add Modal **/}
            <Modal show={addModal} initialFocus={AddModalSubjectNameInput} onClose={() => setAddModal(false)}>
                <ModalHeader>Create New Subject</ModalHeader>
                <ModalBody className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="subCode">Subject Code</Label>
                            <TextInput id="subCode" placeholder="e.g. INTE1025" value={selectedSubjectCode} onChange={(e) => { setSelectedSubjectCode(e.target.value); setActiveChanges(true); }} required />
                        </div>
                        <div>
                            <Label htmlFor="subName">Subject Name</Label>
                            <TextInput id="subName" ref={AddModalSubjectNameInput} placeholder="e.g. Data Structures" value={subjectNameVal} onChange={(e) => { setSubjectNameVal(e.target.value); setActiveChanges(true); }} required />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="progSelect">Belongs to Program</Label>
                        <Select id="progSelect" value={selectedProgramCode} onChange={(e) => { setSelectedProgramCode(e.target.value); setActiveChanges(true); }}>
                            <option value="">Select a Program</option>
                            {programs.map(p => <option key={p.program_code} value={p.program_code}>{p.program_code} - {p.program_name}</option>)}
                        </Select>
                    </div>

                    {/** AQ Tags **/}
                    <div>
                        <Label>Academic Qualifications (AQ - e.g. IT, CS)</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {aqTags.map(tag => (
                                <Badge key={tag} color="info" className="flex items-center gap-1">
                                    {tag} <span className="cursor-pointer font-bold" onClick={() => removeAqTag(tag)}>×</span>
                                </Badge>
                            ))}
                        </div>
                        <TextInput placeholder="Type AQ code and press Enter. Press [ENTER] to add." onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim().toUpperCase();
                                if (val && !aqTags.includes(val)) { setAqTags([...aqTags, val]); e.currentTarget.value = ""; setActiveChanges(true); }
                            }
                        }} />
                    </div>

                    {/** Other Tags **/}
                    <div>
                        <Label>Other Requirements (Skills/Experience)</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {otherTags.map(tag => (
                                <Badge key={tag} color="success" className="flex items-center gap-1">
                                    {tag} <span className="cursor-pointer font-bold" onClick={() => removeOtherTag(tag)}>×</span>
                                </Badge>
                            ))}
                        </div>
                        <Textarea placeholder={`[Example]: with experience in doing research\nPress [ENTER] to add.`} onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val && !otherTags.includes(val)) { setOtherTags([...otherTags, val]); e.currentTarget.value = ""; setActiveChanges(true); }
                            }
                        }} />
                    </div>
                </ModalBody>
                <ModalFooter className="flex justify-end space-x-2">
                    <Button color="alternative" onClick={() => activeChanges ? showWarning("yellow") : discardEntry()}>Cancel</Button>
                    <Button onClick={submitSubject}>Save Subject</Button>
                </ModalFooter>
            </Modal>

            {/** Edit Modal **/}
            <Modal show={editModal} initialFocus={EditModalSubjectNameInput} onClose={() => setEditModal(false)}>
                <ModalHeader>Editing Subject: {selectedSubjectCode}</ModalHeader>
                <ModalBody className="space-y-4">
                    <div>
                        <Label>Subject Name</Label>
                        <TextInput ref={EditModalSubjectNameInput} value={subjectNameVal} onChange={(e) => { setSubjectNameVal(e.target.value); setActiveChanges(true); }} />
                    </div>
                    <div>
                        <Label>Program</Label>
                        <Select value={selectedProgramCode} onChange={(e) => { setSelectedProgramCode(e.target.value); setActiveChanges(true); }}>
                            {programs.map(p => <option key={p.program_code} value={p.program_code}>{p.program_code}</option>)}
                        </Select>
                    </div>
                    {/* Reuse tag logic from Add Modal here for AQ/Other */}
                    <div>
                        <Label>AQ Reqs</Label>
                        <TextInput placeholder={"Enter AQ. [Example]: IT. Press [ENTER] to add."} onKeyDown={(e) => { if (e.key === 'Enter') { const val = e.currentTarget.value.trim().toUpperCase(); if (val && !aqTags.includes(val)) { setAqTags([...aqTags, val]); e.currentTarget.value = ""; setActiveChanges(true); } } }} />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {aqTags.map(tag => (
                                <Badge key={tag} color="info">{tag} <span className="cursor-pointer ml-1" onClick={() => removeAqTag(tag)}>×</span></Badge>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label>Other Requirements (Skills/Experience)</Label>
                        <Textarea placeholder={`[Example]: with experience in doing research\nPress [ENTER] to add.`} onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val && !otherTags.includes(val)) { setOtherTags([...otherTags, val]); e.currentTarget.value = ""; setActiveChanges(true); }
                            }
                        }} />

                        <div className="flex flex-wrap h-28 overflow-y-auto gap-2 mt-2">
                            {otherTags.map(tag => (
                                <Badge key={tag} color="success" className="flex items-center gap-1">
                                    {tag} <span className="cursor-pointer font-bold" onClick={() => removeOtherTag(tag)}>×</span>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="flex justify-between">
                    <Button outline color="dark" onClick={() => showWarning("red")}><HiOutlineTrash className="text-red-600 h-5 w-5"/></Button>
                    <div className="flex space-x-2">
                        <Button color="alternative" onClick={() => activeChanges ? showWarning("yellow") : discardEntry()}>Cancel</Button>
                        <Button onClick={() => showWarning("default")}>Update</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/** Warning Modal **/}
            <Modal show={openWarningModal} size="md" popup onClose={() => setOpenWarningModal(false)}>
                <ModalHeader />
                <ModalBody className="text-center">
                    {warningType === "red" ? (
                        <>
                            <HiOutlineTrash className="mx-auto mb-4 h-14 w-14 text-red-500" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500">Delete this subject forever?</h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                <Button color="red" onClick={deleteRow}>Yes, Delete</Button>
                            </div>
                        </>
                    ) : warningType === "yellow" ? (
                        <>
                            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-yellow-500" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500">Discard all unsaved changes?</h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                <Button color="warning" onClick={discardEntry}>Yes, Discard</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-blue-500" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500">Save changes to this subject?</h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                <Button color="info" onClick={updateEntry}>Yes, Save</Button>
                            </div>
                        </>
                    )}
                </ModalBody>
            </Modal>

            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleImport} />
        </div>
    );
}