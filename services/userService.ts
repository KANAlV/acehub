'use server'
import sql from '@/lib/db';
import {revalidatePath} from 'next/cache';
import { cookies } from 'next/headers';
import { generateScheduleData } from '@/lib/schedulerEngine';

/** --- Login & User Session --- **/
export interface User {
    id?: string;
    username: string;
    email: string;
    role?: string;
    hash_password?: string;
}

export async function getOrCreateUser(email: string, name: string) {
    try {
        const existingUser = await sql`
            SELECT * FROM users WHERE email = ${email}
        `;

        if (existingUser.length > 0) {
            return existingUser[0];
        }

        const newUser = await sql`
            INSERT INTO users (username, email, hash_password, role)
            VALUES (${name}, ${email}, 'OAUTH_USER', 'Faculty')
            RETURNING *
        `;

        return newUser[0];
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to sync user with database.");
    }
}

export async function getCurrentUser(): Promise<User | null> {
    try {
        const cookieStore = await cookies();
        const userEmail = cookieStore.get('user_email')?.value;

        if (!userEmail) return null;

        const result = await sql`
            SELECT id, username, email, role FROM users WHERE email = ${userEmail}
        `;

        return result.length > 0 ? (result[0] as User) : null;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch current user session:", error);
        return null;
    }
}

/** ---  Settings & Presets --- **/

export async function fetchSystemSettings() {
    try {
        const result = await sql`SELECT * FROM get_system_settings()`;
        return result.reduce((acc, row) => ({
            ...acc,
            [row.key]: row.value
        }), {});
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch settings:", error);
        return {};
    }
}

export async function updateSystemSetting(key: string, value: any) {
    try {
        await sql`SELECT upsert_system_setting(${key}, ${value as any}::jsonb)`;
        revalidatePath('/settings');
        return "200";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to update setting ${key}:`, error);
        return "500";
    }
}

export async function fetchPresets() {
    try {
        return await sql`SELECT * FROM get_settings_presets()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch presets:", error);
        return [];
    }
}

export async function savePreset(name: string, data: any) {
    try {
        await sql`SELECT upsert_settings_preset(${name}, ${data as any}::jsonb)`;
        revalidatePath('/settings');
        return "201";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to save preset:", error);
        return "500";
    }
}

export async function deletePreset(name: string) {
    try {
        await sql`SELECT delete_settings_preset(${name})`;
        revalidatePath('/settings');
        return "204";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to delete preset:", error);
        return "500";
    }
}

/** --- Break Periods --- **/

export async function fetchBreakPeriods() {
    try {
        return await sql`SELECT * FROM get_break_periods()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch breaks:", error);
        return [];
    }
}

export async function insertBreakPeriod(day: string, start: string, end: string, desc: string) {
    try {
        await sql`SELECT create_break_period(${day}, ${start}, ${end}, ${desc})`;
        revalidatePath('/settings');
        return "201";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to insert break:", error);
        return "500";
    }
}

export async function updateBreakPeriod(id: number, day: string, start: string, end: string, desc: string) {
    try {
        await sql`SELECT update_break_period(${id}, ${day}, ${start}, ${end}, ${desc})`;
        revalidatePath('/settings');
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to update break:", error);
        return "500";
    }
}

export async function deleteBreakPeriod(id: number) {
    try {
        await sql`SELECT delete_break_period(${id})`;
        revalidatePath('/settings');
        return "204";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to delete break:", error);
        return "500";
    }
}

/** --- Account Management --- **/

export async function fetchAuthorizedAccounts() {
    try {
        return await sql`SELECT * FROM get_authorized_accounts()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch accounts:", error);
        return [];
    }
}

export async function insertUser(username: string, email: string, role: string) {
    try {
        await sql`SELECT create_user(${username}, ${email}, ${role})`;
        revalidatePath('/settings');
        return "201";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to create user:", error);
        return "500";
    }
}

export async function updateAccountRole(id: string, role: string) {
    try {
        await sql`SELECT update_user_role(${id}::uuid, ${role})`;
        revalidatePath('/settings');
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to update role:", error);
        return "500";
    }
}

