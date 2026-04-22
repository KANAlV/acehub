import { getCurrentUser } from '@/services/userService';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        console.log('API: Fetching current user...');
        
        const user = await getCurrentUser();
        console.log('API: User data retrieved:', user ? { id: user.id, email: user.email, username: user.username } : 'null');
        
        const response = NextResponse.json(user);
        
        // Add CORS headers for Vercel
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return response;
    } catch (error) {
        console.error('API Error fetching current user:', error);
        
        const errorResponse = NextResponse.json({ 
            error: 'Failed to fetch user',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
        
        errorResponse.headers.set('Access-Control-Allow-Origin', '*');
        errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return errorResponse;
    }
}

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 200 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
}
