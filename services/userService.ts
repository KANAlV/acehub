'use server'
import sql from '@/lib/db';
import {revalidatePath} from 'next/cache';

/* Status Codes
        *
        * 200 - all clear (returned req succesfully)
        * 201 - req success and creation of new resource
        * 204 - req success but no data back (used after deleting something)
        * 400 - bad request
        * 401 - unauthorized
        * 403 - forbidden
        * 500 - Internal Server Error (catch-all)
        * 503 - Service Unavailable (server is temporarily overloaded or down for maintenance)
        * */

/** ---  ROOMS --- **/
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

