import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    console.log('Test API called');
    
    try {
        return NextResponse.json({ message: 'API is working' });
    } catch (error) {
        console.error('Test API error:', error);
        return NextResponse.json(
            { error: 'Test failed' },
            { status: 500 }
        );
    }
}
