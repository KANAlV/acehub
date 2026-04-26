import { 
    fetchAllSubjects, fetchAllTeachers, getAllProgramsData, 
    getAllRoomsData, fetchBreakPeriods 
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

// Converts "7:30 AM - 5:00 PM" string into minute ranges
function parseTimeRange(timeStr: string): TimeSlot {
    const parts = timeStr.split('-').map(p => p.trim());
    if (parts.length !== 2) return { start: 0, end: 0 };

    const parsePart = (p: string) => {
        const [time, ampm] = p.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + (minutes || 0);
    };

    return { start: parsePart(parts[0]), end: parsePart(parts[1]) };
}

/* ================= ENGINE ================= */

export async function generateScheduleData(config: any) {
    const { subjects: selectedIds, sections: selectedSectionIds, assignments, overrides } = config;

    // 1. Fetch All Data
    const [allSubjects, allTeachers, allPrograms, allRooms, mandatoryBreaks] = await Promise.all([
        fetchAllSubjects(),
        fetchAllTeachers(),
        getAllProgramsData(),
        getAllRoomsData(),
        fetchBreakPeriods()
    ]);

    // 2. Prepare Constraints
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const START_LIMIT = 7 * 60; // 7:00 AM
    const END_LIMIT = 20 * 60;  // 8:00 PM
    const SLOT_SIZE = 30;       // 30-minute granularity

    // Filter active entities
    const activeSubjects = allSubjects.filter(s => selectedIds.includes(s.id));
    const activePrograms = allPrograms.filter(p => selectedSectionIds.includes(p.program_code));

    // 3. Initialize Schedule Result
    const results: GeneratedEntry[] = [];

    // Helper to check if a block is free
    const isAvailable = (day: string, start: number, end: number, roomId: string, teacherId: string, sectionId: string) => {
        // Limit Check
        if (start < START_LIMIT || end > END_LIMIT) return false;

        // Mandatory Breaks Check
        for (const b of mandatoryBreaks) {
            if (b.day_of_week.toLowerCase() === day.toLowerCase()) {
                const bRange = parseTimeRange(b.start_time + " - " + b.end_time);
                if (!(end <= bRange.start || start >= bRange.end)) return false;
            }
        }

        // Teacher Availability & Saturday Rule
        const teacher = allTeachers.find(t => t.pscs_id === teacherId);
        if (!teacher) return false;

        if (day === "Saturday") {
            if (teacher.employment_type !== "PT" && teacher.employment_type !== "PTFL") return false;
        }

        // Use Override if exists, otherwise global
        const teacherSched = overrides[teacherId] || teacher.availability || [];
        const hasSlot = teacherSched.some((s: any) => {
            if (s.day.toLowerCase() !== day.toLowerCase()) return false;
            const range = parseTimeRange(s.time);
            return (start >= range.start && end <= range.end);
        });
        
        // Full-time teachers (Regular/Proby) are assumed available Mon-Fri if no override
        const isFT = teacher.employment_type === "Regular" || teacher.employment_type === "Proby";
        if (!hasSlot && (!isFT || day === "Saturday")) return false;

        // Conflict Check with existing results
        for (const entry of results) {
            if (entry.day === day) {
                const overlap = !(end <= entry.start || start >= entry.end);
                if (overlap) {
                    if (entry.roomId === roomId || entry.teacherId === teacherId || entry.sectionId === sectionId) {
                        return false;
                    }
                }
            }
        }

        return true;
    };

    // 4. Generation Algorithm (Greedy Randomized)
    // We iterate through sections, then subjects needed for those sections
    for (const program of activePrograms) {
        // A program can have multiple year-level "sections"
        const yearLevels = Object.keys(program.students || {});

        for (const year of yearLevels) {
            const sectionLabel = `${program.program_code}-${year}`;
            
            // Find subjects matching this year level
            // We match based on the first character of year_term (e.g. '1-1' matches year '1', '11' matches '11')
            const subjectsForThisSection = activeSubjects.filter(s => {
                if (year.length > 1) return s.year_term === year;
                return s.year_term?.startsWith(year);
            });

            for (const sub of subjectsForThisSection) {
                // Determine Teacher
                let teacherId = assignments[sub.course_code];
                if (!teacherId) {
                    // Find any teacher matching specialization
                    const eligible = allTeachers.filter(t => t.specialization?.includes(sub.field_of_specialization));
                    if (eligible.length > 0) {
                        teacherId = eligible[Math.floor(Math.random() * eligible.length)].pscs_id;
                    } else {
                        // Fallback to any teacher if no spec found
                        teacherId = allTeachers[Math.floor(Math.random() * allTeachers.length)].pscs_id;
                    }
                }

                // Determine Duration
                const duration = (Number(sub.lecture_units) + Number(sub.lab_units)) * 60;
                
                // Attempt to place in a room/time
                let placed = false;
                const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
                const shuffledRooms = [...allRooms].sort(() => Math.random() - 0.5);

                for (const day of shuffledDays) {
                    if (placed) break;
                    for (const room of shuffledRooms) {
                        if (placed) break;

                        // Try starting at every 30 min slot
                        for (let time = START_LIMIT; time <= END_LIMIT - duration; time += SLOT_SIZE) {
                            if (isAvailable(day, time, time + duration, room.room_id.toString(), teacherId, sectionLabel)) {
                                results.push({
                                    subjectId: sub.course_code,
                                    teacherId,
                                    roomId: room.room_id.toString(),
                                    sectionId: sectionLabel,
                                    day,
                                    start: time,
                                    end: time + duration
                                });
                                placed = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    return results;
}
