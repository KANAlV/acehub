'use server'
import sql from '@/lib/db';
import {revalidatePath} from 'next/cache';

/** --- Login --- **/
export interface User {
    id?: number;
    username: string;
    email: string;
    hash_password?: string;
}

export async function getOrCreateUser(email: string, name: string) {
    try {
        // 1. Check if user exists
        const existingUser = await sql`
            SELECT * FROM users WHERE email = ${email}
        `;

        if (existingUser.length > 0) {
            return existingUser[0];
        }

        const newUser = await sql`
            INSERT INTO users (username, email, hash_password)
            VALUES (${name}, ${email}, 'OAUTH_USER')
            RETURNING *
        `;

        return newUser[0];
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to sync user with database.");
    }
}

/** ---  Rooms --- **/
export async function fetchRoomsCount(p_room_name: string) {
    // Determine search label for cleaner logging
    const searchLabel = p_room_name.trim() === "" ? "all rooms" : `filter: "${p_room_name}"`;

    try {
        const result = await sql`
            SELECT get_rooms_count(${p_room_name})
        `;

        const count = result.length > 0 ? result[0].get_rooms_count : 0;

        // Log the search criteria and the actual result
        console.log(`[DB_FETCH]: Room count requested (${searchLabel}) | Result: ${count}`);

        return count;

    } catch (error) {
        // Log the specific parameter that caused the crash
        console.error(`[DB_ERROR]: Failed to fetch room count for "${p_room_name}":`, error);
        return 0;
    }
}

