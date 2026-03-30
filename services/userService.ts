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
    export async function fetchRooms(search = "", page:number) {
        try {
            const val = search.trim() === "" ? null : search;
            const offset = (page - 1) * 15;

            const rooms = await sql`
                SELECT * FROM get_rooms(${val}, ${offset})
            `;

            return rooms;
        } catch (error) {
            console.error("DB Error:", error);
            return [];
        }
    }

    export async function fetchRoomsCount(p_room_name = null) {
        try {
            const result = await sql`
                SELECT get_rooms_count(${p_room_name})
            `;

            // result is an array like: [{ get_rooms_count: 15 }]
            // Return 0 if the array is empty, otherwise return the value
            return result.length > 0 ? result[0].get_rooms_count : 0;

        } catch (error) {
            console.error("DB Error:", error);
            return 0;
        }
    }

    export async function insertRoom(name: string, type: string) {
        try {
            // Tagged template literals automatically prevent SQL Injection
            await sql`
          INSERT INTO rooms (room_name, room_type)
          VALUES (${name}, ${type})
        `;

            // This clears the Next.js cache so the new room shows up instantly
            revalidatePath('/rooms');

            return "201";
        } catch (error) {
            console.error(error);
            return "500";
        }
    }