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
        setEditModal(true);
    }

    function showWarning(color: string) {
        console.log(`[UI_INTERRUPT]: Showing warning modal. Level: ${color}`);
        setWarningType(color);
        setOpenWarningModal(true);
    }

    function discardEntry() {
        console.log("[UI_ACTION]: Discarding entry and closing all modals. Resetting form state.");
        setSelectedProgram("");
        setProgramNameVal("");
        setAcademicLevelVal("College");
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    /** Import/Export **/
    async function handleProgramExport() {
        try {
            const programs = await getAllProgramsData();

            if (!programs || programs.length === 0) {
                return "404";
            }

            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Programs Export');

            // 1. Define Columns (A to C) - Removed sections
            worksheet.columns = [
                { header: 'Program Code', key: 'code', width: 15 },
                { header: 'Program Name', key: 'name', width: 45 },
                { header: 'Level', key: 'level', width: 15 },
            ];

            // 2. Header Styling
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.height = 25;

            const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } } as const;
            ['A1', 'B1', 'C1'].forEach(c => worksheet.getCell(c).fill = fill);

            // 3. Data Transformation
            const flattenedData = programs.map(p => ({
                code: p.program_code,
                name: p.program_name,
                level: p.level
            }));

            worksheet.addRows(flattenedData);

            // 4. Finalize and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

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

            // 1. Define Columns (A to C)
            worksheet.columns = [
                { header: 'Program Code', key: 'code', width: 15 },
                { header: 'Program Name', key: 'name', width: 45 },
                { header: 'Level', key: 'level', width: 15 },
            ];

            // 2. Apply Header Styles
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.height = 25;

            const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } } as const;
            ['A1', 'B1', 'C1'].forEach(c => worksheet.getCell(c).fill = fill);

            // 3. Add Example Rows
            const examples = [
                {
                    code: 'EXAMPLE-SHS',
                    name: '[EXAMPLE] Science & Technology',
                    level: 'SHS'
                },
                {
                    code: 'EXAMPLE-COL',
                    name: '[EXAMPLE] BS Information Technology',
                    level: 'College'
                }
            ];

            examples.forEach((ex) => {
                const row = worksheet.addRow(ex);
                row.font = { italic: true, color: { argb: '94A3B8' } };
            });

            worksheet.addRow({}); // Visual Gap

            // 4. Dropdown Validation for Level (Starting Row 5)
            const levelOptions = ['SHS', 'College'];
            for (let i = 2; i <= 200; i++) {
                worksheet.getCell(`C${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${levelOptions.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Selection',
                    error: 'Please select SHS or College.'
                };
            }

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

            // FORMAT VALIDATION: Ensure headers match
            const firstHeader = worksheet?.getRow(1).getCell(1).value?.toString();
            if (firstHeader !== 'Program Code') {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            const programsToImport: any[] = [];

            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;

                const code = row.getCell(1).value?.toString().trim();
                const name = row.getCell(2).value?.toString().trim();
                const level = row.getCell(3).value?.toString().trim();

                // GUARD: Skip Examples and Empty Rows
                if (!code || code.includes("EXAMPLE") || !level) return;

                programsToImport.push({ code, name, level, semester_sections: {} });
            });

            if (programsToImport.length === 0) {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            let successCount = 0;
            let hasConflict = false;

            for (const program of programsToImport) {
                const res = await insertProgram(program.code, program.name, program.level);

                if (res === "500") {
                    setStatusCode("500");
                    setLoading(false);
                    setShowToast(true);
                    return;
                }
                if (res === "409") hasConflict = true;
                else successCount++;
            }

            setStatusCode(successCount > 0 ? "201" : "409");
            setLoading(false);
            setShowToast(true);

            await loadProgramCount();
            await loadProgramData();

        } catch (error) {
            console.error("[IMPORT_ERROR]:", error);
            setStatusCode("500");
            setShowToast(true);
        } finally {
            if (e.target) e.target.value = "";
        }
    }

    /** Queries **/
    async function submitProgram() {
        if (!selectedProgram || !programNameVal || !academicLevelVal) {
            console.warn("[UI_VALIDATION]: Submission blocked. Missing Program Code, Name, or Level.");
            return;
        }

        setLoading(true);

        // Sections removed, sending empty object
        const p_section = {};

        console.log(`[UI_ACTION]: Submitting new program: "${programNameVal}" [${selectedProgram}]`);

        // 3. Call the Insert Service
        const stat = await insertProgram(selectedProgram, programNameVal, academicLevelVal);

        console.log(`[API_RESPONSE]: Insert Program returned status: ${stat}`);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        // 4. Handle Success (201 Created)
        if (stat === "201") {
            console.log("[UI_UPDATE]: Program created successfully. Resetting UI and refreshing data.");
            discardEntry(); // Clears inputs and closes drawer/modal
            setSearch("");
            await loadProgramCount();
            await loadProgramData();
        } else {
            console.error(`[UI_ERROR]: Program creation failed with status: ${stat}`);
        }
    }

    async function updateEntry() {
        const p_code = selectedProgram;
        const p_name = programNameVal;
        const p_level = academicLevelVal;

        // Sections removed, sending empty object
        const p_section = {};

        setLoading(true);

        console.log(`[UI_ACTION]: Initiating update for Program Code: ${p_code}`);

        const stat = await updateProgram(p_code, p_name, p_level);

        console.log(`[API_RESPONSE]: Update Program ${p_code} returned status: ${stat}`);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "200") {
            console.log(`[UI_UPDATE]: Update successful. Resetting view and refreshing data.`);
            discardEntry();
            setSearch("");
            await loadProgramCount();
            await loadProgramData();
        } else {
            console.warn(`[UI_WARN]: Update failed. No UI refresh triggered.`);
        }
    }

    async function deleteRow() {
        const id = selectedProgram;
        setLoading(true);

        console.log(`[UI_ACTION]: Initiating delete for Program Code: ${id}`);

        const stat = await deleteProgram(id);

        console.log(`[API_RESPONSE]: Delete Program ${id} returned status: ${stat}`);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "204") {
            console.log(`[UI_UPDATE]: Deletion successful. Resetting view and refreshing data.`);
            discardEntry();
            setSearch("");
            await loadProgramCount();
            await loadProgramData();
        } else {
            console.warn(`[UI_WARN]: Delete failed. No UI refresh triggered.`);
        }
    }

    const loadProgramData = async () => {
        console.log(`[DATA_LIFECYCLE]: Fetching programs for Page ${currentPage} (Search: "${search || 'none'}")`);

        const data = await fetchPrograms(search, currentPage);

        console.log(`[DATA_LIFECYCLE]: Rooms loaded. Count: ${data.length}`);
        setPrograms(data);
    }

    const loadProgramCount = async () => {
        const rowCount = await fetchProgramCount(search);

        console.log(`[DATA_LIFECYCLE]: Total matching programs in DB: ${rowCount}`);
        setRowCount(rowCount);
    }

    const onPageChange = (page: number) => {
        console.log(`[UI_NAVIGATION]: Moving to Page ${page}`);
        setCurrentPage(page);
    };

    /** Updates **/
    useEffect(() => {
        let isCancelled = false; // Cleanup flag to prevent race conditions

        const fetchData = async () => {
            try {
                // Run in parallel to save time
                await Promise.all([
                    loadProgramCount(),
                    loadProgramData()
                ]);

                if (isCancelled) {
                    setLoading(false);
                    return;
                }
                console.log("[LIFECYCLE]: Page data refreshed.");
            } catch (error) {
                console.error("[LIFECYCLE_ERROR]: Failed to sync rooms:", error);
            }
        };

        fetchData().catch((err) => {
            console.error("[CRITICAL_ERROR]: Fetch failed in useEffect", err);
        });

        return () => {
            isCancelled = true; // 2. Cancel state updates if component re-renders
        };
    }, [currentPage, debouncedSearch]);

    useEffect(() => { // Toast
        if (showToast) {
            console.log(`[UI_TOAST]: Toast appeared. Status: ${statusCode}. Starting 5s countdown.`);

            setProgress(100);
            loadProgramCount().catch(err => console.error("Failed to refresh row count:", err));

            const interval = setInterval(() => {
                setProgress((prev) => {
                    return Math.max(0, prev - (100 / (5000 / 50)));
                });
            }, 50);

            const timeout = setTimeout(() => {
                console.log("[UI_TOAST]: 5s elapsed. Hiding toast automatically.");
                setShowToast(false);
            }, 5000);

            return () => {
                console.log("[UI_TOAST]: Cleaning up timers (Effect reset).");
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [showToast]);

    useEffect(() => { // Resetting Page to 1 When Searching
        setCurrentPage(1);
        setLoading(false);
    }, [debouncedSearch]);

    useEffect(() => { // Adds 1 sec delay to querying while typing
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 1000); // 1000ms = 1 seconds

        return () => {
            clearTimeout(handler); // Cancel the timer if the user types
        };
    }, [search]);

    const ProgramTableRow = ({ program }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {program.program_code}
                </TableCell>
                <TableCell>{program.program_name}</TableCell>
                <TableCell>{program.level}</TableCell>
                <TableCell className={"flex justify-end"}>
                    <Button color="alternative" onClick={() => editModalValue(program.program_code)}>
                        Edit
                    </Button>
                </TableCell>
            </TableRow>
        );
    } // Table Rows

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            {/** Loading Spinner **/}
            <div className={`${loading? "":"hidden"} fixed inset-0 z-9999 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm cursor-wait`}>
                {/* The Spinner Container */}
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>

                    {/* Optional: Add a text label to let users know what's happening */}
                    <p className="text-white font-semibold text-lg drop-shadow-md">
                        Processing Data...
                    </p>
                </div>
            </div>

            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-4 font-bold text-2xl"}>Manage Courses:</h1>
                <div className={"flex space-x-3"}>
                    <Dropdown color={"alternative"} label={"Actions"} dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadProgramTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>
                            Import
                        </DropdownItem>
                        <DropdownItem onClick={() => handleProgramExport()}>Export</DropdownItem>
                    </Dropdown>
                    <Button onClick={() => setAddModal(true)}>Add Room</Button>
                </div>
            </div>

            {/* SearchBox*/}
            <TextInput
                className="mb-4 w-62"
                placeholder="Search..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/** Table **/}
            <div className={"w-full md:w-auto h-auto overflow-x-scroll md:overflow-clip"}>
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Code</TableHeadCell>
                            <TableHeadCell>Program Name</TableHeadCell>
                            <TableHeadCell>Academic Lvl.</TableHeadCell>
                            <TableHeadCell>
                                <span className="sr-only">Edit</span>
                            </TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {programs.length > 0 ? (
                            programs.map((program) => (
                                <ProgramTableRow key={program.program_code} program={program}/>
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

            {/** Pagination **/}
            <div className={"mt-6 justify-self-center"}>
                <h1 className="text-center">
                    {rowCount > 0
                        ? `Showing ${startItem} to ${endItem} of ${rowCount} Entries`
                        : ""
                    }
                </h1>
                <div className={`${totalPageCount > 1? "flex":"hidden"} overflow-x-auto sm:justify-center`}>
                    <Pagination currentPage={currentPage} totalPages={totalPageCount == 0? 1:totalPageCount} onPageChange={onPageChange} showIcons />
                </div>
            </div>

            {/** Toast **/}
            <Toast className={`fixed block z-60 bottom-10 right-10 transition-opacity duration-500
                ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
                <div className={"flex items-center"}>
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       ${["200", "201", "204"].includes(statusCode) && ("bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200")}
                       ${["400", "409"].includes(statusCode) && ("bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200")}
                       ${statusCode == "500"? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200":null}
                    `}>
                        {["200", "201", "204"].includes(statusCode) && (
                            <HiCheck className="h-5 w-5" />
                        )}
                        {["400", "404", "409", "500"].includes(statusCode) && (
                            <HiExclamation className="h-5 w-5" />
                        )}

                    </div>
                    <div className="ml-3 text-sm font-normal">
                        {STATUS_MESSAGES[statusCode] || "An unknown error occurred."}
                    </div>
                    <ToastToggle onDismiss={() => {
                        console.log("[UI_ACTION]: User manually dismissed the toast.");

                        setShowToast(false);
                        setProgress(0);
                    }} />
                </div>
                <Progress size={"sm"} className={"mt-2 mb-0 pb-0"} progress={progress}/>
            </Toast>

            {/** Modals **/}
            {/*  Add Modal  */}
            <Modal size={"sm"} show={addModal} initialFocus={AddModalProgramNameInput} onClose={() => setAddModal(false)}>
                <ModalHeader>Add Program</ModalHeader>
                <ModalBody>
                    <div className="flex gap-4 space-y-6">
                        <div className={"w-4/10"}>
                            <div className="mb-2 block">
                                <Label htmlFor="programCode">Program Code</Label>
                            </div>
                            <TextInput id="programCode" type="text"
                                       placeholder="e.g. BSIT"
                                       value={selectedProgram}
                                       onChange={(e) => {
                                           setSelectedProgram(e.target.value)
                                           setActiveChanges(true)
                                       }}
                                       required />
                        </div>
                        <div className={"w-6/10"}>
                            <div className="mb-2 block">
                                <Label htmlFor="programName">Program Name</Label>
                            </div>
                            <TextInput id="programName" type="text" ref={AddModalProgramNameInput}
                                       placeholder="e.g. BS Tourism Management"
                                       value={programNameVal}
                                       onChange={(e) => {
                                           setProgramNameVal(e.target.value)
                                           setActiveChanges(true)
                                       }}
                                       required />
                        </div>
                    </div>
                    <div className={"flex space-x-2.5"}>
                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="acadLvl">Program Type</Label>
                            </div>
                            <Select id="acadLvl"
                                    className={"w-40"}
                                    value={academicLevelVal}
                                    onChange={(e) => {
                                        setAcademicLevelVal(e.target.value)
                                        setActiveChanges(true)
                                    }
                                    }>
                                <option>{academicLevelVal}</option>
                                {academicLevelVal != "SHS"? (<option>SHS</option>):null}
                                {academicLevelVal != "College"? (<option>College</option>):null}
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <div className={"flex w-full justify-end space-x-2"}>
                        {activeChanges == true?(<>
                            <Button color="alternative" onClick={() => showWarning("yellow")}>
                                Discard
                            </Button>
                        </>):(<>
                            <Button color="alternative" onClick={() => discardEntry()}>
                                Cancel
                            </Button>
                        </>)}

                        <Button onClick={() => submitProgram()}>Save</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/*  Edit Modal  */}
            <Modal size={"sm"} show={editModal} initialFocus={EditModalProgramNameInput} onClose={() => setEditModal(false)}>
                <ModalHeader>Editing Program: {selectedProgram}</ModalHeader>
                <ModalBody>
                    <div className="flex gap-4 space-y-6">
                        <div className={"col-span-2"}>
                            <div className="mb-2 block">
                                <Label htmlFor="programName">Program Name</Label>
                            </div>
                            <TextInput id="programName" type="text" ref={EditModalProgramNameInput}
                                       placeholder="e.g. BS Tourism Management"
                                       value={programNameVal}
                                       onChange={(e) => {
                                           setProgramNameVal(e.target.value)
                                           setActiveChanges(true)
                                       }}
                                       required />
                        </div>
                    </div>
                    <div className={"flex space-x-2.5"}>
                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="acadLvl">Program Type</Label>
                            </div>
                            <Select id="acadLvl"
                                    className={"w-40"}
                                    value={academicLevelVal}
                                    onChange={(e) => {
                                        setAcademicLevelVal(e.target.value)
                                        setActiveChanges(true)
                                    }
                                    }>
                                <option>{academicLevelVal}</option>
                                {academicLevelVal != "SHS"? (<option>SHS</option>):null}
                                {academicLevelVal != "College"? (<option>College</option>):null}
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button outline color={"dark"} className={"p-2"} onClick={() => showWarning("red")}>
                        <HiOutlineTrash color={"red"} className={"size-6"}/>
                    </Button>
                    <div className={"flex w-full justify-end space-x-2"}>
                        {activeChanges == true?(<>
                            <Button color="alternative" onClick={() => showWarning("yellow")}>
                                Discard
                            </Button>
                        </>):(<>
                            <Button color="alternative" onClick={() => discardEntry()}>
                                Cancel
                            </Button>
                        </>)}

                        <Button onClick={() => showWarning("default")}>Save</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/*  Warning Modal  */}
            <Modal show={openWarningModal} size="md" onClose={() => setOpenWarningModal(false)} popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        {warningType=="red"?(
                            <> {/* Delete Confirmation */}
                                <HiOutlineTrash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete this entry?
                                </h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                        No, cancel
                                    </Button>
                                    <Button color="red" onClick={() => deleteRow()}>
                                        Yes, I'm sure
                                    </Button>
                                </div>
                            </>):(
                            warningType == "yellow"? (<> {/* Discard Confirmation */}
                                <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                    Are you sure you want to discard all changes?
                                </h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                        No, cancel
                                    </Button>
                                    <Button color="yellow" onClick={() => discardEntry()}>
                                        Yes, I'm sure
                                    </Button>
                                </div>
                            </>):(<> {/* Update Confirmation */}
                                <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                    Are you sure you want to save all changes?
                                </h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                        No, cancel
                                    </Button>
                                    <Button color="default" onClick={() => updateEntry()}>
                                        Yes, I'm sure
                                    </Button>
                                </div>
                            </>)
                        )
                        }
                    </div>
                </ModalBody>
            </Modal>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx"
                onChange={handleProgramImport}
            />
        </div>
    )
}
