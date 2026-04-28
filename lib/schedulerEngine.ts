import { 
    fetchAllSubjects, fetchAllTeachers, getAllProgramsData, 
    getAllRoomsData, fetchBreakPeriods, fetchSystemSettings 
} from "@/services/userService";

/* ================= TYPES ================= */

type TimeSlot = {
    start: number; // minutes from midnight
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
    const { subjects: selectedIds, assignments, overrides, semester, mergeLecLab = {} } = config;

    const currentSemester = parseInt(semester || "1");

    // 1. Fetch All Data
    const [allSubjects, allTeachers, allPrograms, allRoomsData, breakPeriods, systemSettings] = await Promise.all([
        fetchAllSubjects(),
        fetchAllTeachers(),
        getAllProgramsData(),
        getAllRoomsData(),
        fetchBreakPeriods(),
        fetchSystemSettings()
    ]);
    
    const allRooms: Room[] = allRoomsData;

    // 2. Prepare Constraints
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const START_LIMIT = parseTimeValue(systemSettings.startTime || "7:00 AM");
    const END_LIMIT = parseTimeValue(systemSettings.endTime || "8:00 PM");
    const MAX_STUDENTS_PER_SECTION = Number(systemSettings.maxStudents || 40);
    const SLOT_SIZE = 30;

    const activeSubjects = allSubjects.filter(s => selectedIds.includes(s.id));
    const activePrograms = allPrograms; // Use all programs with students

    // 3. Generate Virtual Sections with proper naming
    const virtualSections: { id: string, programCode: string, year: string, targetYearTerm: string, level: string }[] = [];
    for (const program of activePrograms) {
        const yearLevels = program.students || {};
        for (const [year, count] of Object.entries(yearLevels)) {
            const yearNum = parseInt(year);
            const numSections = Math.ceil(Number(count) / MAX_STUDENTS_PER_SECTION);

            let firstDigit = 0;
            let targetYearTerm = "";

            if (program.level === "SHS") {
                firstDigit = (yearNum === 11) ? 1 : 2;
                targetYearTerm = yearNum.toString(); // "11" or "12"
            } else {
                firstDigit = (yearNum - 1) * 2 + currentSemester;
                targetYearTerm = `${yearNum}-${currentSemester}`; // e.g. "1-1", "1-2"
            }

            for (let i = 0; i < numSections; i++) {
                const sectionId = `${program.program_code}${firstDigit}1${i + 1}`;
                virtualSections.push({ 
                    id: sectionId, 
                    programCode: program.program_code, 
                    year: year,
                    targetYearTerm: targetYearTerm,
                    level: program.level
                });
            }
        }
    }

    const results: GeneratedEntry[] = [];
    const teacherLoad: Record<string, number> = {};
    const sectionDays: Record<string, Set<string>> = {};

    // 4. Assign Subjects to Sections with Teachers First
    const sectionAssignments: { 
        sectionId: string, 
        subject: any, 
        teacherId: string,
        components: { type: string, minutes: number, roomType: string }[] 
    }[] = [];
    
    for (const vSection of virtualSections) {
        // Filter subjects by year_term and curriculum match
        const subjectsForThisSection = activeSubjects.filter(s => {
            const yearMatch = s.year_term === vSection.targetYearTerm;
            const curriculumMatch = s.curriculumn_version?.includes(vSection.programCode);
            return yearMatch && curriculumMatch;
        });

        for (const sub of subjectsForThisSection) {
            // Assign teacher first
            let teacherId = assignments[sub.id];
            if (!teacherId) {
                // More flexible teacher matching for both SHS and College
                const eligible = allTeachers.filter(t => {
                    const spec = (t.specialization || "").toLowerCase();
                    const field = (sub.field_of_specialization || "").toLowerCase();
                    
                    // Exact specialization match
                    if (spec.includes(field) && field !== "none" && spec !== "none") return true;
                    
                    // For subjects with no specialization or "none", any teacher can teach
                    if (field === "none" || spec === "none") return true;
                    
                    // For SHS subjects, be more flexible with teacher matching
                    if (vSection.level === "SHS") {
                        // Check if teacher can handle SHS level
                        return spec.includes("shs") || spec.includes("senior") || spec === "none";
                    }
                    
                    // For College subjects, check curriculum compatibility
                    if (vSection.level !== "SHS") {
                        return spec.includes(field) || field === "none" || spec === "none";
                    }
                    
                    return false;
                });
                
                const candidates = eligible.length > 0 ? eligible : allTeachers;
                
                // Sort by current load but add randomness to distribute better
                candidates.sort((a, b) => {
                    const loadA = teacherLoad[a.pscs_id] || 0;
                    const loadB = teacherLoad[b.pscs_id] || 0;
                    
                    // If loads are very similar, add randomness
                    if (Math.abs(loadA - loadB) < 2) {
                        return Math.random() - 0.5;
                    }
                    
                    return loadA - loadB;
                });
                
                if (candidates.length > 0) {
                    teacherId = candidates[0].pscs_id;
                    // Update teacher load immediately to prevent same teacher getting too many assignments
                    teacherLoad[teacherId] = (teacherLoad[teacherId] || 0) + 1;
                } else {
                    logPlacementIssue('No teachers available for subject', { 
                        subject: sub.course_code, 
                        specialization: sub.field_of_specialization,
                        sectionLevel: vSection.level,
                        eligibleCount: eligible.length
                    });
                    continue;
                }
            }

            const shouldMerge = !!mergeLecLab[sub.id];
            const components: { type: string, minutes: number, roomType: string }[] = [];

            if (shouldMerge) {
                const totalMinutes = (Number(sub.lecture_units) + Number(sub.lab_units)) * 60;
                components.push({ type: 'Merged', minutes: totalMinutes, roomType: sub.lab_type || 'Lecture' });
            } else {
                if (Number(sub.lab_units) > 0) {
                    components.push({ type: 'Lab', minutes: Number(sub.lab_units) * 60, roomType: sub.lab_type || 'Laboratory' });
                }
                if (Number(sub.lecture_units) > 0) {
                    components.push({ type: 'Lecture', minutes: Number(sub.lecture_units) * 60, roomType: 'Lecture' });
                }
            }

            sectionAssignments.push({
                sectionId: vSection.id,
                subject: sub,
                teacherId: teacherId,
                components: components
            });
        }
    }

    // 5. Schedule Pre-Assigned Teacher-Subject Combinations to Timetable
    const isAvailable = (day: string, start: number, end: number, roomId: string, teacherId: string, sectionId: string) => {
        if (start < START_LIMIT || end > END_LIMIT) return false;

        // 5-Day School Week Check
        const daysUsedBySection = sectionDays[sectionId] || new Set();
        if (!daysUsedBySection.has(day) && daysUsedBySection.size >= 5) return false;

        // Mandatory Breaks
        for (const b of breakPeriods) {
            if (b.day_of_week.toLowerCase() === day.toLowerCase()) {
                const bStart = parseTimeValue(b.start_time);
                const bEnd = parseTimeValue(b.end_time);
                if (!(end <= bStart || start >= bEnd)) return false;
            }
        }

        // Teacher availability check
        const teacher = allTeachers.find(t => t.pscs_id === teacherId);
        if (!teacher) return false;
        
        const teacherSched = overrides[teacherId] || teacher.availability || [];
        const hasAvailability = teacherSched.some((s: any) => {
            if (s.day.toLowerCase() !== day.toLowerCase()) return false;
            const range = parseTimeRange(s.time);
            return (start >= range.start && end <= range.end);
        });

        const isFT = teacher.employment_type === "Regular" || teacher.employment_type === "Proby";
        const isSaturday = day === "Saturday";
        
        if (!hasAvailability && (!isFT || isSaturday)) return false;

        // Check for conflicts with existing results
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

    // Schedule all assignments with pre-assigned teachers
    const shuffledAssignments = shuffleArray(sectionAssignments);
    
    for (const assignment of shuffledAssignments) {
        for (const comp of assignment.components) {
            let remainingMinutes = comp.minutes;
            if (remainingMinutes <= 0) continue;

            let attempts = 0;
            const maxAttempts = 50;

            while (remainingMinutes > 0 && attempts < maxAttempts) {
                const sessionMinutes = getOptimalSessionDuration(remainingMinutes);
                
                let placed = false;
                const shuffledDays = shuffleArray(DAYS);
                
                // Get eligible rooms with fallback
                let eligibleRooms = allRooms.filter(r => r.room_type === comp.roomType);
                if (eligibleRooms.length === 0) {
                    eligibleRooms = allRooms.filter(r => r.room_type === 'Lecture');
                    logPlacementIssue('No rooms of type found, using Lecture rooms', { 
                        requestedType: comp.roomType, 
                        fallbackCount: eligibleRooms.length 
                    });
                }
                if (eligibleRooms.length === 0) {
                    eligibleRooms = allRooms;
                    logPlacementIssue('No Lecture rooms found, using all rooms', { 
                        totalRooms: eligibleRooms.length 
                    });
                }
                
                const shuffledRooms = shuffleArray(eligibleRooms);

                for (const day of shuffledDays) {
                    if (placed) break;
                    for (const room of shuffledRooms) {
                        if (placed) break;
                        for (let time = START_LIMIT; time <= END_LIMIT - sessionMinutes; time += SLOT_SIZE) {
                            if (isAvailable(day, time, time + sessionMinutes, room.room_id.toString(), assignment.teacherId, assignment.sectionId)) {
                                results.push({
                                    subjectId: assignment.subject.course_code,
                                    teacherId: assignment.teacherId,
                                    roomId: room.room_id.toString(),
                                    sectionId: assignment.sectionId,
                                    day, 
                                    start: time, 
                                    end: time + sessionMinutes
                                });
                                
                                teacherLoad[assignment.teacherId] = (teacherLoad[assignment.teacherId] || 0) + (sessionMinutes / 60);
                                if (!sectionDays[assignment.sectionId]) sectionDays[assignment.sectionId] = new Set();
                                sectionDays[assignment.sectionId].add(day);

                                placed = true;
                                remainingMinutes -= sessionMinutes;
                                break;
                            }
                        }
                    }
                }
                
                if (!placed) {
                    attempts++;
                    logPlacementIssue('Failed to place session with pre-assigned teacher', {
                        subject: assignment.subject.course_code,
                        teacher: assignment.teacherId,
                        component: comp.type,
                        minutes: sessionMinutes,
                        attempt: attempts,
                        remainingMinutes
                    });
                    
                    // Try with smaller session size on retry
                    if (attempts > 5 && sessionMinutes > 60) {
                        remainingMinutes = Math.min(remainingMinutes, 60);
                    }
                    
                    if (attempts >= maxAttempts) {
                        logPlacementIssue('Max attempts reached, skipping component', {
                            subject: assignment.subject.course_code,
                            teacher: assignment.teacherId,
                            component: comp.type,
                            remainingMinutes
                        });
                    }
                }
            }
        }
    }
    
    // Log final statistics
    console.log(`[SCHEDULER] Generated ${results.length} entries for ${virtualSections.length} sections`);
    
    return results;
}
