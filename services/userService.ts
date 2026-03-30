'use server'
import sql from '@/lib/db';

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

export async function fetchRooms(search = "") {
    try {
        const val = search.trim() === "" ? null : search;

        // In 'postgres.js', you call the function directly with tagged template literals
        // OR as a function for dynamic parameters:
        const rooms = await sql`
            SELECT * FROM get_rooms(${val})
        `;

        // 'postgres.js' returns the array of rows directly, NOT an object with a .rows property
        return rooms;
    } catch (error) {
        console.error("DB Error:", error);
        return [];
    }
}

export async function insertRoom(room_name: string, room_type: string) {
    try {
        // Log the inputs to be 100% sure what's being sent
        console.log("Attempting to insert:", { room_name, room_type });

        await sql`SELECT * FROM create_room(${room_name}, ${room_type})`;
        return "201";
    } catch (error: any) {
        // THIS IS THE MOST IMPORTANT LINE:
        // It will show "column 'floor' does not exist" or "unique constraint violation"
        console.error("FULL DATABASE ERROR:", error.message);

        return "500";
    }
}