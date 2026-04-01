"use client"
import {
    Button,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Table,
    TableBody, TableCell, TableHead,
    TableHeadCell,
    TableRow,
    Label,
    TextInput, Select, Toast,
    ToastToggle, Tooltip, Pagination, Progress
} from "flowbite-react";
import {useEffect, useRef, useState} from "react";
import {
    HiCheck,
    HiExclamation,
    HiOutlineExclamationCircle,
    HiOutlineTrash,
    HiSearch
} from "react-icons/hi";
import {deleteRoom, fetchRooms, fetchRoomsCount, insertRoom, updateRoom} from "@/services/userService";

export default function RoomManager() {
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [warningType, setWarningType] = useState(""); // Track What warning will show
    const [selectedRoom, setSelectedRoom] = useState(0); // Track the room being edited
    const [roomNameVal, setRoomNameVal] = useState("");
    const [roomTypeVal, setRoomTypeVal] = useState("Lecture");
    const [showToast, setShowToast] = useState(false);
    const [activeChanges, setActiveChanges] = useState(false); // Track if there are changes in edit to toggle between cancel and discard
    const AddModalRoomNameInput = useRef<HTMLInputElement>(null); // for initialFocus of AddModal
    const EditModalRoomNameInput = useRef<HTMLInputElement>(null); // for initialFocus of EditModal
    const [progress, setProgress] = useState(100); // Toast progress bar
    const [search, setSearch] = useState("");
    const [rooms, setRooms] = useState([]);

    // pagination consts
    const [currentPage, setCurrentPage] = useState(1);
    const [rowCount, setrowCount] = useState(1);
    const itemsPerPage = 10;
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
    }

    const loadRowCount = async () => {
        const rowCount = await fetchRoomsCount(search);

        console.log(`[DATA_LIFECYCLE]: Total matching rooms in DB: ${rowCount}`);
        setrowCount(rowCount);
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

        console.log(`[UI_ACTION]: Submitting new room: "${roomNameVal}" (${roomTypeVal})`);

        const stat = await insertRoom(roomNameVal, roomTypeVal);

        console.log(`[API_RESPONSE]: Insert Room returned status: ${stat}`);

        setStatusCode(stat);
        setShowToast(true);

        if (stat === "201") {
            console.log("[UI_UPDATE]: Room created successfully. Clearing form and refreshing list.");
            discardEntry();
            setSearch("");
            loadRowCount();
            loadInitialData();
        } else {
            console.error(`[UI_ERROR]: Room creation failed with status: ${stat}`);
        }
    }

    async function updateEntry() {
        const r_id = selectedRoom;
        const r_name = roomNameVal;
        const r_type = roomTypeVal;

        console.log(`[UI_ACTION]: Initiating update for Room ID: ${r_id}`);

        const stat = await updateRoom(r_id, r_name, r_type);

        console.log(`[API_RESPONSE]: Update Room ${r_id} returned status: ${stat}`);

        setStatusCode(stat);
        setShowToast(true);

        if (stat === "200") {
            console.log(`[UI_UPDATE]: Update successful. Resetting view and refreshing data.`);
            discardEntry();
            setSearch("");
            loadRowCount();
            loadInitialData();
        } else {
            console.warn(`[UI_WARN]: Update failed. No UI refresh triggered.`);
        }
    }

    async function deleteRow() {
        const id = selectedRoom;

        console.log(`[UI_ACTION]: Initiating delete for Room ID: ${id}`);

        const stat = await deleteRoom(id);

        console.log(`[API_RESPONSE]: Delete Room ${id} returned status: ${stat}`);

        setStatusCode(stat);
        setShowToast(true);

        if (stat === "204") {
            console.log(`[UI_UPDATE]: Deletion successful. Resetting view and refreshing data.`);
            discardEntry();
            setSearch("");
            loadRowCount();
            loadInitialData();
        } else {
            console.warn(`[UI_WARN]: Delete failed. No UI refresh triggered.`);
        }
    }

    /** Updates **/
    useEffect(() => { // Fetching Rows
        loadRowCount()
        loadInitialData();
    }, [currentPage, search]);

    useEffect(() => { // Toast
        if (showToast) {
            console.log(`[UI_TOAST]: Toast appeared. Status: ${statusCode}. Starting 5s countdown.`);

            setProgress(100);
            loadRowCount();

            const interval = setInterval(() => {
                setProgress((prev) => {
                    const nextValue = Math.max(0, prev - (100 / (5000 / 50)));
                    return nextValue;
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
        setCurrentPage(1);
    }, [search]);

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
        <div className="p-8 h-full w-full overflow-x-auto font-sans w-180">
            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-4 font-bold text-2xl"}>Manage Rooms:</h1>
                <div className={"flex space-x-3"}>
                    <Button color={"alternative"}>Export</Button>
                    <Button onClick={() => setAddModal(true)}>Add Room</Button>
                </div>
            </div>

            {/* Searchbox*/}
            <TextInput
                className="mb-4 w-62"
                placeholder="Search..."
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/* Table */}
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

            {/* Pagination */}
            <div className={"mt-6"}>
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
                       ${statusCode == "409"? "bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200":null}
                       ${statusCode == "500"? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200":null}
                    `}>
                        {["200", "201", "204"].includes(statusCode) && (
                            <HiCheck className="h-5 w-5" />
                        )}
                        {statusCode == "409"? (<HiExclamation className="h-5 w-5" />):null}
                        {statusCode == "500"? (<HiExclamation className="h-5 w-5" />):null}
                        {["404", "409", "500"].includes(statusCode) && (
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
        </div>
    );
}
