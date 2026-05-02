import { 
    fetchAllSubjects, fetchAllTeachers, getAllProgramsData, 
    getAllRoomsData, fetchBreakPeriods, fetchSystemSettings 
} from "@/services/userService";
import { getMaxUnitsSync, getOverloadMaxSync, getPrepLimitSync } from "@/lib/teachingLoadUtils";

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
    const teacherSubjects: Record<string, Set<string>> = {};
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
                
                // Sort by current load and subject count, considering new constraints
                candidates.sort((a, b) => {
                    const loadA = teacherLoad[a.pscs_id] || 0;
                    const loadB = teacherLoad[b.pscs_id] || 0;
                    const subjectCountA = teacherSubjects[a.pscs_id]?.size || 0;
                    const subjectCountB = teacherSubjects[b.pscs_id]?.size || 0;
                    
                    // Get teacher constraints
                    const maxUnitsA = getMaxUnitsSync(a.employment_type, systemSettings);
                    const maxUnitsB = getMaxUnitsSync(b.employment_type, systemSettings);
                    const overloadMax = getOverloadMaxSync(systemSettings);
                    const absoluteMaxA = maxUnitsA + overloadMax;
                    const absoluteMaxB = maxUnitsB + overloadMax;
                    const prepLimitA = getPrepLimitSync(a.employment_type, systemSettings);
                    const prepLimitB = getPrepLimitSync(b.employment_type, systemSettings);
                    
                    // Filter out teachers who would exceed constraints
                    if (loadA >= absoluteMaxA && loadB < absoluteMaxB) return 1;
                    if (loadB >= absoluteMaxB && loadA < absoluteMaxA) return -1;
                    if (subjectCountA >= prepLimitA && subjectCountB < prepLimitB) return 1;
                    if (subjectCountB >= prepLimitB && subjectCountA < prepLimitA) return -1;
                    
                    // If loads are very similar, add randomness
                    if (Math.abs(loadA - loadB) < 2 && Math.abs(subjectCountA - subjectCountB) < 1) {
                        return Math.random() - 0.5;
                    }
                    
                    // Prioritize teachers with lower load percentage
                    const loadPercentA = maxUnitsA > 0 ? (loadA / maxUnitsA) * 100 : 0;
                    const loadPercentB = maxUnitsB > 0 ? (loadB / maxUnitsB) * 100 : 0;
                    
                    return loadPercentA - loadPercentB;
                });
                
                if (candidates.length > 0) {
                    teacherId = candidates[0].pscs_id;
                    // Update teacher load and add subject to their set
                    teacherLoad[teacherId] = (teacherLoad[teacherId] || 0) + 1;
                    if (!teacherSubjects[teacherId]) {
                        teacherSubjects[teacherId] = new Set();
                    }
                    teacherSubjects[teacherId].add(sub.id);
                } else {
                    logPlacementIssue('No teachers available for subject', { 
                        subject: sub.course_code, 
                        specialization: sub.field_of_specialization,
                        sectionLevel: vSection.level,
                        eligibleCount: eligible.length,
                        reason: 'All teachers either at prep limit or overload capacity'
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
    const isAvailable = (day: string, start: number, end: number, roomId: string, teacherId: string, sectionId: string, additionalUnits: number = 0) => {
        if (start < START_LIMIT || end > END_LIMIT) return false;

        // Check teacher load constraints
        const teacher = allTeachers.find(t => t.pscs_id === teacherId);
        if (teacher) {
            const currentLoad = teacherLoad[teacherId] || 0;
            const maxUnits = getMaxUnitsSync(teacher.employment_type, systemSettings);
            const overloadMax = getOverloadMaxSync(systemSettings);
            const absoluteMax = maxUnits + overloadMax;
            
            // Check if adding this session would exceed absolute max
            if (currentLoad + additionalUnits > absoluteMax) {
                return false;
            }
        }

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
        if (!teacher) return false;
        
        const teacherSched = overrides[teacherId] || teacher.availability || [];
        const hasAvailability = teacherSched.some((s: any) => {
            if (s.day.toLowerCase() !== day.toLowerCase()) return false;
            const range = parseTimeRange(s.time);
            return (start >= range.start && end <= range.end);
        });

        const isFT = teacher.employment_type === "FT" ||
                     teacher.employment_type === "PTFL";
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
                            const additionalUnits = sessionMinutes / 60;
                            if (isAvailable(day, time, time + sessionMinutes, room.room_id.toString(), assignment.teacherId, assignment.sectionId, additionalUnits)) {
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
                    const teacher = allTeachers.find(t => t.pscs_id === assignment.teacherId);
                    const currentLoad = teacherLoad[assignment.teacherId] || 0;
                    const maxUnits = teacher ? getMaxUnitsSync(teacher.employment_type, systemSettings) : 24;
                    const overloadMax = getOverloadMaxSync(systemSettings);
                    const absoluteMax = maxUnits + overloadMax;
                    const subjectCount = teacherSubjects[assignment.teacherId]?.size || 0;
                    const prepLimit = teacher ? getPrepLimitSync(teacher.employment_type, systemSettings) : 6;
                    
                    logPlacementIssue('Failed to place session with pre-assigned teacher', {
                        subject: assignment.subject.course_code,
                        teacher: assignment.teacherId,
                        component: comp.type,
                        minutes: sessionMinutes,
                        attempt: attempts,
                        remainingMinutes,
                        teacherLoad: `${currentLoad}/${absoluteMax} (${Math.round((currentLoad/absoluteMax)*100)}%)`,
                        subjectCount: `${subjectCount}/${prepLimit}`,
                        overloadEnabled: overloadMax > 0
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
                            remainingMinutes,
                            finalLoad: `${currentLoad}/${absoluteMax}`,
                            finalSubjectCount: `${subjectCount}/${prepLimit}`
                        });
                    }
                }
            }
        }
    }
    
    // Log final statistics with new constraints
    const teacherStats = Object.keys(teacherLoad).map(teacherId => {
        const teacher = allTeachers.find(t => t.pscs_id === teacherId);
        const load = teacherLoad[teacherId] || 0;
        const subjectCount = teacherSubjects[teacherId]?.size || 0;
        const maxUnits = teacher ? getMaxUnitsSync(teacher.employment_type, systemSettings) : 24;
        const overloadMax = getOverloadMaxSync(systemSettings);
        const absoluteMax = maxUnits + overloadMax;
        const prepLimit = teacher ? getPrepLimitSync(teacher.employment_type, systemSettings) : 6;
        
        return {
            teacherId,
            name: teacher?.name || 'Unknown',
            employmentType: teacher?.employment_type || 'Unknown',
            load: `${load}/${absoluteMax}`,
            loadPercent: Math.round((load/absoluteMax)*100),
            subjects: `${subjectCount}/${prepLimit}`,
            isOverloaded: load > maxUnits,
            isAtAbsoluteMax: load >= absoluteMax
        };
    });
    
    const overloadedTeachers = teacherStats.filter(t => t.isOverloaded);
    const atAbsoluteMaxTeachers = teacherStats.filter(t => t.isAtAbsoluteMax);
    const atPrepLimitTeachers = teacherStats.filter(t => parseInt(t.subjects.split('/')[0]) >= parseInt(t.subjects.split('/')[1]));
    
    console.log(`[SCHEDULER] Generated ${results.length} entries for ${virtualSections.length} sections`);
    console.log(`[SCHEDULER] Teacher Load Summary:`);
    console.log(`  - Total teachers used: ${teacherStats.length}`);
    console.log(`  - Overloaded teachers: ${overloadedTeachers.length}`);
    console.log(`  - Teachers at absolute max: ${atAbsoluteMaxTeachers.length}`);
    console.log(`  - Teachers at prep limit: ${atPrepLimitTeachers.length}`);
    console.log(`  - Overload max setting: ${getOverloadMaxSync(systemSettings)} units`);
    
    if (overloadedTeachers.length > 0) {
        console.log(`[SCHEDULER] Overloaded Teachers:`, overloadedTeachers.map(t => `${t.name} (${t.load})`));
    }
    
    if (atPrepLimitTeachers.length > 0) {
        console.log(`[SCHEDULER] Teachers at Prep Limit:`, atPrepLimitTeachers.map(t => `${t.name} (${t.subjects})`));
    }
    
    return results;
}
