import {
    fetchAllSubjects,
    fetchAllTeachers,
    getAllProgramsData,
    getAllRoomsData,
    fetchBreakPeriods,
    fetchSystemSettings,
    fetchDropdownValues
} from "@/services/userService";

import {
    getMaxUnitsSync,
    getOverloadMaxSync,
    getPrepLimitSync
} from "@/lib/teachingLoadUtils";

/* ================= TYPES ================= */

type DropdownValue = {
    value: string;
    value_for: string;
};

type TimeSlot = {
    start: number;
    end: number;
};

type Room = {
    room_id: number;
    room_name: string;
    room_type: string;
};

type GeneratedEntry = {
    subjectId: string;
    teacherId: string;
    roomId: string;
    sectionId: string;
    day: string;
    start: number;
    end: number;
};

/* ================= HELPERS ================= */

function parseTimeValue(timeStr?: string): number {
    if (!timeStr || typeof timeStr !== "string") {
        return 0;
    }

    if (timeStr.includes(":") && !timeStr.includes(" ")) {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    }

    const [time, ampm] = timeStr.split(" ");

    if (!time) return 0;

    let [hours, minutes] = time.split(":").map(Number);

    if (ampm === "PM" && hours !== 12) {
        hours += 12;
    }

    if (ampm === "AM" && hours === 12) {
        hours = 0;
    }

    return hours * 60 + (minutes || 0);
}

function parseTimeRange(timeStr?: string): TimeSlot {
    if (!timeStr || typeof timeStr !== "string") {
        return { start: 0, end: 0 };
    }

    const parts = timeStr.split("-").map(p => p.trim());

    if (parts.length !== 2) {
        return { start: 0, end: 0 };
    }

    return {
        start: parseTimeValue(parts[0]),
        end: parseTimeValue(parts[1])
    };
}

function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];

    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }

    return newArr;
}

function logPlacementIssue(issue: string, details: any) {
    console.warn(`[SCHEDULER] ${issue}:`, details);
}

function getOptimalSessionDuration(remainingMinutes: number): number {
    if (remainingMinutes <= 0) return 0;
    if (remainingMinutes <= 60) return remainingMinutes;
    if (remainingMinutes <= 90) return 90;
    if (remainingMinutes <= 120) return 120;
    if (remainingMinutes <= 180) return 120;

    return 180;
}

/* ================= ENGINE ================= */

