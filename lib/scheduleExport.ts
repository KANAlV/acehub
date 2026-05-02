import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver'; // Import file-saver
import {
    fetchScheduleDetails,
    fetchAllTeachers,
    fetchAllSubjects,
    getAllRoomsData,
    fetchSchedulesList
} from '@/services/userService';

export interface ScheduleEntry {
    schedule_id?: string;
    subject_id: string;
    teacher_id: string;
    room_id: string | number | null | undefined; // Updated type to be more robust
    section_id: string;
    day: string;
    start_time: number;
    end_time: number;
}

export interface TeacherInfo {
    pscs_id: string;
    name: string;
    teacher_code: string;
    employment_type: string;
}

export interface SubjectInfo {
    course_code: string;
    course_name: string;
    lecture_units: number;
    lab_units: number;
}

export interface RoomInfo {
    room_id: number;
    room_name: string;
    room_type: string;
}

export interface ExportData {
    scheduleName: string;
    semester: string;
    schoolYear: string;
    entries: ScheduleEntry[];
    teachers: TeacherInfo[];
    subjects: SubjectInfo[];
    rooms: RoomInfo[];
}

function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

function getDayOrder(day: string): number {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.indexOf(day);
}

export async function exportScheduleToExcel(
    scheduleId: string,
    scheduleName: string,
    semester: string = 'Second Semester',
    schoolYear: string = '2025-2026'
): Promise<string> {
    try {
        // Fetch schedule entries and all reference data
        const [scheduleEntries, allTeachers, allSubjects, allRooms] = await Promise.all([
            fetchScheduleDetails(scheduleId),
            fetchAllTeachers(),
            fetchAllSubjects(),
            getAllRoomsData()
        ]);

        const entries = scheduleEntries as ScheduleEntry[];

        // Extract unique IDs used in this schedule
        const usedTeacherIds = new Set(entries.map(e => e.teacher_id));
        const usedSubjectIds = new Set(entries.map(e => e.subject_id));
        // Robustly get used room IDs
        const usedRoomIds = new Set(entries.map(e => {
            const rawRoomId = e.room_id;
            if (rawRoomId != null && String(rawRoomId).trim() !== '' && !isNaN(Number(rawRoomId))) {
                return Number(rawRoomId);
            }
            return null;
        }).filter(id => id !== null));


        // Filter to only include data relevant to this schedule
        const teachers = (allTeachers as TeacherInfo[]).filter(t => usedTeacherIds.has(t.pscs_id));
        const subjects = (allSubjects as SubjectInfo[]).filter(s => usedSubjectIds.has(s.course_code));
        const rooms = (allRooms as RoomInfo[]).filter(r => usedRoomIds.has(r.room_id));

        const data: ExportData = {
            scheduleName,
            semester,
            schoolYear,
            entries,
            teachers,
            subjects,
            rooms
        };

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ACEHUB Scheduling System';
        workbook.created = new Date();

        // 1. Create Master Schedule Sheet
        await createMasterScheduleSheet(workbook, data);

        // 2. Create Teacher Schedule Sheets
        await createTeacherScheduleSheets(workbook, data);

        // 3. Create Room Schedule Sheets
        await createRoomScheduleSheets(workbook, data);

        // 4. Create Summary Sheet
        await createSummarySheet(workbook, data);

        // Generate filename
        const filename = `${scheduleName.replace(/[^a-zA-Z0-9]/g, '_')}_${semester}_${schoolYear}.xlsx`;

        // Write to buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Use file-saver to trigger download
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        saveAs(blob, filename);

        return "200"; // Indicate success
    } catch (error) {
        console.error('Error exporting schedule:', error);
        return "500"; // Indicate failure
    }
}

