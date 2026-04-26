import { 
    fetchAllSubjects, fetchAllTeachers, getAllProgramsData, 
    getAllRoomsData, fetchBreakPeriods, fetchSystemSettings 
} from "@/services/userService";

/* ================= TYPES ================= */

type TimeSlot = {
    start: number; // minutes from midnight
    end: number;
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

function parseTimeValue(timeStr: string): number {
    if (!timeStr) return 0;
    if (timeStr.includes(':') && !timeStr.includes(' ')) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }
    const [time, ampm] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + (minutes || 0);
}

function parseTimeRange(timeStr: string): TimeSlot {
    const parts = timeStr.split('-').map(p => p.trim());
    if (parts.length !== 2) return { start: 0, end: 0 };
    return { start: parseTimeValue(parts[0]), end: parseTimeValue(parts[1]) };
}

/* ================= ENGINE ================= */

export async function generateScheduleData(config: any) {
    const { subjects: selectedIds, sections: selectedProgramCodes, assignments, overrides, semester, mergeLecLab = {} } = config;

    const currentSemester = parseInt(semester || "1");

    // 1. Fetch All Data
    const [allSubjects, allTeachers, allPrograms, allRooms, breakPeriods, systemSettings] = await Promise.all([
        fetchAllSubjects(),
        fetchAllTeachers(),
        getAllProgramsData(),
        getAllRoomsData(),
        fetchBreakPeriods(),
        fetchSystemSettings()
    ]);

    // 2. Prepare Constraints
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const START_LIMIT = parseTimeValue(systemSettings.startTime || "7:00 AM");
    const END_LIMIT = parseTimeValue(systemSettings.endTime || "8:00 PM");
    const MAX_STUDENTS_PER_SECTION = Number(systemSettings.maxStudents || 40);
    const SLOT_SIZE = 30;

    const activeSubjects = allSubjects.filter(s => selectedIds.includes(s.id));
    const activePrograms = allPrograms.filter(p => selectedProgramCodes.includes(p.program_code));

    // 3. Generate Virtual Sections
    const virtualSections: { id: string, programCode: string, year: string }[] = [];
    for (const program of activePrograms) {
        const yearLevels = program.students || {};
        for (const [year, count] of Object.entries(yearLevels)) {
            const yearNum = parseInt(year);
            const numSections = Math.ceil(Number(count) / MAX_STUDENTS_PER_SECTION);
            let firstDigit = 0;
            if (program.level === "SHS") firstDigit = (yearNum === 11) ? 1 : 2;
            else firstDigit = (yearNum - 1) * 2 + currentSemester;

            for (let i = 0; i < numSections; i++) {
                const sectionId = `${program.program_code}${firstDigit}1${i + 1}`;
                virtualSections.push({ id: sectionId, programCode: program.program_code, year: year });
            }
        }
    }

    const results: GeneratedEntry[] = [];
    const teacherLoad: Record<string, number> = {};
    // Tracking unique days used by each section
    const sectionDays: Record<string, Set<string>> = {};

    const isAvailable = (day: string, start: number, end: number, roomId: string, teacherId: string, sectionId: string) => {
        if (start < START_LIMIT || end > END_LIMIT) return false;

        // 5-Day School Week Check
        const daysUsedBySection = sectionDays[sectionId] || new Set();
        if (!daysUsedBySection.has(day) && daysUsedBySection.size >= 5) {
            return false; // Section already at 5 days
        }

        // Mandatory Breaks
        for (const b of breakPeriods) {
            if (b.day_of_week.toLowerCase() === day.toLowerCase()) {
                const bStart = parseTimeValue(b.start_time);
                const bEnd = parseTimeValue(b.end_time);
                if (!(end <= bStart || start >= bEnd)) return false;
            }
        }

        const teacher = allTeachers.find(t => t.pscs_id === teacherId);
        if (!teacher) return false;
        if (day === "Saturday" && teacher.employment_type !== "PT" && teacher.employment_type !== "PTFL") return false;

        const teacherSched = overrides[teacherId] || teacher.availability || [];
        const hasSlot = teacherSched.some((s: any) => {
            if (s.day.toLowerCase() !== day.toLowerCase()) return false;
            const range = parseTimeRange(s.time);
            return (start >= range.start && end <= range.end);
        });
        
        const isFT = teacher.employment_type === "Regular" || teacher.employment_type === "Proby";
        if (!hasSlot && (!isFT || day === "Saturday")) return false;

        // Conflicts
        for (const entry of results) {
            if (entry.day === day) {
                const overlap = !(end <= entry.start || start >= entry.end);
                if (overlap) {
                    if (entry.roomId === roomId || entry.teacherId === teacherId || entry.sectionId === sectionId) return false;
                }
            }
        }
        return true;
    };

    // 4. Main Placement Loop
    for (const vSection of virtualSections) {
        const subjectsForThisYear = activeSubjects.filter(s => {
            if (vSection.year.length > 1) return s.year_term === vSection.year;
            return s.year_term?.startsWith(vSection.year);
        });

        for (const sub of subjectsForThisYear) {
            let teacherId = assignments[sub.id];
            if (!teacherId) {
                const eligible = allTeachers.filter(t => t.specialization?.toLowerCase().includes(sub.field_of_specialization?.toLowerCase() || "none"));
                const candidates = eligible.length > 0 ? eligible : allTeachers;
                candidates.sort((a, b) => (teacherLoad[a.pscs_id] || 0) - (teacherLoad[b.pscs_id] || 0));
                teacherId = candidates[0].pscs_id;
            }

            const shouldMerge = !!mergeLecLab[sub.id];
            const components: { type: string, minutes: number, roomType: string }[] = [];

            if (shouldMerge) {
                const totalMinutes = (Number(sub.lecture_units) + Number(sub.lab_units)) * 60;
                components.push({ type: 'Merged', minutes: totalMinutes, roomType: sub.lab_type || 'Lecture' });
            } else {
                components.push({ type: 'Lab', minutes: Number(sub.lab_units) * 60, roomType: sub.lab_type || 'Lecture' });
                components.push({ type: 'Lecture', minutes: Number(sub.lecture_units) * 60, roomType: 'Lecture' });
            }

            for (const comp of components) {
                let remainingMinutes = comp.minutes;
                while (remainingMinutes > 0) {
                    let sessionMinutes = remainingMinutes;
                    if (remainingMinutes >= 180) sessionMinutes = 120; 

                    let placed = false;
                    const shuffledDays = [...DAYS].sort(() => Math.random() - 0.2);
                    const eligibleRooms = allRooms.filter(r => r.room_type === comp.roomType);
                    const shuffledRooms = [...eligibleRooms].sort(() => Math.random() - 0.5);

                    for (const day of shuffledDays) {
                        if (placed) break;
                        for (const room of shuffledRooms) {
                            if (placed) break;
                            for (let time = START_LIMIT; time <= END_LIMIT - sessionMinutes; time += SLOT_SIZE) {
                                if (isAvailable(day, time, time + sessionMinutes, room.room_id.toString(), teacherId, vSection.id)) {
                                    results.push({
                                        subjectId: sub.course_code,
                                        teacherId,
                                        roomId: room.room_id.toString(),
                                        sectionId: vSection.id,
                                        day, start: time, end: time + sessionMinutes
                                    });
                                    
                                    // Update tracking
                                    teacherLoad[teacherId] = (teacherLoad[teacherId] || 0) + (sessionMinutes / 60);
                                    if (!sectionDays[vSection.id]) sectionDays[vSection.id] = new Set();
                                    sectionDays[vSection.id].add(day);

                                    placed = true;
                                    remainingMinutes -= sessionMinutes;
                                    break;
                                }
                            }
                        }
                    }
                    if (!placed) break;
                }
            }
        }
    }
    return results;
}