export async function generateScheduleData(config: any) {
    const {
        subjects: selectedIds,
        assignments,
        overrides,
        semester,
        mergeLecLab = {}
    } = config;

    const currentSemester = parseInt(semester || "1");

    const [
        allSubjects,
        allTeachers,
        allPrograms,
        allRoomsData,
        breakPeriods,
        systemSettings,
        dropdownValues
    ] = await Promise.all([
        fetchAllSubjects(),
        fetchAllTeachers(),
        getAllProgramsData(),
        getAllRoomsData(),
        fetchBreakPeriods(),
        fetchSystemSettings(),
        fetchDropdownValues("laboratory")
    ]);

    /**
     * STATIC + DYNAMIC ROOM TYPES
     * Lecture always exists
     */
    const ROOM_TYPES = [
        "Lecture",
        ...dropdownValues
            .filter(
                (ddValues: DropdownValue) =>
                    ddValues.value !== "Lecture"
            )
            .map(
                (ddValues: DropdownValue) =>
                    ddValues.value
            )
    ];

    const allRooms: Room[] = allRoomsData;

    const DAYS = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const START_LIMIT = parseTimeValue(
        systemSettings.startTime || "7:00 AM"
    );

    const END_LIMIT = parseTimeValue(
        systemSettings.endTime || "8:00 PM"
    );

    const MAX_STUDENTS_PER_SECTION = Number(
        systemSettings.maxStudents || 40
    );

    const SLOT_SIZE = 30;

    const activeSubjects = allSubjects.filter(
        (s: any) => selectedIds.includes(s.id)
    );

    const virtualSections: {
        id: string;
        programCode: string;
        year: string;
        targetYearTerm: string;
        level: string;
    }[] = [];

    for (const program of allPrograms) {
        const yearLevels = program.students || {};

        for (const [year, count] of Object.entries(yearLevels)) {
            const yearNum = parseInt(year);

            const numSections = Math.ceil(
                Number(count) / MAX_STUDENTS_PER_SECTION
            );

            let firstDigit = 0;
            let targetYearTerm = "";

            if (program.level === "SHS") {
                firstDigit = yearNum === 11 ? 1 : 2;
                targetYearTerm = yearNum.toString();
            } else {
                firstDigit =
                    (yearNum - 1) * 2 + currentSemester;

                targetYearTerm =
                    `${yearNum}-${currentSemester}`;
            }

            for (let i = 0; i < numSections; i++) {
                virtualSections.push({
                    id: `${program.program_code}${firstDigit}1${i + 1}`,
                    programCode: program.program_code,
                    year,
                    targetYearTerm,
                    level: program.level
                });
            }
        }
    }

    const results: GeneratedEntry[] = [];

    const teacherLoad: Record<string, number> = {};
    const teacherSubjects: Record<string, Set<string>> = {};
    const sectionDays: Record<string, Set<string>> = {};

    const sectionAssignments: {
        sectionId: string;
        subject: any;
        teacherId: string;
        components: {
            type: string;
            minutes: number;
            roomType: string;
        }[];
    }[] = [];

    for (const vSection of virtualSections) {
        const subjectsForThisSection =
            activeSubjects.filter((s: any) => {
                const yearMatch =
                    s.year_term ===
                    vSection.targetYearTerm;

                const curriculumMatch =
                    s.curriculumn_version?.includes(
                        vSection.programCode
                    );

                return yearMatch && curriculumMatch;
            });

        for (const sub of subjectsForThisSection) {
            let teacherId = assignments[sub.id];

            if (!teacherId) {
                const eligible = allTeachers.filter(
                    (t: any) => {
                        const spec = (
                            t.specialization || ""
                        ).toLowerCase();

                        const field = (
                            sub.field_of_specialization || ""
                        ).toLowerCase();

                        if (
                            spec.includes(field) &&
                            field !== "none" &&
                            spec !== "none"
                        ) {
                            return true;
                        }

                        if (
                            field === "none" ||
                            spec === "none"
                        ) {
                            return true;
                        }

                        if (vSection.level === "SHS") {
                            return (
                                spec.includes("shs") ||
                                spec.includes("senior") ||
                                spec === "none"
                            );
                        }

                        return (
                            spec.includes(field) ||
                            field === "none" ||
                            spec === "none"
                        );
                    }
                );

                const candidates =
                    eligible.length > 0
                        ? eligible
                        : allTeachers;

                candidates.sort((a: any, b: any) => {
                    const loadA =
                        teacherLoad[a.pscs_id] || 0;

                    const loadB =
                        teacherLoad[b.pscs_id] || 0;

                    return loadA - loadB;
                });

                if (candidates.length > 0) {
                    teacherId = candidates[0].pscs_id;

                    teacherLoad[teacherId] =
                        (teacherLoad[teacherId] || 0) + 1;

                    if (!teacherSubjects[teacherId]) {
                        teacherSubjects[teacherId] =
                            new Set();
                    }

                    teacherSubjects[teacherId].add(sub.id);
                } else {
                    continue;
                }
            }

            const shouldMerge =
                !!mergeLecLab[sub.id];

            const components: {
                type: string;
                minutes: number;
                roomType: string;
            }[] = [];

            if (shouldMerge) {
                const totalMinutes =
                    (
                        Number(sub.lecture_units) +
                        Number(sub.lab_units)
                    ) * 60;

                const validRoomType =
                    ROOM_TYPES.includes(sub.lab_type)
                        ? sub.lab_type
                        : "Lecture";

                components.push({
                    type: "Merged",
                    minutes: totalMinutes,
                    roomType: validRoomType
                });
            } else {
                if (Number(sub.lab_units) > 0) {
                    const validLabType =
                        ROOM_TYPES.includes(sub.lab_type)
                            ? sub.lab_type
                            : "Lecture";

                    components.push({
                        type: "Lab",
                        minutes:
                            Number(sub.lab_units) * 60,
                        roomType: validLabType
                    });
                }

                if (Number(sub.lecture_units) > 0) {
                    components.push({
                        type: "Lecture",
                        minutes:
                            Number(sub.lecture_units) * 60,
                        roomType: "Lecture"
                    });
                }
            }

            sectionAssignments.push({
                sectionId: vSection.id,
                subject: sub,
                teacherId,
                components
            });
        }
    }

    const isAvailable = (
        day: string,
        start: number,
        end: number,
        roomId: string,
        teacherId: string,
        sectionId: string,
        additionalUnits: number = 0
    ) => {
        if (
            start < START_LIMIT ||
            end > END_LIMIT
        ) {
            return false;
        }

        const teacher = allTeachers.find(
            (t: any) =>
                t.pscs_id === teacherId
        );

        if (!teacher) {
            return false;
        }

        const currentLoad =
            teacherLoad[teacherId] || 0;

        const maxUnits = getMaxUnitsSync(
            teacher.employment_type,
            systemSettings
        );

        const overloadMax =
            getOverloadMaxSync(systemSettings);

        const absoluteMax =
            maxUnits + overloadMax;

        if (
            currentLoad + additionalUnits >
            absoluteMax
        ) {
            return false;
        }

        const daysUsedBySection =
            sectionDays[sectionId] || new Set();

        if (
            !daysUsedBySection.has(day) &&
            daysUsedBySection.size >= 5
        ) {
            return false;
        }

        for (const b of breakPeriods) {
            if (
                b.day_of_week?.toLowerCase() ===
                day.toLowerCase()
            ) {
                const bStart =
                    parseTimeValue(
                        b.start_time
                    );

                const bEnd =
                    parseTimeValue(
                        b.end_time
                    );

                if (
                    !(end <= bStart || start >= bEnd)
                ) {
                    return false;
                }
            }
        }

        /**
         * SAFE TEACHER AVAILABILITY
         */
        const teacherSched = Array.isArray(
            overrides?.[teacherId]
        )
            ? overrides[teacherId]
            : Array.isArray(teacher.availability)
                ? teacher.availability
                : [];

        const hasAvailability =
            teacherSched.some((s: any) => {
                if (!s?.day || !s?.time) {
                    return false;
                }

                if (
                    s.day.toLowerCase() !==
                    day.toLowerCase()
                ) {
                    return false;
                }

                const range =
                    parseTimeRange(s.time);

                return (
                    start >= range.start &&
                    end <= range.end
                );
            });

        const isFT =
            teacher.employment_type === "FT" ||
            teacher.employment_type === "PTFL";

        const isSaturday =
            day === "Saturday";

        if (
            !hasAvailability &&
            (!isFT || isSaturday)
        ) {
            return false;
        }

        for (const entry of results) {
            if (entry.day === day) {
                const overlap = !(
                    end <= entry.start ||
                    start >= entry.end
                );

                if (overlap) {
                    if (
                        entry.roomId === roomId ||
                        entry.teacherId === teacherId ||
                        entry.sectionId === sectionId
                    ) {
                        return false;
                    }
                }
            }
        }

        return true;
    };

    const shuffledAssignments =
        shuffleArray(sectionAssignments);

    for (const assignment of shuffledAssignments) {
        for (const comp of assignment.components) {
            let remainingMinutes =
                comp.minutes;

            if (remainingMinutes <= 0) {
                continue;
            }

            let attempts = 0;
            const maxAttempts = 50;

            while (
                remainingMinutes > 0 &&
                attempts < maxAttempts
                ) {
                const sessionMinutes =
                    getOptimalSessionDuration(
                        remainingMinutes
                    );

                let placed = false;

                const shuffledDays =
                    shuffleArray(DAYS);

                let eligibleRooms =
                    allRooms.filter(
                        r =>
                            r.room_type ===
                            comp.roomType
                    );

                if (
                    eligibleRooms.length === 0
                ) {
                    eligibleRooms =
                        allRooms.filter(
                            r =>
                                r.room_type ===
                                "Lecture"
                        );

                    logPlacementIssue(
                        "No rooms of type found, using Lecture rooms",
                        {
                            requestedType:
                            comp.roomType
                        }
                    );
                }

                if (
                    eligibleRooms.length === 0
                ) {
                    eligibleRooms =
                        allRooms;
                }

                const shuffledRooms =
                    shuffleArray(
                        eligibleRooms
                    );

                for (const day of shuffledDays) {
                    if (placed) break;

                    for (const room of shuffledRooms) {
                        if (placed) break;

                        for (
                            let time =
                                START_LIMIT;
                            time <=
                            END_LIMIT -
                            sessionMinutes;
                            time += SLOT_SIZE
                        ) {
                            const additionalUnits =
                                sessionMinutes / 60;

                            if (
                                isAvailable(
                                    day,
                                    time,
                                    time +
                                    sessionMinutes,
                                    room.room_id.toString(),
                                    assignment.teacherId,
                                    assignment.sectionId,
                                    additionalUnits
                                )
                            ) {
                                results.push({
                                    subjectId:
                                    assignment
                                        .subject
                                        .course_code,
                                    teacherId:
                                    assignment.teacherId,
                                    roomId:
                                        room.room_id.toString(),
                                    sectionId:
                                    assignment.sectionId,
                                    day,
                                    start: time,
                                    end:
                                        time +
                                        sessionMinutes
                                });

                                teacherLoad[
                                    assignment.teacherId
                                    ] =
                                    (teacherLoad[
                                        assignment.teacherId
                                        ] || 0) +
                                    sessionMinutes /
                                    60;

                                if (
                                    !sectionDays[
                                        assignment.sectionId
                                        ]
                                ) {
                                    sectionDays[
                                        assignment.sectionId
                                        ] =
                                        new Set();
                                }

                                sectionDays[
                                    assignment.sectionId
                                    ].add(day);

                                placed = true;

                                remainingMinutes -=
                                    sessionMinutes;

                                break;
                            }
                        }
                    }
                }

                if (!placed) {
                    attempts++;

                    logPlacementIssue(
                        "Failed to place session with pre-assigned teacher",
                        {
                            subject:
                            assignment
                                .subject
                                .course_code,
                            teacher:
                            assignment.teacherId,
                            component:
                            comp.type,
                            minutes:
                            sessionMinutes,
                            attempt:
                            attempts,
                            remainingMinutes
                        }
                    );
                }
            }
        }
    }

    console.log(
        `[SCHEDULER] Generated ${results.length} entries`
    );

    return results;
}