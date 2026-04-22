'use server'
import sql from '@/lib/db';
import {revalidatePath} from 'next/cache';
import { cookies } from 'next/headers';

/** --- Login & User Session --- **/
export interface User {
    id?: number;
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

export async function updateAccountRole(id: number, role: string) {
    try {
        await sql`SELECT update_user_role(${id}, ${role})`;
        revalidatePath('/settings');
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Failed to update role:", error);
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
export async function insertSubject(curriculumn_version: string, course_code: string, course_name: string, field_of_specialization: string, lecture: number, lab: number, lab_type: string, year_term: string) {
    try {
        await sql`SELECT create_subject(${curriculumn_version}, ${course_code}, ${course_name}, ${field_of_specialization}, ${lecture}, ${lab}, ${lab_type}, ${year_term})`;
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

export async function updateSubject(curriculumn_version: string, course_code: string, course_name: string, field_of_specialization: string, lecture: number, lab: number, lab_type: string, year_term: string) {
    try {
        await sql`SELECT update_subject(${curriculumn_version}, ${course_code}, ${course_name}, ${field_of_specialization}, ${lecture}, ${lab}, ${lab_type}, ${year_term})`;
        revalidatePath('/subjects');
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Subject update failed:", error);
        return "500";
    }
}

export async function deleteSubject(curriculumn_version: string, course_code: string) {
    try {
        await sql`SELECT delete_subject(${curriculumn_version}, ${course_code})`;
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