async function createMasterScheduleSheet(workbook: ExcelJS.Workbook, data: ExportData): Promise<void> {
    const { entries, subjects, teachers, rooms, scheduleName, semester, schoolYear } = data;

    const worksheet = workbook.addWorksheet('MASTER SCHEDULE');

    // Sort entries by day, time, and section
    const sortedEntries = [...entries].sort((a, b) => {
        const dayDiff = getDayOrder(a.day) - getDayOrder(b.day);
        if (dayDiff !== 0) return dayDiff;
        const timeDiff = a.start_time - b.start_time;
        if (timeDiff !== 0) return timeDiff;
        return a.section_id.localeCompare(b.section_id);
    });

    // Set column widths with proper spacing
    worksheet.columns = [
        { header: 'SECTION', key: 'section', width: 15 },
        { header: 'SUBJECT CODE', key: 'subjectCode', width: 15 },
        { header: 'SUBJECT TITLE', key: 'subjectTitle', width: 35 },
        { header: 'LECTURE', key: 'lecture', width: 10 },
        { header: 'LAB', key: 'lab', width: 10 },
        { header: 'DAY', key: 'day', width: 12 },
        { header: 'TIME', key: 'time', width: 20 },
        { header: 'ROOM', key: 'room', width: 15 },
        { header: 'INSTRUCTOR', key: 'instructor', width: 30 },
        { header: 'UNITS', key: 'units', width: 8 }
    ];

    // Add title
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${scheduleName.toUpperCase()}\n${semester} - ${schoolYear}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
    };

    // Style header row
    const headerRow = worksheet.getRow(3);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9E2F3' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Add data rows
    sortedEntries.forEach((entry, index) => {
        const subject = subjects.find(s => s.course_code === entry.subject_id);
        const teacher = teachers.find(t => t.pscs_id === entry.teacher_id);

        let room: RoomInfo | undefined;
        const rawRoomId = entry.room_id;
        if (rawRoomId != null && String(rawRoomId).trim() !== '' && !isNaN(Number(rawRoomId))) {
            const roomIdAsNumber = Number(rawRoomId);
            room = rooms.find(r => r.room_id === roomIdAsNumber);
        }

        const rowData = {
            section: entry.section_id,
            subjectCode: entry.subject_id,
            subjectTitle: subject?.course_name || '',
            lecture: subject?.lecture_units || 0,
            lab: subject?.lab_units || 0,
            day: entry.day,
            time: `${formatTime(entry.start_time)} - ${formatTime(entry.end_time)}`,
            room: room?.room_name || '',
            instructor: teacher?.name || '',
            units: (subject?.lecture_units || 0) + (subject?.lab_units || 0)
        };

        worksheet.addRow(rowData);

        // Style data row
        const row = worksheet.getRow(index + 4);
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Alternate row colors
        if (index % 2 === 0) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8F9FA' }
                };
            });
        }
    });

    // Add empty row for spacing
    worksheet.addRow([]);

    // Add room list at the bottom
    await addRoomList(worksheet, rooms, sortedEntries.length + 6);
}

