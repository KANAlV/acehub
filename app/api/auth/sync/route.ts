import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/services/userService';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
    try {
        const { email, name } = await request.json();

        // Use lowercase to avoid case-sensitivity issues
        const userEmail = email?.toLowerCase().trim();
        const allowedDomain = "@alabang.sti.edu.ph";

        if (!userEmail || !userEmail.endsWith(allowedDomain)) {
            return NextResponse.json(
                { error: `Access Denied: Please use an ${allowedDomain} account.` },
                { status: 403 }
            );
        }

        // Create or get user from your database
        const user = await getOrCreateUser(userEmail, name);

        revalidatePath('/');

        return NextResponse.json({
            message: "Success",
            user: { id: user.id, email: user.email }
        });
    } catch (error) {
        console.error("API Sync Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}