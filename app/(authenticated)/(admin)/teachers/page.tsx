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
    Pagination, Popover,
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
    ToastToggle, Tooltip
} from "flowbite-react";
import React, {useEffect, useRef, useState} from "react";
import {HiCheck, HiExclamation, HiMail, HiOutlineTrash, HiPlus, HiTrash} from "react-icons/hi";
import {
    fetchTeachers,
    fetchTeachersCount,
    insertTeacher,
    updateTeacher,
    deleteTeacher,
    getAllTeachersData, fetchDropdownValues
} from "@/services/userService.ts";
import {VscSave} from "react-icons/vsc";
import {
    pscsSanitization, sanitizeEmail,
    sanitizeMediumName,
    sanitizeMiName, sanitizeSuffix, sanitizeTeacherCode, sanitizeTeacherId,
    sanitizeTeacherName,
    sanitizeVeryShortName
} from "@/lib/validation.ts";
import {IoMdArrowDropdown} from "react-icons/io";
import ExcelJS from "exceljs";

/** --- Helper Components --- **/
const AvailabilityManager = ({
                                 availability,
                                 onUpdate,
                                 employmentType
                             }: {
    availability: any[],
    onUpdate: (val: any[]) => void,
    employmentType: string
}) => {
    // Hidden for Full-Time (FT/PTFL)
    if (employmentType === "FT" || employmentType === "PTFL") return null;

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Generate time options from 7:00 AM to 8:00 AM next day (30 min interval)
    const generateTimeOptions = () => {
        const times: string[] = [];

        // 7:00 AM to 8:00 PM
        for (let hour = 7; hour <= 20; hour++) {
            for (const minute of [0, 30]) {
                // Stop after exactly 8:00 PM
                if (hour === 20 && minute > 0) continue;

                const period = hour >= 12 ? "PM" : "AM";
                const displayHour =
                    hour % 12 === 0 ? 12 : hour % 12;

                const displayMinute =
                    minute === 0 ? "00" : "30";

                times.push(
                    `${displayHour}:${displayMinute} ${period}`
                );
            }
        }

        return times;
    };

    const timeOptions = generateTimeOptions();

    const addSlot = () => {
        onUpdate([
            ...availability,
            {
                day: "Monday",
                startTime: "7:00 AM",
                endTime: "7:30 AM"
            }
        ]);
    };

    const removeSlot = (index: number) => {
        onUpdate(availability.filter((_, i) => i !== index));
    };

    const updateSlot = (index: number, field: string, value: string) => {
        const newSlots = [...availability];

        const updatedSlot = {
            ...newSlots[index],
            [field]: value
        };

        const startIndex = timeOptions.indexOf(updatedSlot.startTime);
        const endIndex = timeOptions.indexOf(updatedSlot.endTime);

        // Prevent invalid ranges
        if (startIndex > endIndex) {
            if (field === "startTime") {
                updatedSlot.endTime = value;
            } else if (field === "endTime") {
                updatedSlot.startTime = value;
            }
        }

        newSlots[index] = updatedSlot;
        onUpdate(newSlots);
    };

    return (
        <div className="mt-4 border-t pt-4 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <Label className="font-bold text-blue-600 dark:text-blue-400">
                    Availability Slots (Part-Time Only)
                </Label>

                <Button size="xs" color="gray" onClick={addSlot}>
                    <HiPlus className="mr-1" />
                    Add
                </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {availability.map((slot, idx) => {
                    const startIndex = timeOptions.indexOf(slot.startTime);
                    const endIndex = timeOptions.indexOf(slot.endTime);

                    return (
                        <div
                            key={idx}
                            className="flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-200 dark:border-gray-600"
                        >
                            {/* Day */}
                            <Select
                                value={slot.day}
                                onChange={(e) =>
                                    updateSlot(idx, "day", e.target.value)
                                }
                                className="flex-1 min-w-22"
                                sizing="sm"
                            >
                                {days.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </Select>

                            {/* Start Time */}
                            <Select
                                value={slot.startTime}
                                onChange={(e) =>
                                    updateSlot(idx, "startTime", e.target.value)
                                }
                                className="flex-1 min-w-21"
                                sizing="sm"
                            >
                                {timeOptions.map((time, i) => (
                                    <option
                                        key={`${time}-${i}`}
                                        value={time}
                                        disabled={i > endIndex}
                                    >
                                        {time}
                                    </option>
                                ))}
                            </Select>

                            <span className="text-sm text-gray-500">to</span>

                            {/* End Time */}
                            <Select
                                value={slot.endTime}
                                onChange={(e) =>
                                    updateSlot(idx, "endTime", e.target.value)
                                }
                                className="flex-1 min-w-21"
                                sizing="sm"
                            >
                                {timeOptions.map((time, i) => (
                                    <option
                                        key={`${time}-${i}`}
                                        value={time}
                                        disabled={i < startIndex}
                                    >
                                        {time}
                                    </option>
                                ))}
                            </Select>

                            {/* Remove */}
                            <Button
                                color="failure"
                                size="xs"
                                onClick={() => removeSlot(idx)}
                            >
                                <HiOutlineTrash />
                            </Button>
                        </div>
                    );
                })}

                {availability.length === 0 && (
                    <p className="text-xs text-gray-500 italic">
                        No availability set.
                    </p>
                )}
            </div>
        </div>
    );
};

type DropdownValue = {
    value: string;
    value_for: string;
};

export default function TeacherManager() {
    const typeOptions = ["FT", "PTFL", "PT"];

    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false); // table-specific loading for search/pagination
    const [teachers, setTeachers] = useState([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI consts
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);

    const [activeChanges, setActiveChanges] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [progress, setProgress] = useState(100);

    // form useStates
    const [pscsId, setPscsId] = useState("");
    const [teacherId, setTeacherId] = useState("");
    const [fname, setFname] = useState("");
    const [sname, setSname] = useState("");
    const [mi, setMi] = useState("");
    const [suffix, setSuffix] = useState("");
    const [code, setCode] = useState("");
    const [email, setEmail] = useState("");
    const [spec, setSpec] = useState("");
    const [type, setType] = useState("FT");
    const [availability, setAvailability] = useState<any[]>([]);

    //Form Update Validation
    const [pscsIdOld, setPscsIdOld] = useState("");
    const [teacherIdOld, setTeacherIdOld] = useState("");
    const [fnameOld, setFnameOld] = useState("");
    const [snameOld, setSnameOld] = useState("");
    const [miOld, setMiOld] = useState("");
    const [suffixOld, setSuffixOld] = useState("");
    const [codeOld, setCodeOld] = useState("");
    const [emailOld, setEmailOld] = useState("");
    const [specOld, setSpecOld] = useState("");
    const [typeOld, setTypeOld] = useState("FT");
    const [availabilityOld, setAvailabilityOld] = useState<any[]>([]);
    const [containsEmail, setContainsEmail] = useState(true);

    // Search and Filter
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    const [filterType, setFilterType] = useState("All"); // New state for filter type

    // pagination consts
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setRowCount] = useState(1);
    const totalPageCount = Math.ceil(rowCount / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, rowCount);

    const [toastMessage, setToastMessage] = useState("");

    const STATUS_MESSAGES: Record<string, string> = {
        "200": "Update successful.",
        "201": "Teacher created successfully.",
        "204": "Teacher deleted successfully.",
        "207": "Import completed with partial success.",
        "400": "Invalid data provided.",
        "404": "Teacher not found.",
        "409": "Conflict: Duplicate entry detected.",
        "500": "Server error. Please try again later."
    };

    const [importStats, setImportStats] = useState({
        imported: 0,
        failed: 0,
        total: 0
    });

    const [dropdownValues, setDropdownValues] = useState<DropdownValue[]>([]);

    useEffect(() => {
        const loadDropdownValues = async () => {
            const values = await fetchDropdownValues("specialization");
            setDropdownValues(values);
        };

        loadDropdownValues();
    }, []);

    useEffect(() => {
        const hasChanges =
            pscsId !== pscsIdOld ||
            teacherId !== teacherIdOld ||
            fname !== fnameOld ||
            sname !== snameOld ||
            mi !== miOld ||
            suffix !== suffixOld ||
            email !== emailOld ||
            code !== codeOld ||
            spec !== specOld ||
            type !== typeOld ||
            availability !== availabilityOld;

        setContainsEmail(email.endsWith("@alabang.sti.edu.ph"));
        setActiveChanges(hasChanges);
    }, [
        pscsId,
        teacherId,
        fname,
        sname,
        mi,
        suffix,
        email,
        code,
        spec,
        type,
        availability
    ]);

    /** UI Functions **/
    function editModalValue(id: string) {
        const teacher = teachers.find(t => t.pscs_id === id);
        if (!teacher) return;

        setPscsId(teacher.pscs_id);
        setTeacherId(teacher.teacher_id);
        setFname(teacher.fname);
        setSname(teacher.sname);
        setMi(teacher.mi);
        setSuffix(teacher.suffix);
        setEmail(teacher.email || "");
        setCode(teacher.teacher_code);
        setSpec(teacher.specialization);
        setType(teacher.employment_type);
        setAvailability(teacher.availability || []);
        setEditModal(true);

        //Comparison check set
        setPscsIdOld(teacher.pscs_id);
        setTeacherIdOld(teacher.teacher_id);
        setFnameOld(teacher.fname);
        setSnameOld(teacher.sname);
        setMiOld(teacher.mi);
        setSuffixOld(teacher.suffix);
        setEmailOld(teacher.email);
        setCodeOld(teacher.teacher_code);
        setSpecOld(teacher.specialization);
        setTypeOld(teacher.employment_type);
        setAvailabilityOld(teacher.availability || []);
    }

    function discardEntry() {
        setPscsId("");
        setTeacherId("");
        setFname("");
        setSname("");
        setMi("");
        setSuffix("");
        setCode("");
        setEmail("")
        setSpec("");
        setType("FT");
        setAvailability([]);
        setPscsIdOld("");
        setTeacherIdOld("");
        setFnameOld("");
        setSnameOld("");
        setMiOld("");
        setSuffixOld("");
        setCodeOld("");
        setEmailOld("")
        setSpecOld("");
        setTypeOld("FT");
        setContainsEmail(true);
        setAvailabilityOld([]);
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    /** Queries **/
    const loadInitialData = async () => {
        const data = await fetchTeachers(search, currentPage, filterType);
        setTeachers(data);
        setLoading(false);
        setTableLoading(false);
    }

    const loadRowCount = async () => {
        const count = await fetchTeachersCount(search, filterType);
        setRowCount(count);
    }

    const onPageChange = (page: number) => setCurrentPage(page);

    async function submitTeacher() {
        if (!containsEmail || !pscsId || !teacherId || !email || !fname || !sname || !code) return;
        setLoading(true);
        // Clear availability if Full-Time before saving
        const finalAvailability = (type === "FT" || type === "PTFL") ? [] : availability;
        const stat = await insertTeacher(pscsId, teacherId, email.trim(), fname.trim(), sname.trim(), mi.trim(), suffix.trim(), code.trim(), spec, type, finalAvailability);
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
        if (!containsEmail || !pscsId || !teacherId || !email || !fname || !sname || !code) return;
        setLoading(true);
        // Clear availability if Full-Time before saving
        const finalAvailability = (type === "FT" || type === "FTPT") ? [] : availability;
        const stat = await updateTeacher(pscsId, teacherId, email.trim(), fname.trim(), sname.trim(), mi.trim(), suffix.trim(), code.trim(), spec, type, finalAvailability);
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

            const ExcelJS = (await import("exceljs")).default;
            const { saveAs } = await import("file-saver");

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Teachers List");

            worksheet.columns = [
                { header: "PSCS ID", key: "pscs_id", width: 15 },
                { header: "TEACHER ID", key: "teacher_id", width: 15 },
                { header: "Email", key: "email", width: 15 },
                { header: "Surname", key: "sname", width: 15 },
                { header: "First Name", key: "fname", width: 20 },
                { header: "Mi", key: "mi", width: 5 },
                { header: "Suffix", key: "suffix", width: 10 },
                { header: "Code", key: "teacher_code", width: 10 },
                { header: "Specialization", key: "specialization", width: 20 },
                { header: "Employment Type", key: "employment_type", width: 20 },
                { header: 'Availability (Day: Time | Day: Time)', key: 'availability_str', width: 50 }
            ];

            const headerRow = worksheet.getRow(1);

            headerRow.font = {
                bold: true,
                color: { argb: "FFFFFF" }
            };

            headerRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "2C3E50" }
            };

            const rows = data.map((t) => ({
                ...t,
                availability_str:
                    t.employment_type === "PT"
                        ? (t.availability || [])
                            .map(
                                (s: any) =>
                                    `${s.day}: ${s.startTime} - ${s.endTime}`
                            )
                            .join(" | ")
                        : "[Mon - Fri] 7:00 AM - 8:00 PM"
            }));

            worksheet.addRows(rows);

            // Dropdown validation

            for (let i = 2; i <= 100; i++) {
                worksheet.getCell(`I${i}`).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`"${typeOptions.join(",")}"`],
                    showErrorMessage: true,
                    errorTitle: "Invalid Teacher Type",
                    error: "Please select a type from the dropdown list."
                };
            }

            worksheet.autoFilter = "A1:J1";

            const buffer = await workbook.xlsx.writeBuffer();

            const blob = new Blob([buffer], {
                type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });

            saveAs(
                blob,
                `Teachers_Export_${new Date().toISOString().split("T")[0]}.xlsx`
            );

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
                { header: 'TEACHER ID', key: 'teacher_id', width: 15 },
                { header: 'Email', key: 'email', width: 15 },
                { header: 'Surname', key: 'sname', width: 15 },
                { header: 'First Name', key: 'fname', width: 20 },
                { header: 'Mi', key: 'mi', width: 5 },
                { header: 'Suffix', key: 'suffix', width: 10 },
                { header: 'Code', key: 'code', width: 10 },
                { header: 'Specialization', key: 'spec', width: 20 },
                { header: 'Employment Type', key: 'type', width: 20 },
                { header: 'Availability (Day: Time | Day: Time)', key: 'availability', width: 50 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };

            // Dropdown validation for Employment Type column (H)
            const typeOption = ["FT", "PTFL", "PT"];

            for (let i = 2; i <= 100; i++) {
                worksheet.getCell(`I${i}`).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`"${typeOption.join(",")}"`],
                    showErrorMessage: true,
                    errorTitle: "Invalid Teacher Type",
                    error: "Please select a type from the dropdown list."
                };
            }

            worksheet.addRow({ 
                id: '########',
                teacher_id: '########',
                email: 'example@alabang.sti.edu.ph',
                sname: 'Diocampo',
                fname: 'Ivan Winzle',
                mi: 'S',
                suffix: '',
                code: 'IWD',
                spec: 'Information Technology',
                type: 'PT', 
                availability: 'Monday: 5:00 PM - 8:00 PM | Saturday: 7:30 AM - 5:00 PM'
            });

            worksheet.addRow({
                id: '########',
                teacher_id: 'example@alabang.sti.edu.ph',
                sname: 'Reurreccion',
                fname: 'James Murfhy',
                mi: 'C',
                suffix: '',
                code: 'JMR',
                spec: 'Business and Management',
                type: 'FT',
                availability: '[Mon - Fri] 7:00 AM - 8:00 PM'
            });

            worksheet.autoFilter = "A1:J1";

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, 'Teacher_Import_Template.xlsx');
            return "200";
        } catch (error) {
            console.error(error);
            return "500";
        }
    }

    function getCellText(cell: ExcelJS.Cell): string {
        const value = cell.value;

        if (value == null) return "";

        // plain string / number
        if (typeof value === "string" || typeof value === "number") {
            return value.toString().trim();
        }

        // hyperlink object (common for emails/URLs)
        if (typeof value === "object" && "text" in value) {
            return String(value.text).trim();
        }

        // fallback for rich text
        if (typeof value === "object" && "richText" in value) {
            return value.richText.map((t: any) => t.text).join("").trim();
        }

        return "";
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        try {
            const ExcelJS = (await import("exceljs")).default;

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const worksheet = workbook.getWorksheet(1);

            if (!worksheet) {
                setStatusCode("400");
                setToastMessage("Invalid file: worksheet not found.");
                setShowToast(true);
                setLoading(false);
                return;
            }

            /** -----------------------------
             *  1. HEADER VALIDATION
             * ----------------------------- */
            const expectedHeaders = [
                "PSCS ID",
                "TEACHER ID",
                "Email",
                "Surname",
                "First Name",
                "Mi",
                "Suffix",
                "Code",
                "Specialization",
                "Employment Type",
                "Availability (Day: Time | Day: Time)"
            ];

            const actualHeaders = Array.from({ length: 11 }, (_, i) =>
                worksheet.getRow(1).getCell(i + 1).value?.toString().trim()
            );

            const isValidHeader = expectedHeaders.every(
                (h, i) => h === actualHeaders[i]
            );

            if (!isValidHeader) {
                setStatusCode("400");
                setToastMessage("Invalid file format: headers do not match template.");
                setShowToast(true);
                setLoading(false);
                return;
            }

            /** -----------------------------
             *  2. PROCESS ROWS
             * ----------------------------- */
            const teachersToImport: any[] = [];

            let invalidRows = 0;
            let skippedRows = 0;

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;

                const id = row.getCell(1).value?.toString().trim() || "";
                const teacher_id = row.getCell(2).value?.toString().trim() || "";
                const email = getCellText(row.getCell(3));
                const sname = row.getCell(4).value?.toString().trim() || "";
                const fname = row.getCell(5).value?.toString().trim() || "";
                const mi = row.getCell(6).value?.toString().trim() || "";
                const suffix = row.getCell(7).value?.toString().trim() || "";
                const code = row.getCell(8).value?.toString().trim() || "";
                const spec = row.getCell(9).value?.toString().trim() || "";
                const type = row.getCell(10).value?.toString().trim() || "FT";
                const availStr = row.getCell(11).value?.toString().trim() || "";

                /** skip empty rows */
                if (!id && !fname && !sname && !code) {
                    skippedRows++;
                    return;
                }

                /** skip template rows */
                if (id.startsWith("#")) {
                    skippedRows++;
                    return;
                }

                /** HARD VALIDATION */
                const isInvalid =
                    !id ||
                    !teacher_id ||
                    !fname ||
                    !sname ||
                    !code ||
                    !["FT", "PT", "PTFL"].includes(type);

                if (isInvalid) {
                    invalidRows++;
                    return;
                }

                /** -----------------------------
                 *  3. PARSE AVAILABILITY
                 * ----------------------------- */
                let availability: any[] = [];

                if (type === "PT" || type === "PTFL") {
                    availability = availStr
                        .split("|")
                        .map(s => s.trim())
                        .filter(Boolean)
                        .map(slot => {
                            const firstColon = slot.indexOf(":");
                            if (firstColon === -1) return null;

                            const day = slot.substring(0, firstColon).trim();
                            const timePart = slot.substring(firstColon + 1).trim();
                            const [startTime, endTime] = timePart.split("-").map(t => t.trim());

                            if (!day || !startTime || !endTime) return null;

                            return { day, startTime, endTime };
                        })
                        .filter(Boolean);
                }

                teachersToImport.push({
                    id,
                    teacher_id,
                    email,
                    sname,
                    fname,
                    mi,
                    suffix,
                    code,
                    spec,
                    type,
                    availability
                });
            });

            /** -----------------------------
             *  4. NO VALID DATA CHECK
             * ----------------------------- */
            if (teachersToImport.length === 0) {
                setStatusCode("400");
                setToastMessage("No valid rows found in the file.");
                setShowToast(true);
                setLoading(false);
                return;
            }

            /** -----------------------------
             *  5. INSERT DATA
             * ----------------------------- */
            let successCount = 0;
            let failedCount = 0;

            for (const t of teachersToImport) {
                try {
                    const res = await insertTeacher(
                        t.id,
                        t.teacher_id,
                        t.email,
                        t.fname,
                        t.sname,
                        t.mi,
                        t.suffix,
                        t.code,
                        t.spec,
                        t.type,
                        t.availability
                    );

                    if (res === "201") {
                        successCount++;
                    } else {
                        failedCount++;
                    }
                } catch (err) {
                    failedCount++;
                    console.error(err);
                }
            }

            /** -----------------------------
             *  6. TOAST STATS (IMPORTANT)
             * ----------------------------- */
            setImportStats({
                imported: successCount,
                failed: invalidRows + failedCount,
                total: teachersToImport.length + invalidRows + skippedRows
            });

            if (successCount > 0 && failedCount === 0 && invalidRows === 0) {
                setStatusCode("201");
                setToastMessage(`Successfully imported ${successCount} teacher(s).`);
            } else if (successCount > 0) {
                setStatusCode("207");
                setToastMessage(
                    `Imported ${successCount}, failed ${failedCount + invalidRows}.`
                );
            } else {
                setStatusCode("409");
                setToastMessage(
                    `Import failed. ${failedCount + invalidRows} invalid row(s).`
                );
            }

            /** -----------------------------
             *  7. REFRESH UI
             * ----------------------------- */
            await loadInitialData();
            await loadRowCount();

        } catch (error) {
            console.error(error);
            setStatusCode("500");
            setToastMessage("Unexpected error while importing file.");
        } finally {
            setLoading(false);
            setShowToast(true);

            if (e.target) {
                e.target.value = "";
            }
        }
    }

    /** Filtering **/
    const [statusCode, setStatusCode] = useState("");

    useEffect(() => {
        let isCancelled = false;
        const fetchData = async () => {
            try {
                // Only show table loading for search/pagination, not initial load
                if (!loading) {
                    setTableLoading(true);
                }
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
    }, [currentPage, debouncedSearch, filterType]); // Add filterType to dependencies

    useEffect(() => {
        if (showToast) {
            setProgress(100);
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 100);
            const timer = setTimeout(() => setShowToast(false), 5000);
            return () => { clearInterval(interval); clearTimeout(timer); setToastMessage("");};
        }
    }, [showToast]);

    useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filterType]); // Add filterType to dependencies
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 2000);
        return () => clearTimeout(handler);
    }, [search]);

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            <div className={`${loading? "":"hidden"} fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm`}>
                {/* The Spinner Container */}
                <div className="flex flex-col items-center gap-4">
                    <Spinner size="xl" />
                    <p className="text-white font-semibold text-lg drop-shadow-md">
                        Syncing Teachers...
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h1 className="mb-4 font-bold text-2xl">Manage Teachers</h1>
                <div className="flex space-x-3">
                    <Dropdown color={"alternative"} label={"Actions"} dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadImportTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>Import</DropdownItem>
                        <DropdownItem onClick={() => handleExportToExcel()}>Export</DropdownItem>
                    </Dropdown>
                    <Button onClick={() => setAddModal(true)}>Add Teacher</Button>
                </div>
            </div>

            <div className="flex gap-4 mb-4">
                <TextInput
                    className="w-62"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {/* The Select component for filterType is now removed from here */}
            </div>

            <div className="relative">
                {tableLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                        <Spinner aria-label="Table loading" size="xl" />
                    </div>
                )}
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>ID</TableHeadCell>
                            <TableHeadCell>Name</TableHeadCell>
                            <TableHeadCell>Code</TableHeadCell>
                            <TableHeadCell>Spec.</TableHeadCell>
                            <TableHeadCell>
                                <Dropdown
                                    label="Type"
                                    inline
                                    dismissOnClick={true}
                                    renderTrigger={() => (
                                        <span className="cursor-pointer flex items-center gap-1 hover:text-blue-500">
                                            Type {filterType !== "All" && `(${filterType})`} <IoMdArrowDropdown />
                                        </span>
                                    )}
                                >
                                    <DropdownItem onClick={() => setFilterType("All")}>All Types</DropdownItem>
                                    <DropdownItem onClick={() => setFilterType("FT")}>FT</DropdownItem>
                                    <DropdownItem onClick={() => setFilterType("PTFL")}>PTFL</DropdownItem>
                                    <DropdownItem onClick={() => setFilterType("PT")}>PT</DropdownItem>
                                </Dropdown>
                            </TableHeadCell>
                            <TableHeadCell>Availability</TableHeadCell>
                            <TableHeadCell><span className="sr-only">Edit</span></TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {teachers.length > 0 ? (
                            teachers.map((t) => (
                                <TableRow key={t.pscs_id}>
                                    <TableCell className="font-bold">{t.teacher_id}</TableCell>
                                    <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                        {t.fname + (t.mi === "" ? "" : " " + t.mi + ".") + " " + t.sname + (t.suffix === "" ? "" : " " + t.suffix)}</TableCell>
                                    <TableCell>{t.teacher_code}</TableCell>
                                    <TableCell>{t.specialization}</TableCell>
                                    <TableCell>{t.employment_type}</TableCell>
                                    <TableCell>
                                        <div className="text-xs space-y-1">
                                            {(t.employment_type === "PT") ? (
                                                (t.availability || []).map((s, i) => (
                                                    <div key={i} className="whitespace-nowrap bg-blue-50 dark:bg-blue-900/20 px-1 rounded">{s.day}: {s.startTime + " - " + s.endTime}</div>
                                                ))
                                            ) : (
                                                <span className="text-gray-400 italic">[Mon - Fri] 7:00 AM - 8:00 PM</span>
                                            )}
                                            {(t.employment_type === "PT") && (t.availability || []).length === 0 && (
                                                <span className="text-yellow-500 italic font-medium">Pending Entry</span>
                                            )}
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
                                <Label>PSCS ID *</Label>
                                <TextInput value={pscsId} onChange={e => { setPscsId(pscsSanitization(e.target.value)) }} placeholder="0001" />
                            </div>
                            <div>
                                <Label>Teacher ID *</Label>
                                <TextInput value={teacherId} onChange={e => { setTeacherId(sanitizeTeacherId(e.target.value)) }} placeholder="A1B2C3" />
                            </div>
                        </div>
                        <div className={"grid grid-cols-4 gap-4"}>
                            <div className={"col-span-3"}>
                                <Label>First Name *</Label>
                                <TextInput value={fname} onChange={e => { setFname(sanitizeTeacherName(e.target.value)) }} placeholder="John" />
                            </div>
                            <div className={"col-span-1"}>
                                <Label>M.I.</Label>
                                <TextInput value={mi} onChange={e => { setMi(sanitizeMiName(e.target.value)) }} placeholder="F" />
                            </div>
                        </div>
                        <div className={"grid grid-cols-4 gap-4"}>
                            <div className={"col-span-3"}>
                                <Label>Last Name *</Label>
                                <TextInput value={sname} onChange={e => { setSname(sanitizeTeacherName(e.target.value)) }} placeholder="Doe" />
                            </div>
                            <div>
                                <Label>Suffix</Label>
                                <TextInput value={suffix} onChange={e => { setSuffix(sanitizeSuffix(e.target.value)) }} placeholder="Jr" />
                            </div>
                        </div>
                        <div className={"grid grid-cols-4 gap-4"}>
                            <div>
                                <Label>Code *</Label>
                                <TextInput value={code} onChange={e => { setCode(sanitizeTeacherCode(e.target.value)) }} placeholder="JFD" />
                            </div>
                            <div className={"col-span-3"}>
                                <Label>Email *</Label>
                                <Popover
                                    open={email && !containsEmail}
                                    content={'Must End With "@alabang.sti.edu.ph"'}
                                    placement="top"
                                >
                                    <TextInput icon={HiMail}
                                               value={email}
                                               color={email && !containsEmail? "failure":"gray"}
                                               onChange={e => { setEmail(sanitizeEmail(e.target.value)) }} placeholder="example@alabang.sti.edu.ph"/>
                                </Popover>
                                </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Specialization</Label>
                                <Select
                                    id="roomType"
                                    className="w-52"
                                    value={spec}
                                    onChange={(e) => {
                                        setSpec(e.target.value);
                                    }}
                                >
                                    {dropdownValues.map((ddValues) => (
                                            <option
                                                key={ddValues.value + ddValues.value_for}
                                                value={ddValues.value}
                                            >
                                                {ddValues.value}
                                            </option>
                                        ))
                                    }
                                </Select>
                            </div>
                            <div className={"flex justify-end"}>
                                <div className={"w-28"}>
                                    <Label>Emp. Type</Label>
                                    <Select value={type}
                                            onChange={e => { setType(e.target.value) }}>
                                        <option>FT</option>
                                        <option>PTFL</option>
                                        <option>PT</option>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <AvailabilityManager availability={availability} onUpdate={setAvailability} employmentType={type} />
                    </ModalBody>
                    <ModalFooter className="justify-end">
                        <Button color="alternative" onClick={activeChanges ? () => setOpenWarningModal(true) : discardEntry}>
                            {activeChanges ? "Discard" : "Cancel"}
                        </Button>
                        <Button onClick={submitTeacher}
                                disabled={!pscsId || !teacherId || !email || !fname || !sname || !code}>
                            Save</Button>
                    </ModalFooter>
                </Modal>

                {/* Edit Modal */}
                <Modal show={editModal} onClose={() => setEditModal(false)} size="md">
                    <ModalHeader>Editing: {teacherId}</ModalHeader>
                    <ModalBody className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>PSCS ID</Label>
                                <div className={"py-1.5 font-bold"}>{pscsId}</div>
                                <TextInput required value={pscsId} readOnly disabled hidden/>
                            </div>
                            <div>
                                <Label>Teacher Code *</Label>
                                <TextInput required value={code} onChange={e => { setCode(sanitizeTeacherCode(e.target.value)) }} />
                            </div>
                        </div>
                        <div>
                            <Label>Email *</Label>
                            <Popover
                                open={!containsEmail}
                                content={(
                                    <div className={"p-2"}>
                                        Must End With @alabang.sti.edu.ph
                                    </div>)}
                                placement="top"
                            >
                                <TextInput required
                                           value={email}
                                           color={!containsEmail? "failure":"gray"}
                                           onChange={e => { setEmail(sanitizeEmail(e.target.value)) }} placeholder="example@alabang.sti.edu.ph"/>
                            </Popover>
                        </div>
                        <div className={"grid grid-cols-4 gap-4"}>
                            <div className={"col-span-3"}>
                                <Label>First Name *</Label>
                                <TextInput required value={fname} onChange={e => { setFname(sanitizeTeacherName(e.target.value)) }} />
                            </div>
                            <div>
                                <Label>M.I.</Label>
                                <TextInput value={mi} placeholder={"A"} onChange={e => { setMi(sanitizeMiName(e.target.value)) }} />
                            </div>
                        </div>
                        <div className={"grid grid-cols-4 gap-4"}>
                            <div className={"col-span-3"}>
                                <Label>Last Name *</Label>
                                <TextInput required value={sname} onChange={e => { setSname(sanitizeTeacherName(e.target.value)) }} />
                            </div>
                            <div>
                                <Label>Suffix</Label>
                                <TextInput value={suffix} placeholder={"Jr"} onChange={e => { setSuffix(sanitizeSuffix(e.target.value)) }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Specialization</Label>
                                <Select
                                    id="roomType"
                                    className="w-52"
                                    value={spec}
                                    onChange={(e) => {
                                        setSpec(e.target.value)
                                    }}
                                >
                                    {dropdownValues
                                        .map((ddValues) => (
                                            <option
                                                key={ddValues.value + ddValues.value_for}
                                                value={ddValues.value}
                                                hidden={ddValues.value == spec}
                                            >
                                                {ddValues.value}
                                            </option>
                                        ))
                                    }
                                </Select>
                            </div>
                            <div className={"flex justify-end"}>
                                <div className={"w-28"}>
                                    <Label>Emp. Type</Label>
                                    <Select value={type}
                                            onChange={e => { setType(e.target.value) }}>
                                        <option>FT</option>
                                        <option>PTFL</option>
                                        <option>PT</option>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <AvailabilityManager availability={availability} onUpdate={(v) => { setAvailability(v) }} employmentType={type} />
                    </ModalBody>
                    <ModalFooter>
                        <Button color="red" onClick={() => setOpenWarningModal(true)}><HiOutlineTrash className="size-5" /></Button>
                        <div className="flex-1 flex justify-end space-x-2">
                            <Button color="alternative" onClick={discardEntry}>
                                {activeChanges ? "Discard" : "Cancel"}
                            </Button>
                            <Button disabled={!activeChanges} onClick={updateEntry}>Update</Button>
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
                <Toast className={`fixed block z-60 bottom-10 right-10 transition-opacity duration-500 
                ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

                    <div className={"flex items-center"}>
                        {/* Icon */}
                        <div
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                                ${
                                    statusCode.startsWith("2")
                                        ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                                        : statusCode === "207"
                                            ? "bg-blue-100 text-blue-500 dark:bg-blue-800 dark:text-blue-200"
                                            : statusCode.startsWith("5")
                                                ? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-500"
                                                : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
                                }
                            `}
                        >
                            {statusCode.startsWith("2") ? (
                                <HiCheck className="h-5 w-5" />
                            ) : (
                                <HiExclamation className="h-5 w-5" />
                            )}
                        </div>

                        {/* Message */}
                        <div className="ml-3 text-sm font-normal">
                            <div>
                                {toastMessage || STATUS_MESSAGES[statusCode] || "An unknown error occurred."}
                            </div>

                            {/* 👇 THIS is the part you wanted (import success/fail shown inside toast) */}
                            {importStats.total > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                    Imported: {importStats.imported} • Failed: {importStats.failed} • Total: {importStats.total}
                                </div>
                            )}
                        </div>

                        <ToastToggle
                            onDismiss={() => {
                                setShowToast(false);
                                setProgress(0);
                            }}
                        />
                    </div>

                    {/* Progress bar (same style as RoomManager) */}
                    <Progress size="sm" className="mt-2 mb-0 pb-0" progress={progress} />
                </Toast>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx"
                    onChange={handleImport}
                />
            </div>
        </div>
    );
}
