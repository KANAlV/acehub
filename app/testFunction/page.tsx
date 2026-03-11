"use client"

import { useState } from "react"
import ExcelJS from "exceljs"

/* ---------- Types ---------- */
type Section = {
    program: string
    section_code: string
}

type Subject = {
    program: string
    subject_code: string
    subject: string
    abbreviation: string
    units: number
    degree: string[]
    others: string[]
    laboratory: string | null
    year_level: number
    semester: number
    isMajor: boolean
}

type Teacher = {
    pscs_id: string
    last_name: string
    first_name: string
    middle_name: string
    abbreviation: string
    status: string
}

type Credentials = {
    pscs_id: string
    subject_code: string
    type_of_certification: string
    fcce_score: string
    exam_status: string
    fcc_status: string
    fcc_remarks: string
}

type Rooms = {
    room_code: string
    room_type: string
}

type Cell = {
    subject: string
    teacher: string
    program: string
    section: string
    room: string
}

type TeacherLoad = {
    teacher: Teacher
    assignedPrograms: Set<string>
    assignedUnits: number
    subjects: Subject[]
}

type Schedule = Record<string, Record<string, Cell | null>>

type FullSchedule = Record<string, Schedule>

/* ---------- Test Data ---------- */
const sections: Section[] = [
    { program: "BSBA", section_code: "111" },
    { program: "BSBA", section_code: "112" },

    { program: "BSIT", section_code: "111" },
    { program: "BSIT", section_code: "112" },

    { program: "BSTM", section_code: "111" },
    { program: "BSTM", section_code: "112" },

    { program: "BSHM", section_code: "111" },
    { program: "BSHM", section_code: "112" },
]

