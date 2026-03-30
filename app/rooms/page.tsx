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
    ToastToggle, Tooltip
} from "flowbite-react";
import {useEffect, useRef, useState} from "react";
import {
    HiCheck,
    HiExclamation,
    HiOutlineExclamationCircle,
    HiOutlineTrash,
    HiQuestionMarkCircle,
    HiSearch
} from "react-icons/hi";
import {fetchRooms, insertRoom} from "@/services/userService";

export default function RoomManager() {
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(""); // Track the room being edited
    const [warningType, setWarningType] = useState(""); // Track What warning will show
    const [roomNameVal, setRoomNameVal] = useState("");
    const [roomTypeVal, setRoomTypeVal] = useState("Lecture");
    const [showToast, setShowToast] = useState(false);
    const [activeChanges, setActiveChanges] = useState(false); // Track if there are changes in edit to toggle between cancel and discard
    const AddModalRoomNameInput = useRef<HTMLInputElement>(null); // for initialFocus of AddModal
    const EditModalRoomNameInput = useRef<HTMLInputElement>(null); // for initialFocus of EditModal
    const [statusCode, setStatusCode] = useState("");
    const [search, setSearch] = useState("");
    const [rooms, setRooms] = useState([]);

    // // Test Data
    // const [rooms, setRooms] = useState([
    //     { id: 1, floor: 1, room_name: 'Comlab 1', room_type: 'Computer Lab' },
    //     { id: 2, floor: 2, room_name: '101', room_type: 'Lecture' }
    // ]);
    // // /Test Data

    useEffect(() => {
        const loadInitialData = async () => {
            const data = await fetchRooms();
            setRooms(data);
        };
        loadInitialData();
    }, []);

    const RoomTableRow = ({ room }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell>{room.floor}</TableCell>
                <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {room.room_name}
                </TableCell>
                <TableCell>{room.room_type}</TableCell>
                <TableCell>
                    <Button color="alternative" onClick={() => editModalValue(room.id)}>
                        Edit
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    function editModalValue(id: number) {
        setSelectedRoom(rooms.find(r => r.id === id).id);
        setRoomNameVal(rooms.find(r => r.id === id).room_name);
        setRoomTypeVal(rooms.find(r => r.id === id).room_type)
        setEditModal(true);
    }

    function showWarning(color: string) {
        setWarningType(color);
        setOpenWarningModal(true);
    }

    function discardEntry() {
        setSelectedRoom(null);
        setRoomNameVal(null);
        setOpenWarningModal(false);
        setEditModal(false);
        setActiveChanges(false);
        setAddModal(false);
    }

    // Queries

    async function submitRoom() {
        if (!roomNameVal || !roomTypeVal) {
            console.error("Missing values!");
            return;
        }

        const stat = await insertRoom(roomNameVal, roomTypeVal);
        setStatusCode(stat);
        setShowToast(true);

        if (stat === "201") {
            discardEntry();

            const data = await fetchRooms();
            setRooms(data);
        }
    }

    const handleSearch = async (e: React.SyntheticEvent) => {
        // This stops the page from refreshing
        e.preventDefault();

        // Ensure we send a string to your service
        const searchTerm = search || "";

        const data = await fetchRooms(searchTerm);
        setRooms(data);
    };

    function deleteRow() {


        discardEntry();
    }

    return (
        <div className="p-8 font-sans">
            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-8 font-bold text-2xl"}>Manage Rooms:</h1>
                <div className={"flex space-x-3"}>
                    <Button color={"alternative"}>Export</Button>
                    <Button onClick={() => setAddModal(true)}>Add Room</Button>
                </div>
            </div>

            {/* Searchbox*/}
            <form onSubmit={handleSearch} className="flex space-x-2">
                <TextInput
                    className="mb-4 w-62"
                    placeholder="Search..."
                    value={search || ""}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <Button type="submit" color="alternative">
                    <HiSearch/>
                </Button>
            </form>

            <Table hoverable>
                <TableHead>
                    <TableRow>
                        <TableHeadCell>Floor</TableHeadCell>
                        <TableHeadCell>Room</TableHeadCell>
                        <TableHeadCell>Type</TableHeadCell>
                        <TableHeadCell>
                            <span className="sr-only">Edit</span>
                        </TableHeadCell>
                    </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                    {rooms.map((room) => (
                        <RoomTableRow key={room.id} room={room} />
                    ))}
                </TableBody>
            </Table>

        {/*  Modals  */}
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
                            <> {/* Discard Confirmation */}
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
                            </>)
                        }
                    </div>
                </ModalBody>
            </Modal>

            {/* Toast */}
            {showToast && (
                <Toast hidden={!showToast} className={"fixed z-60 bottom-10 right-10"}>
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       ${statusCode == "201"? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200":null}
                       ${statusCode == "500"? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200":null}
                    `}>
                        {statusCode == "201"? (<HiCheck className="h-5 w-5" />):null}
                        {statusCode == "500"? (<HiExclamation className="h-5 w-5" />):null}
                    </div>
                    <div className="ml-3 text-sm font-normal">
                        {statusCode == "201"? "Saved successfully.":null}
                        {statusCode == "500"? "Internal Server Error.":null}
                    </div>
                    <ToastToggle onDismiss={() => setShowToast(false)} />
                </Toast>
            )}
        </div>
    );
}
