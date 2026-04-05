"use client"

import {
    Button,
    Dropdown,
    DropdownItem, Pagination, Progress,
    Table,
    TableBody, TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    TextInput, Toast, ToastToggle, Tooltip
} from "flowbite-react";
import React, {useEffect, useRef, useState} from "react";
import {fetchProgramCount, fetchPrograms, insertProgram} from "@/services/userService.ts";
import {HiCheck, HiExclamation} from "react-icons/hi";

export default function CoursesManager() {
    const [programs, setPrograms] = useState([]); // room rows are stored here
    const fileInputRef = useRef<HTMLInputElement>(null);

    // search
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);

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

    /** Import/Export **/
    // async function handleExportToExcel() {
    //     try {
    //         const rooms = await getAllRoomsData();
    //
    //         if (!rooms || rooms.length === 0) {
    //             return "404";
    //         }
    //
    //         const ExcelJS = (await import('exceljs')).default;
    //         const { saveAs } = await import('file-saver');
    //
    //         const workbook = new ExcelJS.Workbook();
    //         const worksheet = workbook.addWorksheet('Rooms Inventory');
    //
    //         worksheet.columns = [
    //             { header: 'ID', key: 'room_id', width: 10 },
    //             { header: 'Room Name', key: 'room_name', width: 35 },
    //             { header: 'Type', key: 'room_type', width: 20 },
    //             { header: 'Created At', key: 'created_at', width: 25 }
    //         ];
    //
    //         const headerRow = worksheet.getRow(1);
    //         headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    //         headerRow.fill = {
    //             type: 'pattern',
    //             pattern: 'solid',
    //             fgColor: { argb: '2C3E50' }
    //         };
    //
    //         worksheet.addRows(rooms);
    //         worksheet.getColumn('created_at').numFmt = 'yyyy-mm-dd hh:mm';
    //
    //         worksheet.autoFilter = 'A1:D1';
    //
    //         const buffer = await workbook.xlsx.writeBuffer();
    //         const blob = new Blob([buffer], {
    //             type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    //         });
    //
    //         saveAs(blob, `Rooms_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    //
    //         return "200";
    //     } catch (error) {
    //         console.error("[EXPORT_UI_ERROR]:", error);
    //         return "500";
    //     }
    // }

    async function downloadProgramTemplate() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Programs Template');

            // 1. Define Columns (A to I)
            worksheet.columns = [
                { header: 'Program Code', key: 'code', width: 15 },
                { header: 'Program Name', key: 'name', width: 45 },
                { header: 'Level', key: 'level', width: 15 },
                { header: 'Grade 11 (1xx/2xx)', key: 'g11', width: 22 },
                { header: 'Grade 12 (3xx/4xx)', key: 'g12', width: 22 },
                { header: '1st Year (1xx-2xx)', key: 'y1', width: 22 },
                { header: '2nd Year (3xx-4xx)', key: 'y2', width: 22 },
                { header: '3rd Year (5xx-6xx)', key: 'y3', width: 22 },
                { header: '4th Year (7xx-8xx)', key: 'y4', width: 22 },
            ];

            // 2. Apply Header Styles (Green, Orange, Blue)
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.height = 25;

            const fills = {
                green: { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } } as const,
                orange: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } } as const,
                blue: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1D4ED8' } } as const
            };

            ['A1', 'B1', 'C1'].forEach(c => worksheet.getCell(c).fill = fills.green);
            ['D1', 'E1'].forEach(c => worksheet.getCell(c).fill = fills.orange);
            ['F1', 'G1', 'H1', 'I1'].forEach(c => worksheet.getCell(c).fill = fills.blue);

            // 3. Add Example Rows (Italicized and Gray)
            const examples = [
                {
                    code: 'EXAMPLE-SHS',
                    name: '[EXAMPLE] Science & Technology',
                    level: 'SHS',
                    g11: '111, 211',
                    g12: '311, 411',
                    y1: '', y2: '', y3: '', y4: ''
                },
                {
                    code: 'EXAMPLE-COL',
                    name: '[EXAMPLE] BS Information Technology',
                    level: 'College',
                    g11: '', g12: '',
                    y1: '111, 112, 211',
                    y2: '311, 411',
                    y3: '511',
                    y4: '711, 811'
                }
            ];

            examples.forEach((ex) => {
                const row = worksheet.addRow(ex);
                row.font = { italic: true, color: { argb: '94A3B8' } };
            });

            worksheet.addRow({}); // Visual Gap

            // 4. Dropdown Validation for Level (Starting Row 5)
            const levelOptions = ['SHS', 'College'];
            for (let i = 5; i <= 200; i++) {
                worksheet.getCell(`C${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${levelOptions.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Selection',
                    error: 'Please select SHS or College.'
                };
            }

            // 5. Tooltips
            worksheet.getCell('D1').note = 'SHS: Enter sections starting with 1-4 (Sem 1-4 logic).';
            worksheet.getCell('F1').note = 'College: Use 1xx for Sem 1, 2xx for Sem 2, etc.';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Program_Import_Template.xlsx`);

            return "200";
        } catch (error) {
            console.error("[TEMPLATE_ERROR]:", error);
            return "500";
        }
    }

    function formatSectionsForDB(level: string, data: any) {
        const semesterMap: Record<string, string[]> = {};
        const isSHS = level === 'SHS';

        // Combine relevant year/grade columns based on level
        const rawInput = isSHS
            ? `${data.g11},${data.g12}`
            : `${data.y1},${data.y2},${data.y3},${data.y4}`;

        const sections = rawInput.split(',').map((s: string) => s.trim()).filter(Boolean);

        sections.forEach(section => {
            // REGEX VALIDATION: Must be exactly 3 digits starting with 1-8 (e.g., 111)
            const isValidFormat = /^[1-8]\d{2}$/.test(section);
            if (!isValidFormat) return;

            const firstDigit = section.charAt(0);

            if (isSHS) {
                // Map SHS: 1-2 -> "11", 3-4 -> "12"
                const shsKey = (firstDigit === "1" || firstDigit === "2") ? "11" : "12";
                if (!semesterMap[shsKey]) semesterMap[shsKey] = [];
                semesterMap[shsKey].push(section);
            } else {
                // Map College: 1 -> "1", 2 -> "2", etc.
                if (!semesterMap[firstDigit]) semesterMap[firstDigit] = [];
                semesterMap[firstDigit].push(section);
            }
        });

        return semesterMap;
    } // Helper to convert Excel columns into the 1-8 (College) or 11-12 (SHS) JSON format.

    async function handleProgramImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !e.target) return;

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const worksheet = workbook.getWorksheet(1);

            // FORMAT VALIDATION: Ensure headers match
            const firstHeader = worksheet?.getRow(1).getCell(1).value?.toString();
            if (firstHeader !== 'Program Code') {
                setStatusCode("400");
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

                const sectionData = {
                    g11: row.getCell(4).value?.toString() || "",
                    g12: row.getCell(5).value?.toString() || "",
                    y1:  row.getCell(6).value?.toString() || "",
                    y2:  row.getCell(7).value?.toString() || "",
                    y3:  row.getCell(8).value?.toString() || "",
                    y4:  row.getCell(9).value?.toString() || ""
                };

                const formattedSections = formatSectionsForDB(level, sectionData);

                // Skip if no valid sections were parsed
                if (Object.keys(formattedSections).length === 0) return;

                programsToImport.push({ code, name, level, semester_sections: formattedSections });
            });

            if (programsToImport.length === 0) {
                setStatusCode("400");
                setShowToast(true);
                return;
            }

            let successCount = 0;
            let hasConflict = false;

            for (const program of programsToImport) {
                const res = await insertProgram(program.code, program.name, program.level, program.semester_sections);

                if (res === "500") {
                    setStatusCode("500");
                    setShowToast(true);
                    return;
                }
                if (res === "409") hasConflict = true;
                else successCount++;
            }

            setStatusCode(successCount > 0 ? "201" : "409");
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
    } // Main Import Function for Programs

    /** Queries **/
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

                if (isCancelled) return;
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
    }, [debouncedSearch]);

    useEffect(() => { // Adds 1 sec delay to querying while typing
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 1000); // 1000ms = 1 seconds

        return () => {
            clearTimeout(handler); // Cancel the timer if the user types
        };
    }, [search]);

    /** UI **/
    const ProgramSectionTooltip = ({ sections, level }: { sections: any, level: string }) => {
        if (!sections || Object.keys(sections).length === 0) return <span>No sections</span>;

        if (level === 'SHS') {
            return (
                <div className="p-2 text-lg space-y-1">
                    <div><span className="font-bold text-blue-400">G11:</span> {sections["11"]?.join(', ') || '—'}</div>
                    <div><span className="font-bold text-blue-400">G12:</span> {sections["12"]?.join(', ') || '—'}</div>
                </div>
            );
        }

        // College Layout (1-8 mapped to Year 1-4)
        const years = [
            { label: 'Yr.1', s1: "1", s2: "2" },
            { label: 'Yr.2', s1: "3", s2: "4" },
            { label: 'Yr.3', s1: "5", s2: "6" },
            { label: 'Yr.4', s1: "7", s2: "8" },
        ];

        return (
            <div className="p-2 text-lg">
                <div className="grid grid-cols-3 border-b border-gray-600 pb-1 mb-1 font-bold text-center">
                    <div></div>
                    <div>1 Sem</div>
                    <div>2 Sem</div>
                </div>
                {years.map((y) => (
                    <div key={y.label} className="grid grid-cols-3 gap-x-4 border-b border-gray-700/50 py-0.5">
                        <div className="font-bold text-blue-400">{y.label}:</div>
                        <div className="text-center">{sections[y.s1]?.join(', ') || '—'}</div>
                        <div className="text-center">{sections[y.s2]?.join(', ') || '—'}</div>
                    </div>
                ))}
            </div>
        );
    }; // Tooltip Content

    const ProgramTableRow = ({ program }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {program.program_code}
                </TableCell>
                <TableCell>{program.program_name}</TableCell>
                <TableCell>{program.level}</TableCell>
                <TableCell>
                    <Tooltip placement={"bottom"} content={<ProgramSectionTooltip sections={program.sections} level={program.level} />}>
                        <div className="max-w-30 truncate">
                            {program.sections
                                ? Object.values(program.sections).flat().join(', ')
                                : 'No sections'}
                        </div>
                    </Tooltip>
                </TableCell>
                <TableCell className={"flex justify-end"}>
                    <Button color="alternative">
                        Edit
                    </Button>
                </TableCell>
            </TableRow>
        );
    } // Table Rows

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-4 font-bold text-2xl"}>Manage Courses:</h1>
                <div className={"flex space-x-3"}>
                    <Dropdown color={"alternative"} label={"Actions"} dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadProgramTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>
                            Import
                        </DropdownItem>
                        {/*<DropdownItem onClick={() => handleExportToExcel()}>Export</DropdownItem>*/}
                    </Dropdown>
                    {/*<Button onClick={() => setAddModal(true)}>Add Room</Button>*/}
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
                            <TableHeadCell>Offered Sections</TableHeadCell>
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

            <Toast className={`fixed block z-60 bottom-10 right-10 transition-opacity duration-500
                ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
                <div className={"flex items-center"}>
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       ${["200", "201", "204"].includes(statusCode) && ("bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200")}
                       ${statusCode == "409"? "bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200":null}
                       ${statusCode == "500"? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200":null}
                    `}>
                        {["200", "201", "204"].includes(statusCode) && (
                            <HiCheck className="h-5 w-5" />
                        )}
                        {["404", "409", "500"].includes(statusCode) && (
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