import sql from '@/lib/db';

/** Example Function Code
export async function getUserById(id) {
    try {
        const [user] = await sql`
      SELECT id, name, email, created_at 
      FROM users 
      WHERE id = ${id}
    `;
        return user || null;
    } catch (error) {
        console.error("Error fetching user:", error);
        throw new Error("Could not retrieve user");
    }
}
 **/