const subjects: Subject[] = [
    // --- BSIT 1st year ---
    {
        program: "BSIT-22-01",
        subject_code: "COMP101",
        subject: "Introduction to Programming",
        abbreviation: "ITPROG",
        degree: ["IT"],
        others: [],
        laboratory: "Computer Lab",
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },
    {
        program: "BSIT-22-01",
        subject_code: "COMP102",
        subject: "Computer Fundamentals",
        abbreviation: "COMP",
        degree: ["IT"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },

    // --- BSBA 1st year ---
    {
        program: "BSBA-22-01",
        subject_code: "BUS101",
        subject: "Principles of Management",
        abbreviation: "PRINMAN",
        degree: ["BM"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },
    {
        program: "BSBA-22-01",
        subject_code: "BUS102",
        subject: "Business Communication",
        abbreviation: "BUSCOM",
        degree: ["BM"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },

    // --- BSTM 1st year ---
    {
        program: "BSTM-22-01",
        subject_code: "TOUR101",
        subject: "Introduction to Tourism",
        abbreviation: "INTROTOUR",
        degree: ["TM"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },
    {
        program: "BSTM-22-01",
        subject_code: "TOUR102",
        subject: "Tourism Geography",
        abbreviation: "TOURGEO",
        degree: ["TM"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },

    // --- BSHM 1st year ---
    {
        program: "BSHM-22-01",
        subject_code: "HOT101",
        subject: "Hospitality Management",
        abbreviation: "HOSP",
        degree: ["HM"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },
    {
        program: "BSHM-22-01",
        subject_code: "HOT102",
        subject: "Front Office Operations",
        abbreviation: "FOO",
        degree: ["HM"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 3,
        isMajor: true
    },

    // --- General Education (GE) ---
    {
        program: "GE",
        subject_code: "GE101",
        subject: "English Communication",
        abbreviation: "ENGCOM",
        degree: ["GE"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 2,
        isMajor: false
    },
    {
        program: "GE",
        subject_code: "GE102",
        subject: "Physical Education",
        abbreviation: "PE",
        degree: ["GE"],
        others: [],
        laboratory: null,
        year_level: 1,
        semester: 1,
        units: 2,
        isMajor: false
    }
]

const teachers: Teacher[] = [
    {
        pscs_id: "1",
        last_name: "CRUZ",
        first_name: "ALICE",
        middle_name: "",
        abbreviation: "ACS",
        status: "FT"
    },
    {
        pscs_id: "2",
        last_name: "REYES",
        first_name: "JUAN",
        middle_name: "",
        abbreviation: "JRS",
        status: "FT"
    },
    {
        pscs_id: "3",
        last_name: "MENDOZA",
        first_name: "CARLA",
        middle_name: "",
        abbreviation: "CMZ",
        status: "PT"
    },
    {
        pscs_id: "4",
        last_name: "GOMEZ",
        first_name: "MARK",
        middle_name: "",
        abbreviation: "MGZ",
        status: "FT"
    },
    {
        pscs_id: "5",
        last_name: "SALVADOR",
        first_name: "LIZA",
        middle_name: "",
        abbreviation: "LSV",
        status: "FT"
    },
    {
        pscs_id: "6",
        last_name: "TORRES",
        first_name: "DANIEL",
        middle_name: "",
        abbreviation: "DTR",
        status: "PT"
    }
];

const credentials: Credentials[] = [
    // BSIT subjects
    { pscs_id: "1", subject_code: "COMP101", type_of_certification: "Certified Teacher", fcce_score: "95", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },
    { pscs_id: "1", subject_code: "COMP102", type_of_certification: "Certified Teacher", fcce_score: "92", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },

    // BSBA subjects
    { pscs_id: "2", subject_code: "BUS101", type_of_certification: "Certified Teacher", fcce_score: "88", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },
    { pscs_id: "2", subject_code: "BUS102", type_of_certification: "Certified Teacher", fcce_score: "90", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },

    // BSTM subjects
    { pscs_id: "3", subject_code: "TOUR101", type_of_certification: "Provisional", fcce_score: "75", exam_status: "Passed", fcc_status: "Provisional", fcc_remarks: "Under probation" },
    { pscs_id: "3", subject_code: "TOUR102", type_of_certification: "Certified Teacher", fcce_score: "80", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },

    // BSHM subjects
    { pscs_id: "4", subject_code: "HOT101", type_of_certification: "Certified Teacher", fcce_score: "92", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },
    { pscs_id: "4", subject_code: "HOT102", type_of_certification: "Certified Teacher", fcce_score: "89", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },

    // GE subjects
    { pscs_id: "5", subject_code: "GE101", type_of_certification: "Certified Teacher", fcce_score: "85", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" },
    { pscs_id: "6", subject_code: "GE102", type_of_certification: "Certified Teacher", fcce_score: "80", exam_status: "Passed", fcc_status: "Certified", fcc_remarks: "" }
];

const rooms: Rooms[] = [
    { room_code: "101", room_type: "Lecture Hall" },
    { room_code: "102", room_type: "Lecture Hall" },
    { room_code: "103", room_type: "Lecture Hall" },
    { room_code: "104", room_type: "Lecture Hall" },

    // Computer Labs for IT subjects
    { room_code: "ComLab1", room_type: "Computer Lab" },
    { room_code: "ComLab2", room_type: "Computer Lab" },

    // Kitchen Labs for Hospitality subjects
    { room_code: "KitchenLab1", room_type: "Kitchen Lab" },
    { room_code: "KitchenLab2", room_type: "Kitchen Lab" }
]

/* ---------- Constants ---------- */
const max_load = 24
const preferred_length = 3
const preferred_lab = 4
const maxPrep = 4

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/* ---------- Time Blocks ---------- */
const timeBlocks: string[] = []

let hour = 7
let minute = 30

while (true) {

    const label = `${hour}:${minute.toString().padStart(2, "0")}`
    timeBlocks.push(label)

    minute += 30

    if (minute === 60) {
        minute = 0
        hour++
    }

    if (hour === 19 && minute === 30) break
}

/* ---------- Helpers ---------- */
function shuffleArray<T>(array: T[]): T[] {

    const arr = [...array]

    for (let i = arr.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]

    }

    return arr
}

function getProgram(program: string) {
    return program.split("-")[0]
}

function createSchedule(): Schedule {

    const sched: Schedule = {}

    for (const d of days) {

        sched[d] = {}

        for (const t of timeBlocks)
            sched[d][t] = null

    }

    return sched
}

/* ---------- Teacher Assignment ---------- */
function getEligibleTeachers(subj: Subject, teachers: Teacher[], credentials: Credentials[]): Teacher[] {
    return teachers.filter(teacher =>
        credentials.some(cred =>
            cred.pscs_id === teacher.pscs_id &&
            cred.subject_code === subj.subject_code
        )
    );
}

function assignTeacherSubjects(
    subjects: Subject[],
    teachers: Teacher[],
    credentials: Credentials[],
    maxPrep: number,
    max_load: number
): TeacherLoad[] {
    const teacherLoads: TeacherLoad[] = teachers.map(t => ({
        teacher: t,
        assignedPrograms: new Set(),
        assignedUnits: 0,
        subjects: []
    }));

    for (const subj of subjects) {
        const eligibleTeachers = getEligibleTeachers(subj, teachers, credentials);

        if (eligibleTeachers.length === 0) {
            console.warn(`No eligible teacher found for subject ${subj.abbreviation}`);
            continue;
        }

        // Shuffle to randomize selection
        const shuffled = shuffleArray(eligibleTeachers);

        for (const t of shuffled) {
            const load = teacherLoads.find(l => l.teacher.pscs_id === t.pscs_id)!;

            const programId = getProgram(subj.program);

            // Check maxPrep & max_load
            if (!load.assignedPrograms.has(programId) && load.assignedPrograms.size >= maxPrep) continue;
            if (load.assignedUnits + subj.units > max_load) continue;

            // Assign
            load.subjects.push(subj);
            load.assignedUnits += subj.units;
            load.assignedPrograms.add(programId);
            break;
        }
    }

    return teacherLoads;
}

/* ---------- Scheduler ---------- */
function generateScheduleWithAssignments(semester: number): FullSchedule {
    const full: FullSchedule = {};

    // Step 1: Assign subjects to teachers
    const teacherLoads = assignTeacherSubjects(
        subjects.filter(s => s.semester === semester),
        teachers,
        credentials,
        maxPrep,
        max_load
    );

    // Step 2: Create schedule for each section
    for (const sec of sections) {
        const sectionKey = `${sec.program}${sec.section_code}`;
        full[sectionKey] = createSchedule();
    }

    // Helper: pick a random room of a given type
    const getRandomRoom = (roomType: string) => {
        const available = rooms.filter(r => r.room_type === roomType);
        return available[Math.floor(Math.random() * available.length)].room_code;
    };

    // Step 3: Place subjects according to teacher assignments
    for (const load of teacherLoads) {
        for (const subj of load.subjects) {
            const year = subj.year_level;

            const sameYearSections = subj.degree.includes("GE")
                ? sections.filter(s => parseInt(s.section_code[0]) === year)
                : sections.filter(
                    s => getProgram(s.program) === getProgram(subj.program) && parseInt(s.section_code[0]) === year
                );

            const totalBlocks = subj.laboratory ? preferred_lab : preferred_length;
            const lecBlocks = Math.ceil(preferred_length); // simple mapping
            const labBlocks = subj.laboratory ? totalBlocks - lecBlocks : 0;

            const shuffledDays = shuffleArray(days);

            // Track occupied blocks for this teacher
            const teacherOccupied: Record<string, boolean[]> = {};
            for (const day of days) teacherOccupied[day] = Array(timeBlocks.length).fill(false);

            for (const sec of sameYearSections) {
                const sectionKey = `${sec.program}${sec.section_code}`;
                const sched = full[sectionKey];
                let placed = false;

                for (const day of shuffledDays) {
                    if (placed) break;

                    const indexes = shuffleArray([...Array(timeBlocks.length - totalBlocks + 1).keys()]);

                    for (const i of indexes) {
                        // Check teacher availability
                        let free = true;
                        for (let b = 0; b < totalBlocks; b++) {
                            if (teacherOccupied[day][i + b]) {
                                free = false;
                                break;
                            }
                        }
                        if (!free) continue;

                        // Assign lecture first
                        const lectureRoom = getRandomRoom("Lecture Hall");
                        for (let b = 0; b < lecBlocks; b++) {
                            const tIndex = i + b;
                            const t = timeBlocks[tIndex];
                            sched[day][t] = {
                                subject: subj.abbreviation,
                                teacher: load.teacher.abbreviation,
                                section: sec.section_code,
                                program: sec.program,
                                room: lectureRoom
                            };
                            teacherOccupied[day][tIndex] = true;
                        }

                        // Assign lab blocks if any
                        if (labBlocks > 0 && subj.laboratory) {
                            const labRoom = getRandomRoom(subj.laboratory);
                            for (let b = 0; b < labBlocks; b++) {
                                const tIndex = i + lecBlocks + b;
                                const t = timeBlocks[tIndex];
                                sched[day][t] = {
                                    subject: subj.abbreviation,
                                    teacher: load.teacher.abbreviation,
                                    section: sec.section_code,
                                    program: sec.program,
                                    room: labRoom
                                };
                                teacherOccupied[day][tIndex] = true;
                            }
                        }

                        placed = true;
                        break;
                    }
                }

                if (!placed) {
                    console.warn(`Could not place ${subj.abbreviation} for section ${sec.section_code}`);
                }
            }
        }
    }

    return full;
}

/* ---------- Excel Export ---------- */

async function exportExcel(schedule: FullSchedule) {
    const wb = new ExcelJS.Workbook();

    for (const section in schedule) {
        const ws = wb.addWorksheet(section);
        const sched = schedule[section];

        // ---------- Column Setup ----------
        ws.getColumn(1).width = 2; // left spacer
        ws.getColumn(2).width = 10; // time column

        let colIndex = 3;
        for (let i = 0; i < days.length; i++) {
            ws.getColumn(colIndex).width = 16; // day column
            colIndex++;
            if (i < days.length - 1) {
                ws.getColumn(colIndex).width = 2; // spacer
                colIndex++;
            }
        }
        ws.getColumn(colIndex).width = 2; // right spacer

        // ---------- Header Rows ----------
        ws.mergeCells(1, 2, 1, colIndex);
        ws.getCell(1, 2).value = "CLASS SCHEDULE";
        ws.getCell(1, 2).alignment = { horizontal: "center", vertical: "middle" };

        ws.mergeCells(2, 2, 2, colIndex);
        ws.getCell(2, 2).value = "MODIFIED SCHEDULE      TERTIARY";
        ws.getCell(2, 2).alignment = { horizontal: "center", vertical: "middle" };

        ws.mergeCells(4, 2, 6, 2);
        ws.getCell(4, 2).value = "SY\nPROGRAM\nSECTION";
        ws.getCell(4, 2).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
        ws.getCell(4, 3).value = "2025-2026";
        ws.getCell(5, 3).value = section.slice(0, 4);
        ws.getCell(6, 3).value = section.slice(4);
        for(let i = 4; i < 7; i++){
            ws.getCell(i, 3).alignment = {horizontal: "right"};
        }

        // ---------- Days Row ----------
        const dayRow = 7;
        ws.getRow(dayRow).height = 25.5;
        let startCol = 3;
        for (let i = 0; i < days.length; i++) {
            const col = startCol + i * 2;
            ws.getCell(dayRow, col).value = days[i].toUpperCase();
            ws.getCell(dayRow, col).alignment = { horizontal: "center", vertical: "middle" };
        }

        // ---------- Schedule Rows ----------
        let excelRow = dayRow + 1;
        const timeToRow: Record<string, number> = {};
        timeBlocks.forEach((t, i) => timeToRow[t] = excelRow + i);

        for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
            const day = days[dayIdx];
            const col = 3 + dayIdx * 2; // column for this day

            let rowIdx = 0;
            while (rowIdx < timeBlocks.length) {
                const t = timeBlocks[rowIdx];
                const cell = sched[day][t];

                if (!cell) {
                    rowIdx++;
                    continue;
                }

                // Count consecutive blocks for merging
                let span = 1;
                for (let j = rowIdx + 1; j < timeBlocks.length; j++) {
                    const nextT = timeBlocks[j];
                    const nextCell = sched[day][nextT];
                    if (
                        nextCell &&
                        nextCell.subject === cell.subject &&
                        nextCell.teacher === cell.teacher &&
                        nextCell.section === cell.section
                    ) {
                        span++;
                    } else {
                        break;
                    }
                }

                const startRow = excelRow + rowIdx;
                const endRow = startRow + span - 1;

                // Merge cells for multi-block class
                ws.mergeCells(startRow, col, endRow, col);
                ws.getCell(startRow, col).value = `${cell.subject}/${cell.teacher}\n${cell.program}${cell.section}\n${cell.room}`;
                ws.getCell(startRow, col).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

                rowIdx += span;
            }
        }

        // ---------- Time Column ----------
        for (let i = 0; i < timeBlocks.length; i++) {
            const t = timeBlocks[i];
            let [hour, min] = t.split(":").map(Number);
            let endHour = hour;
            let endMin = min + 30;
            if (endMin === 60) { endHour += 1; endMin = 0; }
            const format12 = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${m.toString().padStart(2, "0")}`;
            ws.getRow(excelRow + i).getCell(2).value = `${format12(hour, min)}-${format12(endHour, endMin)}`;
        }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
}

/* ---------- Page ---------- */

export default function Page() {

    const [semester, setSemester] = useState(1)
    const [schedule, setSchedule] = useState<FullSchedule | null>(null)

    function runGeneration() {

        const result = generateScheduleWithAssignments(semester)

        setSchedule(result)
    }

    return (
        <div style={{ padding: 40 }}>

            <h1>Scheduler</h1>

            <div style={{ marginBottom: 20 }}>

                <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                >

                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>

                </select>

                <button
                    onClick={runGeneration}
                    style={{ marginLeft: 10 }}
                >
                    Generate Schedule
                </button>

                {schedule && (
                    <button
                        onClick={() => exportExcel(schedule)}
                        style={{ marginLeft: 10 }}
                    >
                        Export Excel
                    </button>
                )}

            </div>

            {schedule && Object.entries(schedule).map(([section, sched]) => (

                <div key={section} style={{ marginBottom: 50 }}>

                    <h2>{section}</h2>

                    <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>

                        <thead>
                        <tr>
                            <th>Time</th>
                            {days.map(d => <th key={d}>{d}</th>)}
                        </tr>
                        </thead>

                        <tbody>

                        {timeBlocks.map((t, rowIndex) => {
                            // Split start time
                            let [hour, min] = t.split(":").map(Number);

                            // Calculate end time
                            let endHour = hour;
                            let endMin = min + 30;
                            if (endMin === 60) {
                                endHour += 1;
                                endMin = 0;
                            }

                            // Convert to 12-hour format
                            const format12 = (h: number, m: number) => {
                                const hh = h % 12 === 0 ? 12 : h % 12;
                                return `${hh}:${m.toString().padStart(2, "0")}`;
                            };

                            const timeLabel = `${format12(hour, min)} - ${format12(endHour, endMin)}`;

                            return (
                                <tr key={t} className="h-12">
                                    <td className="border border-gray-400 text-xs text-center w-24">
                                        {timeLabel}
                                    </td>

                                    {days.map(day => {
                                        const cell = sched[day][t];
                                        if (!cell) return <td key={day} className="border border-gray-300 w-24"></td>;

                                        // Handle rowspan same as before...
                                        if (rowIndex > 0) {
                                            const prevTime = timeBlocks[rowIndex - 1];
                                            const prevCell = sched[day][prevTime];
                                            if (prevCell &&
                                                prevCell.subject === cell.subject &&
                                                prevCell.section === cell.section &&
                                                prevCell.teacher === cell.teacher
                                            ) return null;
                                        }

                                        let span = 1;
                                        for (let i = rowIndex + 1; i < timeBlocks.length; i++) {
                                            const nextTime = timeBlocks[i];
                                            const nextCell = sched[day][nextTime];
                                            if (nextCell &&
                                                nextCell.subject === cell.subject &&
                                                nextCell.section === cell.section &&
                                                nextCell.teacher === cell.teacher
                                            ) span++;
                                            else break;
                                        }

                                        return (
                                            <td
                                                key={day}
                                                rowSpan={span}
                                                className="
                                                    border-2
                                                    bg-blue-700
                                                    align-middle
                                                    text-center
                                                    text-xs
                                                    text-white
                                                    font-medium
                                                    p-2
                                                    w-24
                                                "
                                            >
                                                <div className="leading-tight">
                                                    <div className="font-semibold">{cell.subject}/{cell.teacher}</div>
                                                    <div>{cell.program}{cell.section}</div>
                                                    <div>{cell.room}</div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    )
}