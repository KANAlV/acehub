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
    ToastToggle
} from "flowbite-react";
import {useState} from "react";
import {HiCheck, HiOutlineExclamationCircle, HiOutlineTrash} from "react-icons/hi";
import {FaSave} from "react-icons/fa";

export default function RoomManager() {
    const [openModal, setOpenModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null); // Track the room being edited
    const [warningType, setWarningType] = useState(null); // Track What warning will show
    const [floorNumberVal, setFloorNumberVal] = useState(null);
    const [roomNameVal, setRoomNameVal] = useState(null);
    const [toastState, setToastState] = useState(false);

    // Test Data
    const [rooms, setRooms] = useState([
        { id: 1, floor: 1, room_name: 'Comlab 1', type: 'Computer Lab' },
        { id: 2, floor: 2, room_name: '101', type: 'Lecture' }
    ]);
    // /Test Data

    const RoomTableRow = ({ room }) => {
        return (
            <TableRow className="bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800">
                <TableCell>{room.floor}</TableCell>
                <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {room.room_name}
                </TableCell>
                <TableCell>{room.type}</TableCell>
                <TableCell>
                    <Button color="alternative" onClick={() => editModal(room.id)}>
                        Edit
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    function editModal(id: number) {
        setSelectedRoom(rooms.find(r => r.id === id).id);
        setFloorNumberVal(rooms.find(r => r.id === id).floor);
        setRoomNameVal(rooms.find(r => r.id === id).room_name);
        setOpenModal(true);
    }

    function discardEntry() {
        setSelectedRoom(null);
        setFloorNumberVal(null);
        setRoomNameVal(null);
        setOpenWarningModal(false);
        setOpenModal(false);
    }

    function showWarning(color: string) {
        setWarningType(color);
        setOpenWarningModal(true);
    }

    return (
        <div className="p-8 font-sans">
            <div className={"flex items-center justify-between"}>
                <h1 className={"mb-8 font-bold text-2xl"}>Manage Rooms:</h1>
                <div className={"flex space-x-3"}>
                    <Button color={"alternative"}>Export</Button>
                    <Button>Add Room</Button>
                </div>
            </div>

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
            {/*  Edit Modal  */}
            <Modal size={"sm"} show={openModal} onClose={() => setOpenModal(false)}>
                <div className={"flex grow p-4 w-full items-center border-b border-gray-300 dark:border-gray-700"}>
                    <h1>Editing Room: {rooms[selectedRoom]?.room_name}</h1>
                    <div className={"flex grow justify-end"}>
                        <Button outline color={"dark"} className={"p-2"} onClick={() => showWarning("red")}>
                            <HiOutlineTrash color={"red"} className={"size-6"}/>
                        </Button>
                    </div>
                </div>
                <ModalBody>
                    <div className="grid grid-cols-3 gap-4 space-y-6">
                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="floor">Floor</Label>
                            </div>
                            <TextInput id="floor" type="number"
                                       placeholder="1"
                                       value={floorNumberVal}
                                       onChange={(e) => setFloorNumberVal(e.target.value)}
                                       required />
                        </div>
                        <div className={"col-span-2"}>
                            <div className="mb-2 block">
                                <Label htmlFor="roomName">Room Name</Label>
                            </div>
                            <TextInput id="roomName" type="text"
                                       placeholder="e.g. 101"
                                       value={roomNameVal}
                                       onChange={(e) => setRoomNameVal(e.target.value)}
                                       required />
                        </div>
                        <div className={"col-span-2"}>
                            <div className="mb-2 block">
                                <Label htmlFor="roomType">Room Type</Label>
                            </div>
                            <Select id="roomType">
                                <option>Lecture</option>
                                <option>Lab</option>
                                <option>Gym</option>
                                <option>Other</option>
                            </Select>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className={"justify-end"}>
                    <Button color="alternative" onClick={() => showWarning("yellow")}>
                        Discard
                    </Button>
                    <Button onClick={() => showWarning("default")}>Save</Button>
                </ModalFooter>
            </Modal>

            {/*  Warning Modal  */}
            <Modal show={openWarningModal} size="md" onClose={() => setOpenWarningModal(false)} popup>
                <ModalHeader />
                <ModalBody>
                    <div className="text-center">
                        {warningType=="red"?(<>
                            <HiOutlineTrash color={"red"} className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                Are you sure you want to delete this entry?
                            </h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                    No, cancel
                                </Button>
                                <Button color="red" onClick={() => discardEntry()}>
                                    Yes, I'm sure
                                </Button>
                            </div>
                            </>):(<>
                            <HiOutlineExclamationCircle color={"yellow"} className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
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
                        </>)}
                    </div>
                </ModalBody>
            </Modal>

            {/* Toast */}
            <Toast hidden={!toastState} className={"fixed z-60 bottom-10 right-10"}>
                <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200">
                    <HiCheck className="h-5 w-5" />
                </div>
                <div className="ml-3 text-sm font-normal">Saved successfully.</div>
                <ToastToggle />
            </Toast>
        </div>
    );
}
