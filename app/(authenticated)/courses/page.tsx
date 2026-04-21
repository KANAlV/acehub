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
    insertProgram,
    fetchProgramCount,
    fetchPrograms,
    getAllProgramsData,
    updateProgram,
    deleteProgram
} from "@/services/userService.ts";
import {HiCheck, HiExclamation, HiOutlineExclamationCircle, HiOutlineTrash} from "react-icons/hi";
import { VscSave } from "react-icons/vsc";
import {numericValueOnly, sanitizeLongName, sanitizeVeryShortName} from "@/lib/validation.ts";

/** --- Helper Components --- **/
const ProgramTableRow = ({ program, editModalValue }: { program: any, editModalValue: (id: string) => void }) => {
    // Ensure students is an object
    const students = typeof program.students === 'string' ? JSON.parse(program.students) : (program.students || {});
    const totalStudents = Object.values(students).reduce((a: any, b: any) => (a as number) + (b as number), 0);
    
    return (
        <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
            <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                {program.program_code}
            </TableCell>
            <TableCell>{program.program_name}</TableCell>
            <TableCell>{program.level}</TableCell>
            <TableCell>
                <div className="text-xs">
                    {Object.entries(students).map(([year, count]) => (
                        <span key={year} className={`${year=="11"||year=="12"? "bg-yellow-300 text-blue-700":"bg-blue-700 text-white"} font-extrabold mr-2 px-1 rounded`}>Y{year}: {count as number}</span>
                    ))}
                </div>
            </TableCell>
            <TableCell className={"flex justify-end"}>
                <Button color="alternative" onClick={() => editModalValue(program.program_code)}>
                    Edit
                </Button>
            </TableCell>
        </TableRow>
    );
}

const StudentInputs = ({ academicLevelVal, studentsVal, handleStudentChange }: { 
    academicLevelVal: string, 
    studentsVal: Record<string, string>, 
    handleStudentChange: (year: string, val: string) => void 
}) => {
    const years = academicLevelVal === "SHS" ? ["11", "12"] : ["1", "2", "3", "4"];
    return (
        <div className="grid grid-cols-2 gap-3 mt-4">
            {years.map(year => (
                <div key={year}>
                    <Label htmlFor={`year-${year}`}>Year {year} Students</Label>
                    <TextInput
                        id={`year-${year}`}
                        value={studentsVal[year] || ""}
                        placeholder="0"
                        onChange={(e) => handleStudentChange(year, e.target.value)}
                    />
                </div>
            ))}
        </div>
    );
};

