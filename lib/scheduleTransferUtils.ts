import { getMaxUnitsSync, getOverloadMaxSync, getPrepLimitSync } from "@/lib/teachingLoadUtils";

export type ScheduleBlock = {
    id: string;
    subjectId: string;
    teacherId: string;
    roomId: string;
    sectionId: string;
    day: string;
    start: number;
    end: number;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT = 30;

function parseTimeValue(timeStr: string): number {
    if (!timeStr) return 0;
    if (timeStr.includes(":") && !timeStr.includes(" ")) {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    }
    const [time, ampm] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + (minutes || 0);
}

function parseTimeRange(timeStr: string): { start: number; end: number } {
    const parts = timeStr.split("-").map((p) => p.trim());
    if (parts.length !== 2) return { start: 0, end: 0 };
    return { start: parseTimeValue(parts[0]), end: parseTimeValue(parts[1]) };
}

export function stableEntryId(row: any, index: number): string {
    if (row.id != null && row.id !== "") return String(row.id);
    return `synth:${row.teacher_id}|${row.subject_id}|${row.section_id}|${row.day}|${row.start_time}|${row.end_time}|${row.room_id}|${index}`;
}

export function mapRowToBlock(row: any, index: number): ScheduleBlock {
    return {
        id: stableEntryId(row, index),
        subjectId: String(row.subject_id),
        teacherId: String(row.teacher_id),
        roomId: String(row.room_id),
        sectionId: String(row.section_id),
        day: String(row.day),
        start: Number(row.start_time),
        end: Number(row.end_time),
    };
}

export function blocksToPayload(blocks: ScheduleBlock[]) {
    return blocks.map((b) => ({
        subjectId: b.subjectId,
        teacherId: b.teacherId,
        roomId: b.roomId,
        sectionId: b.sectionId,
        day: b.day,
        start: b.start,
        end: b.end,
    }));
}

function overlaps(a: { day: string; start: number; end: number }, b: { day: string; start: number; end: number }) {
    return a.day === b.day && !(a.end <= b.start || a.start >= b.end);
}

/** Same rules as timetable editor: overlap + (same room OR same teacher OR same section). */
export function conflictsWithOthers(candidate: ScheduleBlock, others: ScheduleBlock[], skipIds: Set<string>): boolean {
    for (const s of others) {
        if (skipIds.has(s.id)) continue;
        if (!overlaps(s, candidate)) continue;
        if (s.roomId === candidate.roomId || s.teacherId === candidate.teacherId || s.sectionId === candidate.sectionId) {
            return true;
        }
    }
    return false;
}

function breaksOverlap(day: string, start: number, end: number, breaks: any[]): boolean {
    for (const b of breaks) {
        if (String(b.day_of_week).toLowerCase() !== day.toLowerCase()) continue;
        const bStart = parseTimeValue(b.start_time);
        const bEnd = parseTimeValue(b.end_time);
        if (!(end <= bStart || start >= bEnd)) return true;
    }
    return false;
}

function teacherSlotAllowed(teacher: any, day: string, start: number, end: number): boolean {
    if (!teacher) return false;
    const teacherSched = teacher.availability || [];
    const hasAvailability = teacherSched.some((s: any) => {
        if (String(s.day).toLowerCase() !== day.toLowerCase()) return false;
        const range = parseTimeRange(s.time);
        return start >= range.start && end <= range.end;
    });
    const et = String(teacher.employment_type || "").toLowerCase();
    const isFT =
        et === "ft" ||
        et === "ptfl" ||
        et === "regular" ||
        et === "full-time" ||
        et === "fulltime";
    const isSaturday = day === "Saturday";
    if (!hasAvailability && (!isFT || isSaturday)) return false;
    return true;
}

function sectionFifthDayOk(sectionId: string, day: string, ctx: ScheduleBlock[]): boolean {
    const days = new Set<string>();
    for (const b of ctx) {
        if (b.sectionId !== sectionId) continue;
        days.add(b.day);
    }
    if (days.has(day)) return true;
    return days.size < 5;
}

function orderedRoomIds(originalRoomId: string, rooms: any[]): string[] {
    if (!rooms?.length) return [String(originalRoomId)];
    const orig = rooms.find((r) => String(r.room_id) === String(originalRoomId));
    const origType = orig?.room_type || "Lecture";
    const sameType = rooms.filter((r) => r.room_type === origType).map((r) => String(r.room_id));
    const lecture = rooms.filter((r) => r.room_type === "Lecture").map((r) => String(r.room_id));
    const rest = rooms.map((r) => String(r.room_id));
    const ordered: string[] = [];
    const push = (id: string) => {
        if (!ordered.includes(id)) ordered.push(id);
    };
    push(String(originalRoomId));
    sameType.forEach(push);
    lecture.forEach(push);
    rest.forEach(push);
    return ordered;
}

function orderedDays(preferredDay: string): string[] {
    const idx = DAYS.indexOf(preferredDay);
    if (idx < 0) return [...DAYS];
    const dist: { d: string; k: number }[] = DAYS.map((d, i) => ({
        d,
        k: Math.min(Math.abs(i - idx), 6 - Math.abs(i - idx)),
    }));
    dist.sort((a, b) => a.k - b.k || DAYS.indexOf(a.d) - DAYS.indexOf(b.d));
    return dist.map((x) => x.d);
}

function orderedStartsForDay(
    preferredStart: number,
    duration: number,
    startLimit: number,
    endLimit: number
): number[] {
    const maxStart = endLimit - duration;
    const list: number[] = [];
    for (let s = startLimit; s <= maxStart; s += SLOT) list.push(s);
    list.sort((a, b) => Math.abs(a - preferredStart) - Math.abs(b - preferredStart));
    return list;
}

function findPlacementForBlock(
    orig: ScheduleBlock,
    newTeacherId: string,
    recipientTeacher: any,
    ctx: ScheduleBlock[],
    breaks: any[],
    startLimit: number,
    endLimit: number,
    rooms: any[]
): ScheduleBlock | null {
    const duration = orig.end - orig.start;
    if (duration <= 0) return null;

    const tryCandidate = (day: string, start: number, roomId: string): ScheduleBlock | null => {
        const end = start + duration;
        if (start < startLimit || end > endLimit) return null;
        if (breaksOverlap(day, start, end, breaks)) return null;
        if (!teacherSlotAllowed(recipientTeacher, day, start, end)) return null;
        if (!sectionFifthDayOk(orig.sectionId, day, ctx)) return null;
        const cand: ScheduleBlock = {
            ...orig,
            id: orig.id,
            teacherId: newTeacherId,
            day,
            start,
            end,
            roomId,
        };
        if (conflictsWithOthers(cand, ctx, new Set())) return null;
        return cand;
    };

    const dayOrder = orderedDays(orig.day);
    const roomOrder = orderedRoomIds(orig.roomId, rooms);

    for (const day of dayOrder) {
        const starts = orderedStartsForDay(orig.start, duration, startLimit, endLimit);
        for (const start of starts) {
            for (const roomId of roomOrder) {
                const placed = tryCandidate(day, start, roomId);
                if (placed) return placed;
            }
        }
    }
    return null;
}

export type TransferSubjectSectionParams = {
    allRows: any[];
    fromTeacherId: string;
    subjectId: string;
    sectionId: string;
    toTeacherId: string;
    recipientTeacher: any;
    rooms: any[];
    breaks: any[];
    systemSettings: any;
};

export type TransferSubjectSectionResult =
    | { ok: true; blocks: ScheduleBlock[] }
    | { ok: false; message: string };

/**
 * Moves every schedule row for fromTeacherId + subjectId + sectionId onto toTeacherId.
 * If the recipient conflicts at the original times, searches nearby times/days/rooms (scheduler-style rules).
 */
export function transferSubjectSectionForTeacher(params: TransferSubjectSectionParams): TransferSubjectSectionResult {
    const {
        allRows,
        fromTeacherId,
        subjectId,
        sectionId,
        toTeacherId,
        recipientTeacher,
        rooms,
        breaks,
        systemSettings,
    } = params;

    const startLimit = parseTimeValue(systemSettings?.startTime || "7:00 AM");
    const endLimit = parseTimeValue(systemSettings?.endTime || "8:00 PM");

    const allBlocks = allRows.map((r, i) => mapRowToBlock(r, i));
    const bundle = allBlocks.filter(
        (b) =>
            b.teacherId === String(fromTeacherId) &&
            b.subjectId === String(subjectId) &&
            b.sectionId === String(sectionId)
    );

    if (bundle.length === 0) {
        return { ok: false, message: "No matching class blocks were found for this teacher and subject–section." };
    }

    const bundleIds = new Set(bundle.map((b) => b.id));
    const fixed = allBlocks.filter((b) => !bundleIds.has(b.id));

    const recipientOther = fixed.filter((b) => b.teacherId === String(toTeacherId));
    const recipientLoad = recipientOther.reduce((t, b) => t + (b.end - b.start) / 60, 0);
    const bundleUnits = bundle.reduce((t, b) => t + (b.end - b.start) / 60, 0);
    const maxUnits = getMaxUnitsSync(recipientTeacher?.employment_type, systemSettings);
    const overloadMax = getOverloadMaxSync(systemSettings);
    const absoluteMax = maxUnits + overloadMax;
    if (recipientLoad + bundleUnits > absoluteMax + 1e-6) {
        return {
            ok: false,
            message: `This transfer would exceed the teacher’s maximum load (${absoluteMax} units including overload).`,
        };
    }

    const prepLimit = getPrepLimitSync(recipientTeacher?.employment_type, systemSettings);
    const subjectCodes = new Set(recipientOther.map((b) => b.subjectId));
    if (!subjectCodes.has(String(subjectId)) && subjectCodes.size >= prepLimit) {
        return {
            ok: false,
            message: `This teacher is already at the preparation limit (${prepLimit} distinct subjects).`,
        };
    }

    const placed: ScheduleBlock[] = [];
    const sortedBundle = [...bundle].sort(
        (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start - b.start || a.id.localeCompare(b.id)
    );

    for (const orig of sortedBundle) {
        const ctx = [...fixed, ...placed];
        const direct: ScheduleBlock = {
            ...orig,
            teacherId: String(toTeacherId),
        };
        if (
            !breaksOverlap(direct.day, direct.start, direct.end, breaks) &&
            teacherSlotAllowed(recipientTeacher, direct.day, direct.start, direct.end) &&
            sectionFifthDayOk(direct.sectionId, direct.day, ctx) &&
            !conflictsWithOthers(direct, ctx, new Set())
        ) {
            placed.push(direct);
            continue;
        }

        const found = findPlacementForBlock(
            orig,
            String(toTeacherId),
            recipientTeacher,
            ctx,
            breaks,
            startLimit,
            endLimit,
            rooms
        );
        if (!found) {
            return {
                ok: false,
                message: `Could not place "${orig.subjectId}" for section ${orig.sectionId} without conflicts (tried nearby times, days, and rooms).`,
            };
        }
        placed.push(found);
    }

    const out = [...fixed, ...placed];
    return { ok: true, blocks: out };
}