export async function deleteUser(id: string) {
    try {
        await sql`SELECT delete_user(${id}::uuid)`;
        revalidatePath('/settings');
        return "204";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to delete user:", error);
        return "500";
    }
}

/** ---  Rooms --- **/
export async function fetchRoomsCount(p_room_name: string) {
    const searchLabel = p_room_name.trim() === "" ? "all rooms" : `filter: "${p_room_name}"`;

    try {
        const result = await sql`
            SELECT get_rooms_count(${p_room_name})
        `;

        const count = result.length > 0 ? result[0].get_rooms_count : 0;
        console.log(`[DB_FETCH]: Room count requested (${searchLabel}) | Result: ${count}`);
        return count;
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch room count for "${p_room_name}":`, error);
        return 0;
    }
}

export async function insertRoom(name: string, type: string) {
    const checkIfExists = await sql`SELECT 1 FROM rooms WHERE room_name = ${name} LIMIT 1`;
    if (checkIfExists.length > 0) return "409";

    try {
        await sql`SELECT * FROM create_room(${name}, ${type})`;
        revalidatePath('/rooms');
        return "201";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to insert room "${name}":`, error);
        return "500";
    }
}

export async function fetchRooms(search = "", page: number) {
    const ITEMS_PER_PAGE = 10;
    try {
        const val = search.trim() === "" ? null : search;
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const rooms = await sql`
            SELECT * FROM get_rooms(${val}, ${offset})
        `;
        return rooms;
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch rooms (Page: ${page}, Search: "${search}"):`, error);
        return [];
    }
}

export async function updateRoom(id: number, name: string, type: string) {
    const roomId = Number(id);
    const nameConflict = await sql`
        SELECT 1 FROM rooms 
        WHERE room_name = ${name} AND room_id != ${roomId} 
        LIMIT 1
    `;
    if (nameConflict.length > 0) return "409";

    try {
        await sql`SELECT * FROM update_room(${roomId}, ${name}, ${type})`;
        revalidatePath('/rooms');
        return "200";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to update room ${roomId}:`, error);
        return "500";
    }
}

export async function deleteRoom(id: number) {
    try {
        const result = await sql`SELECT delete_room(${Number(id)})`;
        if (result.length > 0 && result[0].delete_room) {
            revalidatePath('/rooms');
            return "204";
        }
        return "404";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to delete room ${id}:`, error);
        return "500";
    }
}

export async function getAllRoomsData() {
    try {
        const rooms = await sql`SELECT * FROM get_all_rooms()`;
        return JSON.parse(JSON.stringify(rooms));
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch export data:", error);
        throw new Error("Failed to fetch rooms");
    }
}

/** --- Sections --- **/
export async function fetchProgramCount(p_program_name: string) {
    try {
        const result = await sql`SELECT get_program_count(${p_program_name})`;
        return result.length > 0 ? result[0].get_program_count : 0;
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch program count for "${p_program_name}":`, error);
        return 0;
    }
}

export async function insertProgram(p_program_code: string, p_program_name: string, p_level: string, p_students: Record<string, number>) {
    const checkIfExists = await sql`SELECT 1 FROM programs WHERE program_code = ${p_program_code} LIMIT 1`;
    if (checkIfExists.length > 0) return "409";

    try {
        await sql`SELECT create_program(${p_program_code}, ${p_program_name}, ${p_level}::program_level, ${p_students as any}::jsonb)`;
        revalidatePath('/sections');
        return "201";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to execute create_program for "${p_program_code}":`, error);
        return "500";
    }
}

export async function fetchPrograms(search = "", page: number) {
    const ITEMS_PER_PAGE = 10;
    try {
        const val = search.trim() === "" ? null : search;
        const offset = (page - 1) * ITEMS_PER_PAGE;
        return await sql`SELECT * FROM get_programs(${val}, ${offset})`;
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch programs (Page: ${page}, Search: "${search}"):`, error);
        return [];
    }
}

export async function getAllProgramsData() {
    try {
        const programs = await sql`SELECT * FROM get_all_programs()`;
        return JSON.parse(JSON.stringify(programs));
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch export data:", error);
        throw new Error("Failed to fetch programs");
    }
}