export async function insertRoom(name: string, type: string) {
    const checkIfExists = await sql`SELECT 1 FROM rooms WHERE room_name = ${name} LIMIT 1`;
    if (checkIfExists.length > 0) return "409";

    try {
        const result = await sql`SELECT * FROM create_room(${name}, ${type})`;
        const newRoom = result[0];

        revalidatePath('/rooms');

        console.log(`[${new Date().toISOString()}] DB_SUCCESS: Room Created`, {
            id: newRoom?.room_id,
            name: name,
            type: type
        });

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

        // Log search term, page number, and how many results actually came back
        console.log(
            `[DB_FETCH]: Rooms | Page: ${page} | Search: "${search || 'none'}" | Found: ${rooms.length}`
        );

        return rooms;
    } catch (error) {
        // Including the search and page in the error helps reproduce the crash
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

    if (nameConflict.length > 0) {
        console.warn(`[DB_CONFLICT]: Cannot update Room ${roomId}. Name "${name}" is already taken.`);
        return "409";
    }

    try {
        console.log(`[DB_UPDATE]: Attempting to update Room ${roomId} to Name: "${name}", Type: "${type}"`);

        const result = await sql`SELECT * FROM update_room(${roomId}, ${name}, ${type})`;
        const updatedRoom = result[0];

        if (!updatedRoom) {
            console.warn(`[DB_WARN]: Update failed. Room ${roomId} not found.`);
            return "404";
        }

        revalidatePath('/rooms');

        console.log(`[${new Date().toISOString()}] DB_SUCCESS: Room Updated`, {
            id: roomId,
            newName: name,
            newType: type
        });

        return "200"; // 200 OK is standard for updates
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to update room ${roomId}:`, error);
        return "500";
    }
}

export async function deleteRoom(id: number) {
    const roomId = Number(id);

    try {
        console.log(`[DB_DELETE]: Attempting to delete room ID: ${roomId}`);

        const result = await sql`
            SELECT delete_room(${roomId})
        `;

        const isDeleted = result.length > 0 && result[0].delete_room;

        if (isDeleted) {
            console.log(`[DB_SUCCESS]: Room ${roomId} deleted successfully.`);
            revalidatePath('/rooms');
            return "204";
        }

        console.warn(`[DB_WARN]: Delete failed - Room ${roomId} not found (404).`);
        return "404";

    } catch (error) {
        // 3. The "Something broke" log
        console.error(`[DB_ERROR]: Failed to delete room ${roomId}:`, error);
        return "500";
    }
}

export async function getAllRoomsData() {
    try {
        console.log(`[DB_FETCH]: Fetching all rooms for export.`);

        const rooms = await sql`SELECT * FROM get_all_rooms()`;

        // Return raw data to the frontend
        return JSON.parse(JSON.stringify(rooms));
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch export data:", error);
        throw new Error("Failed to fetch rooms");
    }
}

/** --- Courses --- **/
export async function fetchProgramCount(p_program_name: string) {
    const searchLabel = p_program_name.trim() === "" ? "all programs" : `filter: "${p_program_name}"`;

    try {
        const result = await sql`
            SELECT get_program_count(${p_program_name})
        `;

        // The column name in the result will be 'get_program_count'
        const count = result.length > 0 ? result[0].get_program_count : 0;

        console.log(`[DB_FETCH]: Program count requested (${searchLabel}) | Result: ${count}`);
        return count;

    } catch (error) {
        console.error(`[DB_ERROR]: Failed to fetch program count for "${p_program_name}":`, error);
        return 0;
    }
}

export async function insertProgram(
    p_program_code: string,
    p_program_name: string,
    p_level: string,
) {
    const checkIfExists = await sql`
        SELECT 1 FROM programs
        WHERE program_code = ${p_program_code}
            LIMIT 1
    `;

    if (checkIfExists.length > 0) return "409";

    try {
        // Add the explicit cast ::program_level here
        await sql`
            SELECT create_program(
               ${p_program_code},
               ${p_program_name},
               ${p_level}::program_level,
           )
        `;

        revalidatePath('/programs');

        console.log(`[${new Date().toISOString()}] DB_SUCCESS: Program Created`, {
            code: p_program_code
        });

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

        const rooms = await sql`
            SELECT * FROM get_programs(${val}, ${offset})
        `;

        // Log search term, page number, and how many results actually came back
        console.log(
            `[DB_FETCH]: Programs | Page: ${page} | Search: "${search || 'none'}" | Found: ${rooms.length}`
        );

        return rooms;
    } catch (error) {
        // Including the search and page in the error helps reproduce the crash
        console.error(`[DB_ERROR]: Failed to fetch programs (Page: ${page}, Search: "${search}"):`, error);
        return [];
    }
}

export async function getAllProgramsData() {
    try {
        console.log(`[DB_FETCH]: Fetching all programs for export.`);

        const programs = await sql`SELECT * FROM get_all_programs()`;

        // Return raw data to the frontend
        return JSON.parse(JSON.stringify(programs));
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch export data:", error);
        throw new Error("Failed to fetch programs");
    }
}

export async function updateProgram(p_code: string, p_name: string, p_level: string) {
    const nameConflict = await sql`
        SELECT 1 FROM programs 
        WHERE program_name = ${p_name} AND program_code != ${p_code} 
        LIMIT 1
    `;

    if (nameConflict.length > 0) {
        console.warn(`[DB_CONFLICT]: Cannot update Program ${p_code}. Name "${p_name}" is already taken.`);
        return "409";
    }

    try {
        console.log(`[DB_UPDATE]: Attempting to update Program ${p_code} to Name: "${p_name}", Level: "${p_level}"`);

        // 2. Call your custom SQL function
        // Note: Your SQL function returns 'void', so we check for execution success
        await sql`SELECT update_program(${p_code}, ${p_name}, ${p_level})`;

        // 3. Revalidate the specific path for your programs table
        revalidatePath('/courses');

        console.log(`[${new Date().toISOString()}] DB_SUCCESS: Program Updated`, {
            code: p_code,
            newName: p_name,
            newLevel: p_level
        });

        return "200";
    } catch (error) {
        console.error(`[DB_ERROR]: Failed to update program ${p_code}:`, error);

        // Handle specific Postgres errors (like foreign key or type mismatches)
        return "500";
    }
}

export async function deleteProgram(id: string) {
    try {
        console.log(`[DB_DELETE]: Attempting to delete program code: ${id}`);

        const result = await sql`
            SELECT delete_program(${id})
        `;

        const isDeleted = result.length > 0 && result[0].delete_program;

        if (isDeleted) {
            console.log(`[DB_SUCCESS]: Program ${id} deleted successfully.`);
            revalidatePath('/courses');
            return "204";
        }

        console.warn(`[DB_WARN]: Delete failed - Program ${id} not found (404).`);
        return "404";

    } catch (error) {
        // 3. The "Something broke" log
        console.error(`[DB_ERROR]: Failed to delete program ${id}:`, error);
        return "500";
    }
}

/** --- Subjects --- **/
export async function insertSubject(subject_code: string, subject_name: string, requirements: any, program_code: string) {
    try {
        console.log(`[DB_INSERT]: Creating subject: ${subject_code}`);

        await sql`
            SELECT insert_subject(
               ${subject_code},
               ${subject_name},
               ${requirements},
               ${program_code}
            )
        `;

        revalidatePath('/subjects');
        return "201";
    } catch (error: any) {
        console.error("[DB_ERROR]: Subject creation failed:", error);

        // Handle Foreign Key violation (Program code doesn't exist)
        if (error.code === '23503') return "400";
        // Handle Duplicate Subject Code
        if (error.code === '23505') return "409";

        return "500";
    }
}

export async function fetchSubjects(search: string, page: number) {
    try {
        const itemsPerPage = 10;
        const offset = (page - 1) * itemsPerPage;

        return await sql`
            SELECT * FROM fetch_subjects(
                ${search}, 
                ${itemsPerPage}, 
                ${offset}
            )
        `;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch subjects:", error);
        return [];
    }
}

export async function fetchSubjectCount(search: string) {
    try {
        const result = await sql`
            SELECT count FROM fetch_subject_count(${search})
        `;

        return parseInt(result[0]?.count || "0");
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch subject count:", error);
        return 0;
    }
}

export async function updateSubject(subject_code: string, subject_name: string, requirements: any, program_code: string) {
    try {
        console.log(`[DB_UPDATE]: Updating subject: ${subject_code}`);

        await sql`
            SELECT update_subject(
                ${subject_code}, 
                ${subject_name}, 
                ${requirements}, 
                ${program_code}
            )
        `;

        revalidatePath('/subjects');
        return "200";
    } catch (error) {
        console.error("[DB_ERROR]: Subject update failed:", error);
        return "500";
    }
}

export async function deleteSubject(subject_code: string) {
    try {
        console.log(`[DB_DELETE]: Deleting subject: ${subject_code}`);

        await sql`
            SELECT delete_subject(${subject_code})
        `;

        revalidatePath('/subjects');
        return "204";
    } catch (error) {
        console.error("[DB_ERROR]: Subject deletion failed:", error);
        return "500";
    }
}

export async function getProgramList() {
    try {
        return await sql`
            SELECT program_code, program_name FROM programs ORDER BY program_code ASC
        `;
    } catch (error) {
        console.error("[DB_ERROR]: Failed to fetch program list:", error);
        return [];
    }
}