async function createTeacherScheduleSheets(workbook: ExcelJS.Workbook, data: ExportData): Promise<void> {
    const { entries, subjects, teachers, rooms } = data;

    // Group entries by teacher
    const teacherEntries = teachers.reduce((acc, teacher) => {
        acc[teacher.pscs_id] = {
            teacher,
            entries: entries.filter(e => e.teacher_id === teacher.pscs_id)
        };
        return acc;
    }, {} as Record<string, { teacher: TeacherInfo; entries: ScheduleEntry[] }>);

    // Create a sheet for each teacher
    for (const [teacherId, { teacher, entries: teacherSchedules }] of Object.entries(teacherEntries)) {
        if (teacherSchedules.length === 0) continue;

        // Sort by day and time
        const sortedEntries = teacherSchedules.sort((a, b) => {
            const dayDiff = getDayOrder(a.day) - getDayOrder(b.day);
            if (dayDiff !== 0) return dayDiff;
            return a.start_time - b.start_time;
        });

        const sheetName = `${teacher.name.replace(/[^a-zA-Z0-9]/g, '_')}`.substring(0, 31);
        const worksheet = workbook.addWorksheet(sheetName);

        // Create time grid headers with spacing columns
        worksheet.columns = [
            { header: 'TIME', key: 'time', width: 15 },
            { header: 'MONDAY', key: 'monday', width: 25 },
            { header: '', key: 'spacer1', width: 3 },  // Spacer column
            { header: 'TUESDAY', key: 'tuesday', width: 25 },
            { header: '', key: 'spacer2', width: 3 },  // Spacer column
            { header: 'WEDNESDAY', key: 'wednesday', width: 25 },
            { header: '', key: 'spacer3', width: 3 },  // Spacer column
            { header: 'THURSDAY', key: 'thursday', width: 25 },
            { header: '', key: 'spacer4', width: 3 },  // Spacer column
            { header: 'FRIDAY', key: 'friday', width: 25 },
            { header: '', key: 'spacer5', width: 3 },  // Spacer column
            { header: 'SATURDAY', key: 'saturday', width: 25 }
        ];

        // Add teacher name as title
        worksheet.mergeCells('A1:L1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `${teacher.name} - ${teacher.teacher_code}`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F3FF' }
        };

        // Style header row
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
            if (colNumber % 2 === 1) { // Day columns (odd numbers)
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9E2F3' }
                };
            }
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Create time slots (7:00 AM - 8:00 PM, 30-min intervals)
        const timeSlots = [];
        for (let time = 7 * 60; time <= 20 * 60; time += 30) {
            timeSlots.push(time);
        }

        const dayColumns = {
            'monday': 2, 'tuesday': 4, 'wednesday': 6,
            'thursday': 8, 'friday': 10, 'saturday': 12
        };

        // Add time rows
        timeSlots.forEach((time, timeIndex) => {
            const rowData: Record<string, string> = {
                time: formatTime(time),
                monday: '',
                spacer1: '',
                tuesday: '',
                spacer2: '',
                wednesday: '',
                spacer3: '',
                thursday: '',
                spacer4: '',
                friday: '',
                spacer5: '',
                saturday: ''
            };

            // Fill day columns with schedule data
            Object.entries(dayColumns).forEach(([day, colNumber]) => {
                const entry = sortedEntries.find(e =>
                    e.day.toLowerCase() === day && e.start_time === time
                );

                if (entry) {
                    const subject = subjects.find(s => s.course_code === entry.subject_id);
                    let roomName = '';
                    const rawRoomId = entry.room_id;
                    if (rawRoomId != null && String(rawRoomId).trim() !== '' && !isNaN(Number(rawRoomId))) {
                        const roomIdAsNumber = Number(rawRoomId);
                        const room = rooms.find(r => r.room_id === roomIdAsNumber);
                        roomName = room?.room_name || '';
                    }
                    rowData[day] = `${entry.subject_id}\n${subject?.course_name || ''}\n${roomName}`;
                }
            });

            worksheet.addRow(rowData);

            // Style row
            const row = worksheet.getRow(timeIndex + 4);
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                // Apply specific alignment for day columns (2, 4, 6, 8, 10, 12)
                if (colNumber > 1 && colNumber % 2 === 0) { // These are the day data columns
                    cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
                } else {
                    cell.alignment = { vertical: 'top', wrapText: true }; // Default for other cells
                }

                // Highlight time column
                if (colNumber === 1) {
                    cell.font = { bold: true };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF0F0F0' }
                    };
                }

                // Style spacer columns
                if (colNumber > 1 && colNumber % 2 !== 0) { // These are the spacer columns (3, 5, 7, 9, 11)
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8F8F8' }
                    };
                }
            });
        });
    }
}