export default function CoursesManager() {
    const [loading, setLoading] = useState(true); // spinner state
    const [programs, setPrograms] = useState([]); // program rows are stored here
    const fileInputRef = useRef<HTMLInputElement>(null);

    // search
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // UI consts
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [warningType, setWarningType] = useState(""); // Track What warning will show

    // form useStates
    const [selectedProgram, setSelectedProgram] = useState(""); // Track the program being edited
    const [programNameVal, setProgramNameVal] = useState("");
    const [academicLevelVal, setAcademicLevelVal] = useState("College");
    
    // Student counts per year level
    const [studentsVal, setStudentsVal] = useState<Record<string, string>>({
        "1": "", "2": "", "3": "", "4": ""
    });

    const [activeChanges, setActiveChanges] = useState(false); // Track if there are changes in edit to toggle between cancel and discard
    const AddModalProgramNameInput = useRef<HTMLInputElement>(null); // for initialFocus of AddModal
    const EditModalProgramNameInput = useRef<HTMLInputElement>(null); // for initialFocus of EditModal


    // Toast
    const [showToast, setShowToast] = useState(false);
    const [progress, setProgress] = useState(100); // Toast progress bar

    // pagination consts
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setRowCount] = useState(1);
    const totalPageCount = Math.ceil(rowCount / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, rowCount);  // Math.min to ensure not to show a number

    //Return Status
    const [statusCode, setStatusCode] = useState("");
    const STATUS_MESSAGES = {
        "200": "Update successful.",
        "201": "Program created successfully.",
        "204": "Program deleted successfully.",
        "400": "Invalid data provided.",
        "404": "Program not found.",
        "409": "Conflict: Program Code already exists.",
        "500": "Server error. Please try again later."
    };

    /** UI Functions **/
    function editModalValue(id: string) {
        const program = programs.find(p => p.program_code == id);

        if (!program) {
            console.error(`[UI_ERROR]: Could not find program with code ${id} in local state.`);
            return;
        }

        console.log(`[UI_ACTION]: Opening Edit Modal for Program: "${program.program_name}" (ID: ${id})`);

        setSelectedProgram(program.program_code);
        setProgramNameVal(program.program_name);
        setAcademicLevelVal(program.level);
        
        // Ensure students is handled as an object
        const dbStudents = typeof program.students === 'string' ? JSON.parse(program.students) : (program.students || {});
        const newStudents: Record<string, string> = {};
        
        if (program.level === "SHS") {
            newStudents["11"] = dbStudents["11"]?.toString() || "";
            newStudents["12"] = dbStudents["12"]?.toString() || "";
        } else {
            newStudents["1"] = dbStudents["1"]?.toString() || "";
            newStudents["2"] = dbStudents["2"]?.toString() || "";
            newStudents["3"] = dbStudents["3"]?.toString() || "";
            newStudents["4"] = dbStudents["4"]?.toString() || "";
        }
        
        setStudentsVal(newStudents);
        setEditModal(true);
    }

    function showWarning(color: string) {
        setWarningType(color);
        setOpenWarningModal(true);
    }

    function discardEntry() {
        setSelectedProgram("");
        setProgramNameVal("");
        setAcademicLevelVal("College");
        setStudentsVal({ "1": "", "2": "", "3": "", "4": "" });
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    /** Filtering **/
    function filterProgramCode(e:string) {
        setSelectedProgram(sanitizeVeryShortName(e))
    }

    function filterProgramName(e:string) {
        setProgramNameVal(sanitizeLongName(e))
    }

    function handleStudentChange(year: string, val: string) {
        setStudentsVal(prev => ({
            ...prev,
            [year]: numericValueOnly(val)
        }));
        setActiveChanges(true);
    }

    function handleLevelChange(level: string) {
        setAcademicLevelVal(level);
        if (level === "SHS") {
            setStudentsVal({ "11": "", "12": "" });
        } else {
            setStudentsVal({ "1": "", "2": "", "3": "", "4": "" });
        }
        setActiveChanges(true);
    }

    /** Import/Export **/
    async function handleProgramExport() {
        try {
            const programs = await getAllProgramsData();
            if (!programs || programs.length === 0) return "404";

            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Programs Export');

            worksheet.columns = [
                { header: 'Program Code', key: 'code', width: 15 },
                { header: 'Program Name', key: 'name', width: 45 },
                { header: 'Level', key: 'level', width: 15 },
                { header: 'Students JSON', key: 'students', width: 30 },
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };

            const flattenedData = programs.map(p => ({
                code: p.program_code,
                name: p.program_name,
                level: p.level,
                students: JSON.stringify(p.students)
            }));

            worksheet.addRows(flattenedData);

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Programs_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            return "200";
        } catch (error) {
            console.error("[EXPORT_ERROR]:", error);
            return "500";
        }
    }

    async function downloadProgramTemplate() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Programs Template');

            worksheet.columns = [
                { header: 'Program Code', key: 'code', width: 15 },
                { header: 'Program Name', key: 'name', width: 45 },
                { header: 'Level', key: 'level', width: 15 },
                { header: 'Students JSON', key: 'students', width: 30 },
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };

            worksheet.addRow({ code: 'BSIT', name: 'BS Information Technology', level: 'College', students: '{"1":40,"2":35,"3":30,"4":25}' });
            worksheet.addRow({ code: 'STEM', name: 'Science & Technology', level: 'SHS', students: '{"11":100,"12":95}' });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Program_Import_Template.xlsx`);

            return "200";
        } catch (error) {
            console.error("[TEMPLATE_ERROR]:", error);
            return "500";
        }
    }

    async function handleProgramImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !e.target) return;

        setLoading(true);

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const worksheet = workbook.getWorksheet(1);
            const programsToImport: any[] = [];

            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;

                const code = row.getCell(1).value?.toString().trim();
                const name = row.getCell(2).value?.toString().trim();
                const level = row.getCell(3).value?.toString().trim();
                const studentsStr = row.getCell(4).value?.toString().trim();

                if (!code || !level) return;

                try {
                    const studentsObj = studentsStr ? JSON.parse(studentsStr) : {};
                    programsToImport.push({ code, name, level, students: studentsObj });
                } catch (e) {
                    console.error("Invalid JSON in import row", rowNumber);
                }
            });

            let successCount = 0;
            for (const program of programsToImport) {
                const res = await insertProgram(program.code, program.name, program.level, program.students);
                if (res !== "500" && res !== "409") successCount++;
            }

            setStatusCode(successCount > 0 ? "201" : "400");
            setLoading(false);
            setShowToast(true);
            await Promise.all([loadProgramCount(), loadProgramData()]);

        } catch (error) {
            console.error("[IMPORT_ERROR]:", error);
            setStatusCode("500");
            setShowToast(true);
        } finally {
            if (e.target) e.target.value = "";
            setLoading(false);
        }
    }

    /** Queries **/
    async function submitProgram() {
        if (!selectedProgram || !programNameVal || !academicLevelVal) {
            console.warn("[UI_VALIDATION]: Missing fields.");
            return;
        }

        setLoading(true);
        
        // Convert string values to numbers for JSONB storage
        const studentsToSave: Record<string, number> = {};
        Object.entries(studentsVal).forEach(([k, v]) => {
            studentsToSave[k] = parseInt(v || "0");
        });

        try {
            const stat = await insertProgram(selectedProgram, programNameVal, academicLevelVal, studentsToSave);
            setStatusCode(stat);
            if (stat === "201") {
                discardEntry();
                setSearch("");
                await Promise.all([loadProgramCount(), loadProgramData()]);
            }
        } catch (error) {
            setStatusCode("500");
        } finally {
            setLoading(false);
            setShowToast(true);
        }
    }

    async function updateEntry() {
        const studentsToSave: Record<string, number> = {};
        Object.entries(studentsVal).forEach(([k, v]) => {
            studentsToSave[k] = parseInt(v || "0");
        });

        setLoading(true);
        try {
            const stat = await updateProgram(selectedProgram, programNameVal, academicLevelVal, studentsToSave);
            setStatusCode(stat);
            if (stat === "200") {
                discardEntry();
                setSearch("");
                await Promise.all([loadProgramCount(), loadProgramData()]);
            }
        } catch (error) {
            setStatusCode("500");
        } finally {
            setLoading(false);
            setShowToast(true);
        }
    }

    async function deleteRow() {
        setLoading(true);
        try {
            const stat = await deleteProgram(selectedProgram);
            setStatusCode(stat);
            if (stat === "204") {
                discardEntry();
                await Promise.all([loadProgramCount(), loadProgramData()]);
            }
        } catch (error) {
            setStatusCode("500");
        } finally {
            setLoading(false);
            setShowToast(true);
        }
    }

    const loadProgramData = async () => {
        const data = await fetchPrograms(search, currentPage);
        setPrograms(data);
    }

    const loadProgramCount = async () => {
        const rowCount = await fetchProgramCount(search);
        setRowCount(rowCount);
    }

    const onPageChange = (page: number) => {
        setCurrentPage(page);
    };

    useEffect(() => {
        let isCancelled = false;
        const fetchData = async () => {
            setLoading(true);
            try {
                await Promise.all([loadProgramCount(), loadProgramData()]);
                if (!isCancelled) setLoading(false);
            } catch (error) {
                if (!isCancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { isCancelled = true; };
    }, [currentPage, debouncedSearch]);

    useEffect(() => {
        if (showToast) {
            setProgress(100);
            const interval = setInterval(() => setProgress((prev) => Math.max(0, prev - (100 / (5000 / 50)))), 50);
            const timeout = setTimeout(() => setShowToast(false), 5000);
            return () => { clearInterval(interval); clearTimeout(timeout); };
        }
    }, [showToast]);

    useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 1000);
        return () => clearTimeout(handler);
    }, [search]);

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            {/** Loading Spinner **/}
            <div className={`${loading? "":"hidden"} fixed inset-0 z-9999 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm cursor-wait`}>
                <div className="flex flex-col items-center gap-4">
                    <Spinner aria-label="Extra large spinner example" size="xl" />
                    <p className="text-white font-semibold text-lg drop-shadow-md">Syncing Sections...</p>
                </div>
            </div>

            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-4 font-bold text-2xl"}>Manage Sections:</h1>
                <div className={"flex space-x-3"}>
                    <Dropdown color={"alternative"} label={"Actions"} dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadProgramTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>Import</DropdownItem>
                        <DropdownItem onClick={() => handleProgramExport()}>Export</DropdownItem>
                    </Dropdown>
                    <Button onClick={() => setAddModal(true)}>Add Course</Button>
                </div>
            </div>

            <TextInput
                className="mb-4 w-62"
                placeholder="Search..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
            />

            <div className={"w-full md:w-auto h-auto overflow-x-scroll md:overflow-clip"}>
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Code</TableHeadCell>
                            <TableHeadCell>Program Name</TableHeadCell>
                            <TableHeadCell>Academic Lvl.</TableHeadCell>
                            <TableHeadCell>Students Breakdown</TableHeadCell>
                            <TableHeadCell><span className="sr-only">Edit</span></TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {programs.length > 0 ? (
                            programs.map((program) => (
                                <ProgramTableRow key={program.program_code} program={program} editModalValue={editModalValue}/>
                            ))
                        ) : (
                            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                                <TableCell colSpan={5} className="whitespace-nowrap font-medium text-center text-gray-900 dark:text-white">
                                    No programs found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className={"mt-6 justify-self-center"}>
                <h1 className="text-center">
                    {rowCount > 0 ? `Showing ${startItem} to ${endItem} of ${rowCount} Entries` : ""}
                </h1>
                <div className={`${totalPageCount > 1? "flex":"hidden"} overflow-x-auto sm:justify-center`}>
                    <Pagination currentPage={currentPage} totalPages={totalPageCount == 0? 1:totalPageCount} onPageChange={onPageChange} showIcons />
                </div>
            </div>

            {/** Toast **/}
            <Toast className={`fixed block z-60 bottom-10 right-10 transition-opacity duration-500 ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className={"flex items-center"}>
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       ${["200", "201", "204"].includes(statusCode) && ("bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200")}
                       ${["400", "409"].includes(statusCode) && ("bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200")}
                       ${statusCode == "500"? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200":null}
                    `}>
                        {["200", "201", "204"].includes(statusCode) && <HiCheck className="h-5 w-5" />}
                        {["400", "404", "409", "500"].includes(statusCode) && <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 text-sm font-normal">{STATUS_MESSAGES[statusCode] || "An unknown error occurred."}</div>
                    <ToastToggle onDismiss={() => { setShowToast(false); setProgress(0); }} />
                </div>
                <Progress size={"sm"} className={"mt-2 mb-0 pb-0"} progress={progress}/>
            </Toast>

            {/** Modals **/}
            {/** Add Modal **/}
            <Modal size={"md"} show={addModal} initialFocus={AddModalProgramNameInput} onClose={() => setAddModal(false)}>
                <ModalHeader>Add Program</ModalHeader>
                <ModalBody>
                    <div className="flex gap-4">
                        <div className={"w-4/10"}>
                            <Label htmlFor="programCode">Program Code</Label>
                            <TextInput id="programCode" value={selectedProgram} onChange={(e) => { filterProgramCode(e.target.value); setActiveChanges(true); }} required />
                        </div>
                        <div className={"w-6/10"}>
                            <Label htmlFor="programName">Program Name</Label>
                            <TextInput id="programName" ref={AddModalProgramNameInput} value={programNameVal} onChange={(e) => { filterProgramName(e.target.value); setActiveChanges(true); }} required />
                        </div>
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="acadLvl">Program Type</Label>
                        <Select id="acadLvl" className="w-full" value={academicLevelVal} onChange={(e) => handleLevelChange(e.target.value)}>
                            <option value="College">College</option>
                            <option value="SHS">SHS</option>
                        </Select>
                    </div>
                    <StudentInputs academicLevelVal={academicLevelVal} studentsVal={studentsVal} handleStudentChange={handleStudentChange} />
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="alternative" onClick={activeChanges ? () => showWarning("yellow") : discardEntry}>
                        {activeChanges ? "Discard" : "Cancel"}
                    </Button>
                    <Button onClick={submitProgram}>Save</Button>
                </ModalFooter>
            </Modal>

            {/** Edit Modal **/}
            <Modal size={"md"} show={editModal} initialFocus={EditModalProgramNameInput} onClose={() => setEditModal(false)}>
                <ModalHeader>Editing Program: {selectedProgram}</ModalHeader>
                <ModalBody>
                    <div>
                        <Label htmlFor="programName">Program Name</Label>
                        <TextInput id="programName" ref={EditModalProgramNameInput} value={programNameVal} onChange={(e) => { filterProgramName(e.target.value); setActiveChanges(true); }} required />
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="acadLvl">Program Type</Label>
                        <Select id="acadLvl" className="w-full" value={academicLevelVal} onChange={(e) => handleLevelChange(e.target.value)}>
                            <option value="College">College</option>
                            <option value="SHS">SHS</option>
                        </Select>
                    </div>
                    <StudentInputs academicLevelVal={academicLevelVal} studentsVal={studentsVal} handleStudentChange={handleStudentChange} />
                </ModalBody>
                <ModalFooter>
                    <Button outline color={"dark"} className={"p-2"} onClick={() => showWarning("red")}>
                        <HiOutlineTrash color={"red"} className={"size-6"}/>
                    </Button>
                    <div className={"flex w-full justify-end space-x-2"}>
                        <Button color="alternative" onClick={activeChanges ? () => showWarning("yellow") : discardEntry}>
                            {activeChanges ? "Discard" : "Cancel"}
                        </Button>
                        <Button onClick={() => showWarning("default")}>Save</Button>
                    </div>
                </ModalFooter>
            </Modal>

            <Modal show={openWarningModal} size="md" onClose={() => setOpenWarningModal(false)} popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        {warningType=="red"?(
                            <>
                                <HiOutlineTrash className="mx-auto mb-4 h-14 w-14 text-gray-400" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500">Delete this entry?</h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                    <Button color="red" onClick={deleteRow}>Yes</Button>
                                </div>
                            </>):(
                            warningType == "yellow"? (<>
                                <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500">Discard all changes?</h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                    <Button color="red" onClick={discardEntry}>Yes</Button>
                                </div>
                            </>):(<>
                                <VscSave className="mx-auto mb-4 h-14 w-14 text-gray-400" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500">Save all changes?</h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>No</Button>
                                    <Button color="default" onClick={updateEntry}>Yes</Button>
                                </div>
                            </>)
                        )}
                    </div>
                </ModalBody>
            </Modal>

            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleProgramImport} />
        </div>
    )
}
