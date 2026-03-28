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
    TextInput, Dropdown, DropdownItem, Select
} from "flowbite-react";
import {useState} from "react";
import {HiOutlineExclamationCircle} from "react-icons/hi";
import {FaSave} from "react-icons/fa";

export default function RoomManager() {
    const [openModal, setOpenModal] = useState(false);
    const [openWarningModal, setOpenWarningModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null); // Track the room being edited
    const [warningType, setWarningType] = useState(null); // Track What warning will show

    // Test Data
    const [rooms, setRooms] = useState([
        { id: 1, floor: 1, room_name: 'Comlab 1', type: 'Computer Lab' },
        { id: 2, floor: 2, room_name: '101', type: 'Lecture' }
    ]);
    // /Test Data

    const RoomTableRow = ({ room }) => {
        return (
            <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
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
        setOpenModal(true);
        setSelectedRoom(id);
    }

    function showWarning(color: string) {
        setWarningType(color);
        setOpenWarningModal(true);
    }

    return (
        <div className="p-8 font-sans">
            <div className={"flex items-center justify-between"}>
                <h1 className={"my-6 font-bold text-2xl"}>Manage Rooms:</h1>
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
                <ModalHeader>Editing Room: {rooms[selectedRoom]?.room_name}</ModalHeader>
                <ModalBody>
                    <div className="grid grid-cols-3 gap-4 space-y-6">
                        <div>
                            <div className="mb-2 block">
                                <Label htmlFor="floor">Floor</Label>
                            </div>
                            <TextInput id="floor" type="number" placeholder="1" required />
                        </div>
                        <div className={"col-span-2"}>
                            <div className="mb-2 block">
                                <Label htmlFor="roomName">Room Name</Label>
                            </div>
                            <TextInput id="roomName" type="email" placeholder="101" required />
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
                    <Button color="alternative" onClick={() => showWarning("red")}>
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
                            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                Are you sure you want to discard all changes?
                            </h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                    No, cancel
                                </Button>
                                <Button color="red" onClick={() => setOpenWarningModal(false)}>
                                    Yes, I'm sure
                                </Button>
                            </div>
                            </>):(<>
                            <FaSave className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
                            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
                                Save all changes?
                            </h3>
                            <div className="flex justify-center gap-4">
                                <Button color="alternative" onClick={() => setOpenWarningModal(false)}>
                                    No, cancel
                                </Button>
                                <Button color="default" onClick={() => setOpenWarningModal(false)}>
                                    Yes, I'm sure
                                </Button>
                            </div>
                        </>)}
                    </div>
                </ModalBody>
            </Modal>
        </div>
    );
}