async function createRoomScheduleSheets(workbook: ExcelJS.Workbook, data: ExportData): Promise<void> {
    const { entries, subjects, teachers, rooms } = data;

    // Group entries by room
    const roomEntries = rooms.reduce((acc, room) => {
        acc[room.room_id] = {
            room,
            entries: entries.filter(e => {
                const rawEntryRoomId = e.room_id;
                if (rawEntryRoomId != null && String(rawEntryRoomId).trim() !== '' && !isNaN(Number(rawEntryRoomId))) {
                    return Number(rawEntryRoomId) === room.room_id;
                }
                return false;
            })
        };
        return acc;
    }, {} as Record<string, { room: RoomInfo; entries: ScheduleEntry[] }>);

    // Create a sheet for each room
    for (const [roomId, { room, entries: roomSchedules }] of Object.entries(roomEntries)) {
        if (roomSchedules.length === 0) continue;

        // Sort by day and time
        const sortedEntries = roomSchedules.sort((a, b) => {
            const dayDiff = getDayOrder(a.day) - getDayOrder(b.day);
            if (dayDiff !== 0) return dayDiff;
            return a.start_time - b.start_time;
        });

        const sheetName = `${room.room_name.replace(/[^a-zA-Z0-9]/g, '_')}`.substring(0, 31);
        const worksheet = workbook.addWorksheet(sheetName);

        // Create time grid headers with spacing columns
        worksheet.columns = [
            { header: 'TIME', key: 'time', width: 15 },
            { header: 'MONDAY', key: 'monday', width: 25 },
            { header: '', key: 'spacer1', width: 3 },  // Spacer column
            { header: 'TUESDAY', key: 'tuesday', width: 25 },
            { header: '', key: 'spacer2', width: 3 },  // Spacer column
            { header: 'WEDNESDAY', key: 'wednesday', width: 25 },
            { header: '', key: 'spacer3', width: 3 },  // Spacer column
            { header: 'THURSDAY', key: 'thursday', width: 25 },
            { header: '', key: 'spacer4', width: 3 },  // Spacer column
            { header: 'FRIDAY', key: 'friday', width: 25 },
            { header: '', key: 'spacer5', width: 3 },  // Spacer column
            { header: 'SATURDAY', key: 'saturday', width: 25 }
        ];

        // Add room name as title
        worksheet.mergeCells('A1:L1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `${room.room_name} - ${room.room_type}`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F3FF' }
        };

        // Style header row
        const headerRow = worksheet.getRow(3);
        headerRow.eachCell((cell, colNumber) => {
            if (colNumber % 2 === 1) { // Day columns (odd numbers)
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9E2F3' }
                };
            }
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Create time slots
        const timeSlots = [];
        for (let time = 7 * 60; time <= 20 * 60; time += 30) {
            timeSlots.push(time);
        }

        const dayColumns = {
            'monday': 2, 'tuesday': 4, 'wednesday': 6,
            'thursday': 8, 'friday': 10, 'saturday': 12
        };

        // Add time rows
        timeSlots.forEach((time, timeIndex) => {
            const rowData: Record<string, string> = {
                time: formatTime(time),
                monday: '',
                spacer1: '',
                tuesday: '',
                spacer2: '',
                wednesday: '',
                spacer3: '',
                thursday: '',
                spacer4: '',
                friday: '',
                spacer5: '',
                saturday: ''
            };

            // Fill day columns with schedule data
            Object.entries(dayColumns).forEach(([day, colNumber]) => {
                const entry = sortedEntries.find(e =>
                    e.day.toLowerCase() === day && e.start_time === time
                );

                if (entry) {
                    const subject = subjects.find(s => s.course_code === entry.subject_id);
                    const teacher = teachers.find(t => t.pscs_id === entry.teacher_id);
                    rowData[day] = `${entry.subject_id}\n${entry.section_id}\n${teacher?.name || ''}`;
                }
            });

            worksheet.addRow(rowData);

            // Style row
            const row = worksheet.getRow(timeIndex + 4);
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                // Apply specific alignment for day columns (2, 4, 6, 8, 10, 12)
                if (colNumber > 1 && colNumber % 2 === 0) { // These are the day data columns
                    cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
                } else {
                    cell.alignment = { vertical: 'top', wrapText: true }; // Default for other cells
                }

                // Highlight time column
                if (colNumber === 1) {
                    cell.font = { bold: true };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF0F0F0' }
                    };
                }

                // Style spacer columns
                if (colNumber % 2 === 0 && colNumber !== 12) { // Even columns (spacers)
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8F8F8' }
                    };
                }
            });
        });

        // Add room list at the bottom
        await addRoomList(worksheet, rooms, timeSlots.length + 6);
    }
}

