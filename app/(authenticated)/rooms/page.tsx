"use client"
import {
    Button,
    Dropdown,
    DropdownItem,
    Label,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Pagination,
    Progress,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    TextInput,
    Toast,
    ToastToggle
} from "flowbite-react";
import React, {useEffect, useRef, useState} from "react";
import {HiCheck, HiExclamation, HiOutlineExclamationCircle, HiOutlineTrash} from "react-icons/hi";
import {deleteRoom, fetchRooms, fetchRoomsCount, getAllRoomsData, insertRoom, updateRoom} from "@/services/userService.ts";

export default function RoomManager() {
    const [loading, setLoading] = useState(true); // spinner state
    const [rooms, setRooms] = useState([]); // room rows are stored here
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI consts
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [warningType, setWarningType] = useState(""); // Track What warning will show

    const [activeChanges, setActiveChanges] = useState(false); // Track if there are changes in edit to toggle between cancel and discard
    const AddModalRoomNameInput = useRef<HTMLInputElement>(null); // for initialFocus of AddModal
    const EditModalRoomNameInput = useRef<HTMLInputElement>(null); // for initialFocus of EditModal

    const [showToast, setShowToast] = useState(false);
    const [progress, setProgress] = useState(100); // Toast progress bar

    // form useStates
    const [selectedRoom, setSelectedRoom] = useState(0); // Track the room being edited
    const [roomNameVal, setRoomNameVal] = useState("");
    const [roomTypeVal, setRoomTypeVal] = useState("Lecture");

    // Search
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // pagination consts
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setRowCount] = useState(1);
    const totalPageCount = Math.ceil(rowCount / itemsPerPage);
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, rowCount);  // Math.min to ensure not to show a number higher than the total rows

    //Return Status
    const [statusCode, setStatusCode] = useState("");
    const STATUS_MESSAGES = {
        "200": "Update successful.",
        "201": "Room created successfully.",
        "204": "Room deleted successfully.",
        "400": "Invalid data provided.",
        "404": "Room not found.",
        "409": "Conflict: This name is already taken.",
        "500": "Server error. Please try again later."
    };

    /** UI Functions **/
    function editModalValue(id: number) {
        const room = rooms.find(r => r.room_id == id);

        if (!room) {
            console.error(`[UI_ERROR]: Could not find room with ID ${id} in local state.`);
            return;
        }

        console.log(`[UI_ACTION]: Opening Edit Modal for Room: "${room.room_name}" (ID: ${id})`);

        setSelectedRoom(room.room_id);
        setRoomNameVal(room.room_name);
        setRoomTypeVal(room.room_type);
        setEditModal(true);
    }

    function showWarning(color: string) {
        console.log(`[UI_INTERRUPT]: Showing warning modal. Level: ${color}`);
        setWarningType(color);
        setOpenWarningModal(true);
    }

    function discardEntry() {
        console.log("[UI_ACTION]: Discarding entry and closing all modals. Resetting form state.");
        setSelectedRoom(null);
        setRoomNameVal(null);
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    /** Queries **/
    const loadInitialData = async () => {
        console.log(`[DATA_LIFECYCLE]: Fetching rooms for Page ${currentPage} (Search: "${search || 'none'}")`);

        const data = await fetchRooms(search, currentPage);

        console.log(`[DATA_LIFECYCLE]: Rooms loaded. Count: ${data.length}`);
        setRooms(data);
        setLoading(false);
    }

    const loadRowCount = async () => {
        const rowCount = await fetchRoomsCount(search);

        console.log(`[DATA_LIFECYCLE]: Total matching rooms in DB: ${rowCount}`);
        setRowCount(rowCount);
    }

    const onPageChange = (page: number) => {
        console.log(`[UI_NAVIGATION]: Moving to Page ${page}`);
        setCurrentPage(page);
    };

    async function submitRoom() {
        if (!roomNameVal || !roomTypeVal) {
            console.warn("[UI_VALIDATION]: Submission blocked. Missing Room Name or Type.");
            return;
        }

        setLoading(true);

        console.log(`[UI_ACTION]: Submitting new room: "${roomNameVal}" (${roomTypeVal})`);

        const stat = await insertRoom(roomNameVal, roomTypeVal);

        console.log(`[API_RESPONSE]: Insert Room returned status: ${stat}`);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "201") {
            console.log("[UI_UPDATE]: Room created successfully. Clearing form and refreshing list.");
            discardEntry();
            setSearch("");
            await loadRowCount();
            await loadInitialData();
        } else {
            console.error(`[UI_ERROR]: Room creation failed with status: ${stat}`);
        }
    }

    async function updateEntry() {
        const r_id = selectedRoom;
        const r_name = roomNameVal;
        const r_type = roomTypeVal;
        setLoading(true);

        console.log(`[UI_ACTION]: Initiating update for Room ID: ${r_id}`);

        const stat = await updateRoom(r_id, r_name, r_type);

        console.log(`[API_RESPONSE]: Update Room ${r_id} returned status: ${stat}`);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "200") {
            console.log(`[UI_UPDATE]: Update successful. Resetting view and refreshing data.`);
            discardEntry();
            setSearch("");
            await loadRowCount();
            await loadInitialData();
        } else {
            console.warn(`[UI_WARN]: Update failed. No UI refresh triggered.`);
        }
    }

    async function deleteRow() {
        const id = selectedRoom;
        setLoading(true);

        console.log(`[UI_ACTION]: Initiating delete for Room ID: ${id}`);

        const stat = await deleteRoom(id);

        console.log(`[API_RESPONSE]: Delete Room ${id} returned status: ${stat}`);

        setStatusCode(stat);
        setLoading(false);
        setShowToast(true);

        if (stat === "204") {
            console.log(`[UI_UPDATE]: Deletion successful. Resetting view and refreshing data.`);
            discardEntry();
            setSearch("");
            await loadRowCount();
            await loadInitialData();
        } else {
            console.warn(`[UI_WARN]: Delete failed. No UI refresh triggered.`);
        }
    }

    /** Import/Export **/
    async function handleExportToExcel() {
        try {
            const rooms = await getAllRoomsData();

            if (!rooms || rooms.length === 0) {
                return "404";
            }

            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Rooms Inventory');

            worksheet.columns = [
                { header: 'ID', key: 'room_id', width: 10 },
                { header: 'Room Name', key: 'room_name', width: 35 },
                { header: 'Type', key: 'room_type', width: 20 },
                { header: 'Created At', key: 'created_at', width: 25 }
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '2C3E50' }
            };

            worksheet.addRows(rooms);
            worksheet.getColumn('created_at').numFmt = 'yyyy-mm-dd hh:mm';

            worksheet.autoFilter = 'A1:D1';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            saveAs(blob, `Rooms_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            return "200";
        } catch (error) {
            console.error("[EXPORT_UI_ERROR]:", error);
            return "500";
        }
    }

    async function downloadImportTemplate() {
        try {
            console.log("[TEMPLATE_START]: Generating Import Template...");

            // 1. Dynamic Imports
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Import Template');

            // 2. Define Columns
            worksheet.columns = [
                { header: 'Room Name', key: 'name', width: 30 },
                { header: 'Room Type', key: 'type', width: 25 }
            ];

            // 3. Style Header (Green for "Go/Template")
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '16A34A' } // Tailwind green-600
            };

            // 4. Add Sample Row
            worksheet.addRow({ name: 'Example Room 101', type: 'Lecture' });

            // 5. Add Data Validation (The Dropdown Menu in Excel)
            // This ensures the user picks from your specific list
            const typeOptions = [
                'Lecture',
                'Computer Lab',
                'Culinary Lab',
                'Mock Bar',
                'Mock Hotel',
                'Gym',
                'AVR'
            ];

            // Apply validation to the first 100 rows in the 'Type' column (Column B)
            for (let i = 2; i <= 100; i++) {
                worksheet.getCell(`B${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${typeOptions.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Room Type',
                    error: 'Please select a type from the dropdown list.'
                };
            }

            // 6. Generate and Save
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            saveAs(blob, `Room_Import_Template.xlsx`);

            console.log("[TEMPLATE_SUCCESS]: Template downloaded.");
            return "200";
        } catch (error) {
            console.error("[TEMPLATE_ERROR]:", error);
            return "500";
        }
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !e.target) return;

        setLoading(true);

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const worksheet = workbook.getWorksheet(1);
            const rows: { name: string, type: string }[] = [];

            // FORMAT VALIDATION: Ensure headers match
            const firstHeader = worksheet?.getRow(1).getCell(1).value?.toString();
            if (firstHeader !== 'Room Name') {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            worksheet?.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    const name = row.getCell(1).value?.toString().trim();
                    const type = row.getCell(2).value?.toString().trim();
                    if (name && type) rows.push({ name, type });
                }
            });

            if (rows.length === 0) {
                setStatusCode("400");
                setLoading(false);
                setShowToast(true);
                return;
            }

            let hasConflict = false;
            let successCount = 0;

            for (const room of rows) {
                const res = await insertRoom(room.name, room.type);

                if (res === "500") {
                    setStatusCode("500");
                    setLoading(false);
                    setShowToast(true);
                    return; // Kill the process on server error
                }

                if (res === "409") {
                    hasConflict = true;
                } else {
                    successCount++;
                }
            }

            // Logic: If we added at least one thing, call it a success (201)
            // If we added nothing because everything was a duplicate, show 409
            setStatusCode(successCount > 0 ? "201" : "409");
            setLoading(false);
            setShowToast(true);

            await loadRowCount();
            await loadInitialData();

        } catch (error) {
            console.error("[IMPORT_ERROR]:", error);
            setStatusCode("500");
        } finally {
            if (e.target) e.target.value = "";
        }
    }

    /** Updates **/
    useEffect(() => {
        let isCancelled = false; // Cleanup flag to prevent race conditions

        const fetchData = async () => {
            try {
                // Run in parallel to save time
                await Promise.all([
                    loadRowCount(),
                    loadInitialData()
                ]);

                if (isCancelled) {
                    setLoading(false);
                    return;
                }
                console.log("[LIFECYCLE]: Page data refreshed.");
            } catch (error) {
                setLoading(false);
                console.error("[LIFECYCLE_ERROR]: Failed to sync rooms:", error);
            }
        };

        fetchData().catch((err) => {
            setLoading(false);
            console.error("[CRITICAL_ERROR]: Fetch failed in useEffect", err);
        });

        return () => {
            setLoading(false);
            isCancelled = true; // 2. Cancel state updates if component re-renders
        };
    }, [currentPage, debouncedSearch]);

    useEffect(() => { // Toast
        if (showToast) {
            console.log(`[UI_TOAST]: Toast appeared. Status: ${statusCode}. Starting 5s countdown.`);

            setProgress(100);
            loadRowCount().catch(err => console.error("Failed to refresh row count:", err));

            const interval = setInterval(() => {
                setProgress((prev) => {
                    return Math.max(0, prev - (100 / (5000 / 50)));
                });
            }, 50);

            const timeout = setTimeout(() => {
                console.log("[UI_TOAST]: 5s elapsed. Hiding toast automatically.");
                setShowToast(false);
            }, 5000);

            return () => {
                console.log("[UI_TOAST]: Cleaning up timers (Effect reset).");
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [showToast]);

    useEffect(() => { // Resetting Page to 1 When Searching
        setLoading(true);
        setCurrentPage(1);
    }, [debouncedSearch]);

    useEffect(() => { // Adds 1 sec delay to querying while typing
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 1000); // 1000ms = 1 seconds

        return () => {
            clearTimeout(handler); // Cancel the timer if the user types
        };
    }, [search]);

    /** Table Rows **/
    const RoomTableRow = ({ room }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {room.room_name}
                </TableCell>
                <TableCell>{room.room_type}</TableCell>
                <TableCell className={"flex justify-end"}>
                    <Button color="alternative" onClick={() => editModalValue(room.room_id)}>
                        Edit
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="p-8 h-full w-full overflow-x-auto font-sans">
            {/** Loading Spinner **/}
            <div className={`${loading? "":"hidden"} fixed inset-0 z-9999 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm cursor-wait`}>
                {/* The Spinner Container */}
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>

                    {/* Optional: Add a text label to let users know what's happening */}
                    <p className="text-white font-semibold text-lg drop-shadow-md">
                        Syncing Rooms...
                    </p>
                </div>
            </div>

            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-4 font-bold text-2xl"}>Manage Rooms:</h1>
                <div className={"flex space-x-3"}>
                    <Dropdown color={"alternative"} label={"Actions"} dismissOnClick={false}>
                        <DropdownItem onClick={() => downloadImportTemplate()}>Get Import Template</DropdownItem>
                        <DropdownItem onClick={() => fileInputRef.current?.click()}>
                            Import
                        </DropdownItem>
                        <DropdownItem onClick={() => handleExportToExcel()}>Export</DropdownItem>
                    </Dropdown>
                    <Button onClick={() => setAddModal(true)}>Add Room</Button>
                </div>
            </div>

            {/* SearchBox*/}
            <TextInput
                className="mb-4 w-62"
                placeholder="Search..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/* Table */}
            <div className={"w-full md:w-auto h-auto overflow-x-scroll md:overflow-clip"}>
                <Table hoverable>
                    <TableHead>
                        <TableRow>
                            <TableHeadCell>Room</TableHeadCell>
                            <TableHeadCell>Type</TableHeadCell>
                            <TableHeadCell>
                                <span className="sr-only">Edit</span>
                            </TableHeadCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                        {rooms.length > 0 ? (
                            rooms.map((room) => (
                                <RoomTableRow key={room.room_id} room={room}/>
                            ))
                        ) : (
                            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                                <TableCell colSpan={3} className="whitespace-nowrap font-medium text-center text-gray-900 dark:text-white">
                                    No rooms found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className={"mt-6 justify-self-center"}>
                <h1 className="text-center">
                    {rowCount > 0
                        ? `Showing ${startItem} to ${endItem} of ${rowCount} Entries`
                        : ""
                    }
                </h1>
                <div className={`${totalPageCount > 1? "flex":"hidden"} overflow-x-auto sm:justify-center`}>
                    <Pagination currentPage={currentPage} totalPages={totalPageCount == 0? 1:totalPageCount} onPageChange={onPageChange} showIcons />
                </div>
            </div>

            {/* --- Modals --- */}
            {/*  Add Modal  */}
            <Modal size={"sm"} show={addModal} initialFocus={AddModalRoomNameInput} onClose={() => setAddModal(false)}>
                <ModalHeader>Add Room</ModalHeader>
                <ModalBody>
                    <div className="flex gap-4 space-y-6">
                        <div className={"col-span-2"}>
                            <div className="mb-2 block">
                                <Label htmlFor="roomName">Room Name</Label>
                            </div>
                            <TextInput id="roomName" type="text" ref={AddModalRoomNameInput}
                                       placeholder="e.g. 101"
                                       onChange={(e) => {
                                           setRoomNameVal(e.target.value)
                                           setActiveChanges(true)
                                       }}
                                       required />
                        </div>
                    </div>
                    <div className={"flex space-x-2.5"}>
                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="roomType">Room Type</Label>
                            </div>
                            <Select
                                id="roomType"
                                className="w-40"
                                value={roomTypeVal || "Lecture"}
                                onChange={(e) => {
                                    setRoomTypeVal(e.target.value);
                                    setActiveChanges(true);
                                }}
                            >
                                <option value="Lecture">Lecture</option>
                                <option value="Computer Lab">Computer Lab</option>
                                <option value="Culinary Lab">Culinary Lab</option>
                                <option value="Mock Bar">Mock Bar</option>
                                <option value="Mock Hotel">Mock Hotel</option>
                                <option value="Gym">Gym</option>
                                <option value="AVR">AVR</option>
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className={"justify-end"}>
                    {activeChanges == true?(<>
                        <Button color="alternative" onClick={() => showWarning("yellow")}>
                            Discard
                        </Button>
                    </>):(<>
                        <Button color="alternative" onClick={() => discardEntry()}>
                            Cancel
                        </Button>
                    </>)}

                    <Button onClick={() => submitRoom()}>Save</Button>
                </ModalFooter>
            </Modal>

            {/*  Edit Modal  */}
            <Modal size={"sm"} show={editModal} initialFocus={EditModalRoomNameInput} onClose={() => setEditModal(false)}>
                <ModalHeader>Editing Room: {rooms[selectedRoom]?.room_name}</ModalHeader>
                <ModalBody>
                    <div className="flex gap-4 space-y-6">
                        <div className={"col-span-2"}>
                            <div className="mb-2 block">
                                <Label htmlFor="roomName">Room Name</Label>
                            </div>
                            <TextInput id="roomName" type="text" ref={EditModalRoomNameInput}
                                       placeholder="e.g. 101"
                                       value={roomNameVal}
                                       onChange={(e) => {
                                           setRoomNameVal(e.target.value)
                                           setActiveChanges(true)
                                       }}
                                       required />
                        </div>
                    </div>
                    <div className={"flex space-x-2.5"}>
                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="roomType">Room Type</Label>
                            </div>
                            <Select id="roomType"
                                    className={"w-40"}
                                    value={roomTypeVal}
                                    onChange={(e) => {
                                        setRoomTypeVal(e.target.value)
                                        setActiveChanges(true)
                                    }
                                    }>
                                <option>{roomTypeVal}</option>
                                {roomTypeVal != "Lecture"? (<option>Lecture</option>):null}
                                {roomTypeVal != "Computer Lab"? (<option>Computer Lab</option>):null}
                                {roomTypeVal != "Culinary Lab"? (<option>Culinary Lab</option>):null}
                                {roomTypeVal != "Mock Bar"? (<option>Mock Bar</option>):null}
                                {roomTypeVal != "Mock Hotel"? (<option>Mock Hotel</option>):null}
                                {roomTypeVal != "Gym"? (<option>Gym</option>):null}
                                {roomTypeVal != "AVR"? (<option>AVR</option>):null}
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button outline color={"dark"} className={"p-2"} onClick={() => showWarning("red")}>
                        <HiOutlineTrash color={"red"} className={"size-6"}/>
                    </Button>
                    <div className={"flex w-full justify-end space-x-2"}>
                        {activeChanges == true?(<>
                            <Button color="alternative" onClick={() => showWarning("yellow")}>
                                Discard
                            </Button>
                        </>):(<>
                            <Button color="alternative" onClick={() => discardEntry()}>
                                Cancel
                            </Button>
                        </>)}

                        <Button onClick={() => showWarning("default")}>Save</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/*  Warning Modal  */}
            <Modal show={openWarningModal} size="md" onClose={() => setOpenWarningModal(false)} popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        {warningType=="red"?(
                            <> {/* Delete Confirmation */}
                                <HiOutlineTrash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                                <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete this entry?
                                </h3>
                                <div className="flex justify-center gap-4">
                                    <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                        No, cancel
                                    </Button>
                                    <Button color="red" onClick={() => deleteRow()}>
                                        Yes, I'm sure
                                    </Button>
                                </div>
                            </>):(
                                warningType == "yellow"? (<> {/* Discard Confirmation */}
                                    <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                                    <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                        Are you sure you want to discard all changes?
                                    </h3>
                                    <div className="flex justify-center gap-4">
                                        <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                            No, cancel
                                        </Button>
                                        <Button color="yellow" onClick={() => discardEntry()}>
                                            Yes, I'm sure
                                        </Button>
                                    </div>
                                </>):(<> {/* Update Confirmation */}
                                    <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                                    <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                        Are you sure you want to save all changes?
                                    </h3>
                                    <div className="flex justify-center gap-4">
                                        <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                            No, cancel
                                        </Button>
                                        <Button color="default" onClick={() => updateEntry()}>
                                            Yes, I'm sure
                                        </Button>
                                    </div>
                                </>)
                            )
                        }
                    </div>
                </ModalBody>
            </Modal>

            {/* Toast */}
            <Toast className={`fixed block z-60 bottom-10 right-10 transition-opacity duration-500
                ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
                <div className={"flex items-center"}>
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       ${["200", "201", "204"].includes(statusCode) && ("bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200")}
                       ${["400", "409"].includes(statusCode) && ("bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200")}
                       ${statusCode == "500"? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200":null}
                    `}>
                        {["200", "201", "204"].includes(statusCode) && (
                            <HiCheck className="h-5 w-5" />
                        )}
                        {["400", "404", "409", "500"].includes(statusCode) && (
                            <HiExclamation className="h-5 w-5" />
                        )}

                    </div>
                    <div className="ml-3 text-sm font-normal">
                        {STATUS_MESSAGES[statusCode] || "An unknown error occurred."}
                    </div>
                    <ToastToggle onDismiss={() => {
                        console.log("[UI_ACTION]: User manually dismissed the toast.");

                        setShowToast(false);
                        setProgress(0);
                    }} />
                </div>
                <Progress size={"sm"} className={"mt-2 mb-0 pb-0"} progress={progress}/>
            </Toast>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx"
                onChange={handleImport}
            />
        </div>
    );
}