export async function updateProgram(p_code: string, p_name: string, p_level: string, p_students: Record<string, number>) {
    const nameConflict = await sql`SELECT 1 FROM programs WHERE program_name = ${p_name} AND program_code != ${p_code} LIMIT 1`;
    if (nameConflict.length > 0) return "409";

    try {
        await sql`SELECT update_program(${p_code}, ${p_name}, ${p_level}::program_level, ${p_students as any}::jsonb)`;
        revalidatePath('/sections');
        return "200";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to update program ${p_code}:`, error);
        return "500";
    }
}

export async function deleteProgram(id: string) {
    try {
        const result = await sql`SELECT delete_program(${id})`;
        if (result.length > 0 && result[0].delete_program) {
            revalidatePath('/sections');
            return "204";
        }
        return "404";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to delete program ${id}:`, error);
        return "500";
    }
}

/** --- Subjects --- **/
export async function insertSubject(curriculumn_version: string | null, course_code: string, course_name: string, field_of_specialization: string, lecture: number, lab: number, lab_type: string, year_term: string) {
    try {
        await sql`SELECT create_subject(
            ${curriculumn_version}::text, 
            ${course_code}::text, 
            ${course_name}::text, 
            ${field_of_specialization}::text, 
            ${lecture}::numeric, 
            ${lab}::numeric, 
            ${lab_type}::text, 
            ${year_term}::text
        )`;
        revalidatePath('/subjects');
        return "201";
    } catch (error: any) {
        console.error("[DB_ERROR]: Subject creation failed:", error);
        if (error.code === '23505') return "409"; 
        return "500";
    }
}

export async function fetchSubjects(search: string, page: number) {
    try {
        const itemsPerPage = 10;
        const offset = (page - 1) * itemsPerPage;
        return await sql`SELECT * FROM fetch_subjects(${search}, ${itemsPerPage}, ${offset})`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch subjects:", error);
        return [];
    }
}

export async function fetchSubjectCount(search: string) {
    try {
        const result = await sql`SELECT count FROM fetch_subject_count(${search})`;
        return parseInt(result[0]?.count || "0");
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch subject count:", error);
        return 0;
    }
}

export async function updateSubject(id: string, curriculumn_version: string | null, course_code: string, course_name: string, field_of_specialization: string, lecture: number, lab: number, lab_type: string, year_term: string) {
    try {
        await sql`SELECT update_subject(
            ${id}::uuid, 
            ${curriculumn_version}::text, 
            ${course_code}::text, 
            ${course_name}::text, 
            ${field_of_specialization}::text, 
            ${lecture}::numeric, 
            ${lab}::numeric, 
            ${lab_type}::text, 
            ${year_term}::text
        )`;
        revalidatePath('/subjects');
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Subject update failed:", error);
        return "500";
    }
}

export async function deleteSubject(id: string) {
    try {
        await sql`SELECT delete_subject(${id}::uuid)`;
        revalidatePath('/subjects');
        return "204";
    } catch (error) {
        console.error("[DB_ERROR]: Subject deletion failed:", error);
        return "500";
    }
}

export async function getProgramList() {
    try {
        return await sql`SELECT program_code, program_name FROM programs ORDER BY program_code ASC`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch program list:", error);
        return [];
    }
}

export async function fetchAllSubjects() {
    try {
        return await sql`SELECT * FROM get_all_subjects()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch all subjects:", error);
        return [];
    }
}

export async function fetchCurriculumVersions() {
    try {
        return await sql`SELECT * FROM get_distinct_curriculum_versions()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch curriculum versions:", error);
        return [];
    }
}

/** --- Teachers --- **/
export async function fetchTeachers(search = "", page: number) {
    const ITEMS_PER_PAGE = 10;
    try {
        const val = search.trim() === "" ? null : search;
        const offset = (page - 1) * ITEMS_PER_PAGE;
        return await sql`SELECT * FROM get_teachers(${val}, ${offset})`;
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch teachers:`, error);
        return [];
    }
}

export async function fetchTeachersCount(search = "") {
    try {
        const val = search.trim() === "" ? null : search;
        const result = await sql`SELECT get_teachers_count(${val})`;
        return result.length > 0 ? result[0].get_teachers_count : 0;
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch teachers count:`, error);
        return 0;
    }
}

