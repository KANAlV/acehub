import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    console.log('Database export API called');
    
    try {
        // Check if DUMP_URL is available
        const dumpUrl = process.env.DUMP_URL;
        if (!dumpUrl) {
            console.error('DUMP_URL environment variable is missing');
            return NextResponse.json(
                { 
                    error: 'Database export is not configured',
                    message: 'The DUMP_URL environment variable is missing. Please configure the database connection string in your .env.local file.'
                },
                { status: 503 }
            );
        }
        
        console.log('DUMP_URL found:', dumpUrl.substring(0, 20) + '...');
        
        // Import pgDump only when needed and call it
        const { pgDump } = await import('@/services/userService');
        
        console.log('Calling pgDump function...');
        const result = await pgDump();
        console.log('pgDump function completed successfully');
        return result;
        
    } catch (error) {
        console.error('Database export API error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to export database', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
