"use client"

import {
    Button,
    Dropdown,
    DropdownItem, Label, Modal, ModalBody, ModalFooter, ModalHeader, Pagination, Progress, Select, Spinner,
    Table,
    TableBody, TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    TextInput, Toast, ToastToggle
} from "flowbite-react";
import React, {useEffect, useRef, useState} from "react";
import {
    insertSubject,
    updateSubject,
    deleteSubject,
    fetchSubjects,
    fetchSubjectCount
} from "@/services/userService.ts";
import {HiCheck, HiExclamation, HiOutlineExclamationCircle, HiOutlineTrash} from "react-icons/hi";
import {limitNumericValueShort, sanitizeLongName} from "@/lib/validation.ts";
import {VscSave} from "react-icons/vsc";

export default function SubjectsManager() {
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // UI Modals
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [warningType, setWarningType] = useState("");

    // Form useStates for Subjects
    const [curriculumnVersionVal, setCurriculumnVersionVal] = useState("");
    const [courseCodeVal, setCourseCodeVal] = useState("");
    const [courseNameVal, setCourseNameVal] = useState("");
    const [specializationVal, setSpecializationVal] = useState("");
    const [lectureVal, setLectureVal] = useState("0");
    const [labVal, setLabVal] = useState("0");
    const [labTypeVal, setLabTypeVal] = useState(""); 
    const [yearVal, setYearVal] = useState("1");
    const [termVal, setTermVal] = useState("1");

    const [activeChanges, setActiveChanges] = useState(false);
    const AddModalCourseNameInput = useRef<HTMLInputElement>(null);
    const EditModalCourseNameInput = useRef<HTMLInputElement>(null);

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
        "400": "Invalid data provided.",
        "422": "Lab Type is required for Lab Units.",
        "409": "Subject already exists in this curriculum version.",
        "412": "Both Lecture and Lab cannot be zero.",
        "500": "Server error. Please try again later."
    };

    /** UI Functions **/
    function editModalValue(curVersion: string, courseCode: string) {
        const subject = subjects.find(s => s.curriculumn_version === curVersion && s.course_code === courseCode);
        if (!subject) return;

        setCurriculumnVersionVal(subject.curriculumn_version);
        setCourseCodeVal(subject.course_code);
        setCourseNameVal(subject.course_name);
        setSpecializationVal(subject.field_of_specialization || "");
        setLectureVal(subject.lecture.toString() || "0");
        setLabVal(subject.lab.toString() || "0");
        setLabTypeVal(subject.lab_type || "");

        if (subject["year-term"]) {
            const [y, t] = subject["year-term"].split("-");
            setYearVal(y || "1");
            setTermVal(t || "1");
        }

        setEditModal(true);
    }

    function showWarning(type: string) {
        setWarningType(type);
        setOpenWarningModal(true);
    }

    function discardEntry() {
        setCurriculumnVersionVal("");
        setCourseCodeVal("");
        setCourseNameVal("");
        setSpecializationVal("");
        setLectureVal("0");
        setLabVal("0");
        setLabTypeVal("");
        setYearVal("1");
        setTermVal("1");
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    /** Filtering **/
    function limitCourseNameVal(inputText: string){
        setCourseNameVal(sanitizeLongName(inputText));
    }

    function limitLabUnits(inputNum: string){
        if (inputNum === "") {
            setLabVal("0");
            return;
        }
        setLabVal(limitNumericValueShort(inputNum));
    }

    function limitLectureUnits(inputNum: string){
        if (inputNum === "") {
            setLectureVal("0");
            return;
        }
        setLectureVal(limitNumericValueShort(inputNum));
    }

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

            // Header Validation
            const firstHeader = worksheet?.getRow(1).getCell(1).value?.toString();
            if (firstHeader !== 'Curriculum Version') {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    const curVersion = row.getCell(1).value?.toString().trim() || "";
                    const code = row.getCell(2).value?.toString().trim() || "";
                    const name = row.getCell(3).value?.toString().trim() || "";
                    const spec = row.getCell(4).value?.toString().trim() || "";
                    const lec = parseFloat(row.getCell(5).value?.toString() || "0");
                    const lab = parseFloat(row.getCell(6).value?.toString() || "0");
                    const labType = row.getCell(7).value?.toString().trim() || "";
                    const yearTerm = row.getCell(8).value?.toString().trim() || "1-1";

                    // Requirement: Both cannot be zero
                    if (lec === 0 && lab === 0) {
                        console.warn(`[IMPORT_VALIDATION]: Skipping row ${rowNumber} - both lec and lab are zero.`);
                        return;
                    }

                    if (lab > 0 && (!labType || labType === "--- none ---")) {
                        console.warn(`[IMPORT_VALIDATION]: Skipping row ${rowNumber} due to missing Lab Type for Lab Units > 0.`);
                        return;
                    }

                    if (curVersion && code && name) {
                        rows.push({ curVersion, code, name, spec, lec, lab, labType: labType === "--- none ---" ? "" : labType, yearTerm });
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
                const res = await insertSubject(sub.curVersion, sub.code, sub.name, sub.spec, sub.lec, sub.lab, sub.labType, sub.yearTerm);
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

            // 1. Define Columns
            worksheet.columns = [
                { header: 'Curriculum Version', key: 'curVersion', width: 20 },
                { header: 'Course Code', key: 'code', width: 20 },
                { header: 'Course Name', key: 'name', width: 40 },
                { header: 'Field of Specialization', key: 'spec', width: 30 },
                { header: 'Lecture', key: 'lec', width: 10 },
                { header: 'Lab', key: 'lab', width: 10 },
                { header: 'Lab Type', key: 'labType', width: 20 },
                { header: 'Year-Term', key: 'yearTerm', width: 15 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };

            worksheet.addRow({
                curVersion: 'BSIT-22-01',
                code: 'INTE1049',
                name: 'Professional Issues in Information Systems and Technology',
                spec: 'Information Technology',
                lec: 2,
                lab: 1.5,
                labType: 'Computer Lab',
                yearTerm: '4-1'
            });

            const typeOptions = ['Computer Lab', 'Culinary Lab', 'Mock Bar', 'Mock Hotel', 'Gym', 'AVR'];
            for (let i = 2; i <= 100; i++) {
                worksheet.getCell(`G${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${typeOptions.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Lab Type',
                    error: 'Please select a type from the dropdown list.'
                };
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
                { header: 'Curriculum Version', key: 'curVersion', width: 20 },
                { header: 'Course Code', key: 'code', width: 20 },
                { header: 'Course Name', key: 'name', width: 40 },
                { header: 'Field of Specialization', key: 'spec', width: 30 },
                { header: 'Lecture', key: 'lec', width: 10 },
                { header: 'Lab', key: 'lab', width: 10 },
                { header: 'Lab Type', key: 'labType', width: 15 },
                { header: 'Year-Term', key: 'yearTerm', width: 15 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };

            const exportData = subjects.map(s => ({
                curVersion: s.curriculumn_version,
                code: s.course_code,
                name: s.course_name,
                spec: s.field_of_specialization || '',
                lec: s.lecture || 0,
                lab: s.lab || 0,
                labType: s.lab_type || '',
                yearTerm: s["year-term"]
            }));

            worksheet.addRows(exportData);

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
        if (!curriculumnVersionVal || !courseCodeVal || !courseNameVal) {
            setStatusCode("400");
            setShowToast(true);
            return;
        }

        const lec = parseFloat(lectureVal);
        const lab = parseFloat(labVal);
        const yearTerm = yearVal == "11" || yearVal == "12" ? `${yearVal}` : `${yearVal}-${termVal}`;

        // Validation: Both cannot be zero
        if (lec === 0 && lab === 0) {
            setStatusCode("412");
            setShowToast(true);
            return;
        }

        if (lab > 0 && (!labTypeVal || labTypeVal === "")) {
            setStatusCode("422");
            setShowToast(true);
            return;
        }

        setLoading(true);

        const stat = await insertSubject(
            curriculumnVersionVal,
            courseCodeVal,
            courseNameVal,
            specializationVal,
            lec,
            lab,
            labTypeVal,
            yearTerm
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
        if (!curriculumnVersionVal || !courseCodeVal || !courseNameVal) {
            setStatusCode("400");
            setShowToast(true);
            return;
        }

        const lec = parseFloat(lectureVal);
        const lab = parseFloat(labVal);
        const yearTerm = yearVal == "11" || yearVal == "12" ? `${yearVal}` : `${yearVal}-${termVal}`;

        // Validation: Both cannot be zero
        if (lec === 0 && lab === 0) {
            setStatusCode("412");
            setShowToast(true);
            return;
        }

        if (lab > 0 && (!labTypeVal || labTypeVal === "")) {
            setStatusCode("422");
            setShowToast(true);
            return;
        }

        setLoading(true);

        const stat = await updateSubject(
            curriculumnVersionVal,
            courseCodeVal,
            courseNameVal,
            specializationVal,
            lec,
            lab,
            labTypeVal,
            yearTerm
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
        setLoading(true);

        const stat = await deleteSubject(curriculumnVersionVal, courseCodeVal);

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
            const [subData, subCount] = await Promise.all([
                fetchSubjects(debouncedSearch, currentPage),
                fetchSubjectCount(debouncedSearch)
            ]);
            setSubjects(subData);
            setRowCount(subCount);
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
            setLoading(true);
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

    const SubjectTableRow = ({ subject }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell className="font-medium text-gray-900 dark:text-white">
                    {subject.curriculumn_version}
                </TableCell>
                <TableCell>{subject.course_code}</TableCell>
                <TableCell>{subject.course_name}</TableCell>
                <TableCell>{subject["year-term"] || "1-1"}</TableCell>
                <TableCell>{subject.lecture}</TableCell>
                <TableCell>{subject.lab} | {subject.lab_type || "None"}</TableCell>
                <TableCell className="flex justify-end">
                    <Button color="alternative" onClick={() => editModalValue(subject.curriculumn_version, subject.course_code)}>
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
                    <Spinner aria-label="Syncing spinner" size="xl" />
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
                placeholder="Search code, name or version..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/** Table **/}
            <div className="w-full h-auto overflow-x-auto">
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Curriculum</TableHeadCell>
                            <TableHeadCell>Code</TableHeadCell>
                            <TableHeadCell>Name</TableHeadCell>
                            <TableHeadCell>Yr-Term</TableHeadCell>
                            <TableHeadCell>Lec</TableHeadCell>
                            <TableHeadCell>Lab</TableHeadCell>
                            <TableHeadCell><span className="sr-only">Edit</span></TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {subjects.length > 0 ? (
                            subjects.map((s) => <SubjectTableRow key={`${s.curriculumn_version}-${s.course_code}`} subject={s} />)
                        ) : (
                            <TableRow><TableCell colSpan={7} className="text-center bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">No subjects found.</TableCell></TableRow>
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

            {/** Add Modal **/}
            <Modal show={addModal} initialFocus={AddModalCourseNameInput} onClose={() => setAddModal(false)}>
                <ModalHeader>Create New Subject</ModalHeader>
                <ModalBody className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="curVersion">Curriculum Version</Label>
                            <TextInput id="curVersion" placeholder="e.g. BSIT-24-01" value={curriculumnVersionVal} onChange={(e) => { setCurriculumnVersionVal(e.target.value); setActiveChanges(true); }} required />
                        </div>
                        <div>
                            <Label htmlFor="courseCode">Course Code</Label>
                            <TextInput id="courseCode" placeholder="e.g. INTE1025" value={courseCodeVal} onChange={(e) => { setCourseCodeVal(e.target.value); setActiveChanges(true); }} required />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="courseName">Course Name</Label>
                        <TextInput id="courseName" ref={AddModalCourseNameInput} placeholder="e.g. Data Structures" value={courseNameVal} onChange={(e) => { limitCourseNameVal(e.target.value); setActiveChanges(true); }} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="year">Year Level</Label>
                            <Select id="year" value={yearVal} onChange={(e) => { setYearVal(e.target.value); setActiveChanges(true); }}>
                                <option value="11">Grade 11</option>
                                <option value="12">Grade 12</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="term">Term/Semester</Label>
                            <Select id="term"
                                    value={termVal}
                                    disabled={yearVal == "11" || yearVal == "12"}
                                    onChange={(e) => { setTermVal(e.target.value); setActiveChanges(true); }}>
                                <option value="1">1st Semester</option>
                                <option value="2">2nd Semester</option>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="spec">Field of Specialization</Label>
                        <TextInput id="spec" placeholder="e.g. Software Engineering" value={specializationVal} onChange={(e) => { setSpecializationVal(e.target.value); setActiveChanges(true); }} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="lec">Lecture Units</Label>
                            <TextInput id="lec"
                                       step={"0.1"}
                                       value={lectureVal}
                                       onFocus={(e) => e.target.value === "0" ? setLectureVal("") : e.target.value}
                                       onBlur={(e) => e.target.value === "" ? setLectureVal("0") : e.target.value}
                                       onChange={(e) => { limitLectureUnits(e.target.value); setActiveChanges(true); }} />
                        </div>
                        <div>
                            <Label htmlFor="lab">Lab Units</Label>
                            <TextInput id="lab"
                                       step={"0.1"}
                                       value={labVal}
                                       onFocus={(e) => e.target.value === "0" ? setLabVal("") : e.target.value}
                                       onBlur={(e) => e.target.value === "" ? setLabVal("0") : e.target.value}
                                       onChange={(e) => { limitLabUnits(e.target.value); setActiveChanges(true); }} />
                        </div>
                        <div>
                            <Label htmlFor="labType">Lab Type {parseFloat(labVal) > 0 && <span className="text-red-500">*</span>}</Label>
                            <Select id="labType"
                                    value={labTypeVal}
                                    onChange={(e) => {
                                        setLabTypeVal(e.target.value === "--- none ---" ? "" : e.target.value);
                                        setActiveChanges(true);
                                    }}
                            >
                                <option value="">--- none ---</option>
                                <option value="Computer Lab">Computer Lab</option>
                                <option value="Culinary Lab">Culinary Lab</option>
                                <option value="Mock Bar">Mock Bar</option>
                                <option value="Mock Hotel">Mock Hotel</option>
                                <option value="Gym">Gym</option>
                                <option value="AVR">AVR</option>
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="flex justify-end space-x-2">
                    <Button color="alternative" onClick={() => activeChanges ? showWarning("yellow") : discardEntry()}>Cancel</Button>
                    <Button onClick={submitSubject}>Save Subject</Button>
                </ModalFooter>
            </Modal>

            {/** Edit Modal **/}
            <Modal show={editModal} initialFocus={EditModalCourseNameInput} onClose={() => setEditModal(false)}>
                <ModalHeader>Editing Subject: {courseCodeVal}</ModalHeader>
                <ModalBody className="space-y-4">
                    <p className="text-sm text-gray-500 italic">Curriculum: {curriculumnVersionVal}</p>
                    <div>
                        <Label>Course Name</Label>
                        <TextInput ref={EditModalCourseNameInput} value={courseNameVal} onChange={(e) => { limitCourseNameVal(e.target.value); setActiveChanges(true); }} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Year Level</Label>
                            <Select value={yearVal} onChange={(e) => { setYearVal(e.target.value); setActiveChanges(true); }}>
                                <option value="11">Grade 11</option>
                                <option value="12">Grade 12</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </Select>
                        </div>
                        <div>
                            <Label>Term/Semester</Label>
                            <Select value={termVal}
                                    disabled={yearVal == "11" || yearVal == "12"}
                                    onChange={(e) => { setTermVal(e.target.value); setActiveChanges(true); }}>
                                <option value="1">1st Semester</option>
                                <option value="2">2nd Semester</option>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label>Field of Specialization</Label>
                        <TextInput value={specializationVal} onChange={(e) => { setSpecializationVal(e.target.value); setActiveChanges(true); }} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Lecture Units</Label>
                            <TextInput value={lectureVal}
                                       step={"0.1"}
                                       onFocus={(e) => e.target.value === "0" ? setLectureVal("") : e.target.value}
                                       onBlur={(e) => e.target.value === "" ? setLectureVal("0") : e.target.value}
                                       onChange={(e) => { limitLectureUnits(e.target.value); setActiveChanges(true); }} />
                        </div>
                        <div>
                            <Label>Lab Units</Label>
                            <TextInput value={labVal}
                                       step={"0.1"}
                                       onFocus={(e) => e.target.value === "0" ? setLabVal("") : e.target.value}
                                       onBlur={(e) => e.target.value === "" ? setLabVal("0") : e.target.value}
                                       onChange={(e) => { limitLabUnits(e.target.value); setActiveChanges(true); }} />
                        </div>
                        <div>
                            <Label htmlFor="labType">Lab Type {parseFloat(labVal) > 0 && <span className="text-red-500">*</span>}</Label>
                            <Select id="labType"
                                    value={labTypeVal}
                                    onChange={(e) => {
                                        setLabTypeVal(e.target.value === "--- none ---" ? "" : e.target.value);
                                        setActiveChanges(true);
                                    }}
                            >
                                <option value="">--- none ---</option>
                                <option value="Computer Lab">Computer Lab</option>
                                <option value="Culinary Lab">Culinary Lab</option>
                                <option value="Mock Bar">Mock Bar</option>
                                <option value="Mock Hotel">Mock Hotel</option>
                                <option value="Gym">Gym</option>
                                <option value="AVR">AVR</option>
                            </Select>
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
                                <Button color="red" onClick={discardEntry}>Yes, Discard</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <VscSave className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500">Save changes to this subject?</h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                <Button color="default" onClick={updateEntry}>Yes, Save</Button>
                            </div>
                        </>
                    )}
                </ModalBody>
            </Modal>

            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleImport} />
        </div>
    );
}