export async function insertTeacher(id: string, name: string, code: string, spec: string, type: string, availability: any[]) {
    try {
        await sql`SELECT create_teacher(
            ${id}, 
            ${name}, 
            ${code}, 
            ${spec}, 
            ${type}, 
            ${availability as any}::jsonb
        )`;
        revalidatePath('/teachers');
        return "201";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to create teacher:`, error);
        return "500";
    }
}

export async function updateTeacher(id: string, name: string, code: string, spec: string, type: string, availability: any[]) {
    try {
        await sql`SELECT update_teacher(
            ${id}, 
            ${name}, 
            ${code}, 
            ${spec}, 
            ${type}, 
            ${availability as any}::jsonb
        )`;
        revalidatePath('/teachers');
        return "200";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to update teacher:`, error);
        return "500";
    }
}

export async function deleteTeacher(id: string) {
    try {
        await sql`SELECT delete_teacher(${id})`;
        revalidatePath('/teachers');
        return "204";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to delete teacher:`, error);
        return "500";
    }
}

export async function getAllTeachersData() {
    try {
        const result = await sql`SELECT * FROM get_all_teachers()`;
        return JSON.parse(JSON.stringify(result));
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch all teachers:", error);
        throw new Error("Failed to fetch teachers");
    }
}

export async function fetchAllTeachers() {
    try {
        return await sql`SELECT * FROM get_all_teachers()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch all teachers:", error);
        return [];
    }
}

/** --- Schedules --- **/
export async function saveGeneratedSchedule(name: string, config: any) {
    try {
        // 1. Create the Schedule Snapshot record
        const schedule = await sql`
            SELECT create_generated_schedule(${name}, ${config as any}::jsonb) as id
        `;
        const scheduleId = schedule[0].id;

        // 2. RUN THE GENERATION ENGINE
        const initialEntries = await generateScheduleData(config);

        // 3. Batch Insert the Generated Entries
        if (initialEntries.length > 0) {
            for (const entry of initialEntries) {
                await sql`
                    INSERT INTO schedule_entries (schedule_id, subject_id, teacher_id, room_id, section_id, day, start_time, end_time)
                    VALUES (
                        ${scheduleId}::uuid, 
                        ${entry.subjectId}, 
                        ${entry.teacherId}, 
                        ${parseInt(entry.roomId)}, 
                        ${entry.sectionId}, 
                        ${entry.day}, 
                        ${entry.start}, 
                        ${entry.end}
                    )
                `;
            }
        }

        revalidatePath('/schedules');
        return { status: "201", id: scheduleId };
    } catch (error) {
        console.error("[DB_ERROR]: Failed to save schedule:", error);
        return { status: "500" };
    }
}

export async function fetchSchedulesList() {
    try {
        return await sql`SELECT * FROM get_schedules_list()`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch schedules:", error);
        return [];
    }
}

export async function fetchScheduleDetails(id: string) {
    try {
        return await sql`SELECT * FROM get_schedule_details(${id}::uuid)`;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch schedule details:", error);
        return [];
    }
}

export async function updateScheduleEntries(scheduleId: string, entries: any[]) {
    try {
        await sql`DELETE FROM schedule_entries WHERE schedule_id = ${scheduleId}::uuid`;
        for (const entry of entries) {
            await sql`
                INSERT INTO schedule_entries (schedule_id, subject_id, teacher_id, room_id, section_id, day, start_time, end_time)
                VALUES (${scheduleId}::uuid, ${entry.subjectId}, ${entry.teacherId}, ${parseInt(entry.roomId)}, ${entry.sectionId}, ${entry.day}, ${entry.start}, ${entry.end})
            `;
        }
        revalidatePath(`/generated_schedule/${scheduleId}`);
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to update schedule entries:", error);
        return "500";
    }
}

export async function deleteGeneratedSchedule(id: string) {
    try {
        await sql`DELETE FROM generated_schedules WHERE id = ${id}::uuid`;
        revalidatePath('/schedules');
        return "204";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to delete schedule:", error);
        return "500";
    }
}