// Helper function to add room list at the bottom of a sheet
async function addRoomList(worksheet: ExcelJS.Worksheet, rooms: RoomInfo[], startRow: number): Promise<void> {
    // Add spacing
    worksheet.addRow([]);

    // Add header for room list
    const headerRow = worksheet.addRow(['ROOM LIST']);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E2F3' }
    };

    // Add each room in the format: building code, room type, room number
    rooms.forEach((room, index) => {
        const row = worksheet.addRow([room.room_name]);
        row.font = { size: 11 };
        // Optional: add subtle border
        row.eachCell((cell) => {
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
        });
    });
}

async function createSummarySheet(workbook: ExcelJS.Workbook, data: ExportData): Promise<void> {
    const { entries, subjects, teachers, rooms, scheduleName, semester, schoolYear } = data;

    const worksheet = workbook.addWorksheet('SUMMARY');

    // Calculate statistics
    const stats = {
        totalEntries: entries.length,
        totalSubjects: new Set(entries.map(e => e.subject_id)).size,
        totalTeachers: new Set(entries.map(e => e.teacher_id)).size,
        totalRooms: new Set(entries.map(e => e.room_id)).size, // This will now correctly handle mixed types
        totalSections: new Set(entries.map(e => e.section_id)).size,
        totalUnits: entries.reduce((total, entry) => {
            const subject = subjects.find(s => s.course_code === entry.subject_id);
            return total + (subject?.lecture_units || 0) + (subject?.lab_units || 0);
        }, 0)
    };

    // Set columns
    worksheet.columns = [
        { header: 'CATEGORY', key: 'category', width: 25 },
        { header: 'ITEM', key: 'item', width: 30 },
        { header: 'VALUE', key: 'value', width: 20 }
    ];

    // Add title
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'SCHEDULE SUMMARY';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
    };

    // Add summary data
    const summaryData = [
        { category: 'Schedule Information', item: 'Schedule Name', value: scheduleName },
        { category: '', item: 'Semester', value: semester },
        { category: '', item: 'School Year', value: schoolYear },
        { category: '', item: '', value: '' },
        { category: 'Statistics', item: 'Total Schedule Entries', value: stats.totalEntries.toString() },
        { category: '', item: 'Unique Subjects', value: stats.totalSubjects.toString() },
        { category: '', item: 'Unique Teachers', value: stats.totalTeachers.toString() },
        { category: '', item: 'Unique Rooms', value: stats.totalRooms.toString() },
        { category: '', item: 'Unique Sections', value: stats.totalSections.toString() },
        { category: '', item: 'Total Units', value: stats.totalUnits.toString() },
        { category: '', item: '', value: '' },
    ];

    // Add teacher breakdown
    teachers.forEach(teacher => {
        const teacherUnits = entries
            .filter(e => e.teacher_id === teacher.pscs_id)
            .reduce((total, entry) => {
                const subject = subjects.find(s => s.course_code === entry.subject_id);
                return total + (subject?.lecture_units || 0) + (subject?.lab_units || 0);
            }, 0);

        if (teacherUnits > 0) {
            summaryData.push({
                category: 'Teacher Breakdown',
                item: teacher.name,
                value: `${teacherUnits} (${teacher.employment_type})`
            });
        }
    });

    // Add data to worksheet
    summaryData.forEach((data, index) => {
        worksheet.addRow(data);

        const row = worksheet.getRow(index + 3);
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Style category headers
        if (data.category && data.category !== '') {
            const categoryCell = row.getCell(1);
            categoryCell.font = { bold: true };
            categoryCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F0F0' }
            };
        }
    });
}