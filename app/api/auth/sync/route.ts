import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/services/userService';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { email, name } = await request.json();

        // Use lowercase to avoid case-sensitivity issues
        const userEmail = email?.toLowerCase().trim();
        const allowedDomains = [
            "@alabang.sti.edu",
            "@alabang.sti.edu.ph"
        ];

        const isValid = allowedDomains.some(domain =>
            userEmail.toLowerCase().endsWith(domain.toLowerCase())
        );

        if (!isValid) {
            return NextResponse.json(
                { error: `Access Denied: Please use an @alabang.sti.edu(.ph) account.` },
                { status: 403 }
            );
        }

        // Create or get user from your database
        const user = await getOrCreateUser(userEmail, name);

        // Set an HTTP-only cookie for server-side session management
        const cookieStore = await cookies();
        cookieStore.set('user_email', userEmail, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });
        cookieStore.set('userRole', user.role || 'Viewer', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });

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