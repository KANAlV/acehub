"use client";

import { useState, useEffect } from "react";
import {
    Button,
    Tabs,
    TabItem,
    TextInput,
    Label,
    Card,
    Table,
    Modal,
    TableHead, TableHeadCell, ModalBody, TableBody, TableRow, TableCell, ModalHeader, ModalFooter,
    Toast, ToastToggle, Progress, Spinner, Select
} from "flowbite-react";
import { 
    HiPlus, HiTrash, HiSave, HiClock, HiUserGroup, HiAcademicCap, HiCog, 
    HiDownload, HiUpload, HiCheck, HiExclamation 
} from "react-icons/hi";
import { 
    deleteBreakPeriod, deletePreset, fetchAuthorizedAccounts, fetchBreakPeriods, 
    fetchPresets, fetchSystemSettings, insertBreakPeriod, savePreset, 
    updateAccountRole, updateBreakPeriod, updateSystemSetting 
} from "@/services/userService.ts";

export default function Settings() {
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [activeTab, setActiveTab] = useState(0);
    const [showToast, setShowToast] = useState(false);
    const [statusCode, setStatusCode] = useState("200");
    const [progress, setProgress] = useState(100);

    // Settings State
    const [facultyLoad, setFacultyLoad] = useState({ FT: 24, PTFL: 18, PT: 12 });
    const [maxStudents, setMaxStudents] = useState(40);
    const [breakPeriods, setBreakPeriods] = useState<any[]>([]);
    const [authorizedAccounts, setAuthorizedAccounts] = useState<any[]>([]);
    const [presets, setPresets] = useState<any[]>([]);
    const [activePresetId, setActivePresetId] = useState<string>('current');

    // Modal State
    const [showAddBreakModal, setShowAddBreakModal] = useState(false);
    const [editingBreak, setEditingBreak] = useState<any>(null);
    const [newBreak, setNewBreak] = useState({ dayOfWeek: "", startTime: "", endTime: "", description: "" });
    
    const [showAddAccountModal, setShowAddAccountModal] = useState(false);
    const [newAccount, setNewAccount] = useState({ email: "", role: "Faculty" });
    
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState("");

    const STATUS_MESSAGES = {
        "200": "Operation completed successfully",
        "201": "Created successfully",
        "204": "Deleted successfully",
        "400": "Bad request - Please check your input",
        "409": "Conflict - Item already exists",
        "500": "Server error - Please try again"
    };

    const timeOptions = [
        "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
        "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
        "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
        "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"
    ];

    /** Data Loading **/
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [settings, breaks, accounts, availablePresets] = await Promise.all([
                fetchSystemSettings(),
                fetchBreakPeriods(),
                fetchAuthorizedAccounts(),
                fetchPresets()
            ]);

            if (settings.facultyLoad) setFacultyLoad(settings.facultyLoad);
            if (settings.maxStudents) setMaxStudents(settings.maxStudents);
            if (settings.activePresetId) setActivePresetId(settings.activePresetId);
            
            setBreakPeriods(breaks);
            setAuthorizedAccounts(accounts);
            setPresets(availablePresets);
        } catch (error) {
            triggerNotification("500");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAllData(); }, []);

    const triggerNotification = (code: string) => {
        setStatusCode(code);
        setShowToast(true);
        setProgress(100);
    };

    useEffect(() => {
        if (showToast) {
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 50);
            const timer = setTimeout(() => setShowToast(false), 2500);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [showToast]);

    /** Actions **/
    const handleSaveFacultyLoad = async () => {
        const res = await updateSystemSetting('facultyLoad', facultyLoad);
        triggerNotification(res);
    };

    const handleSaveMaxStudents = async () => {
        const res = await updateSystemSetting('maxStudents', maxStudents);
        triggerNotification(res);
    };

    const handleAddBreak = async () => {
        const res = await insertBreakPeriod(newBreak.dayOfWeek, newBreak.startTime, newBreak.endTime, newBreak.description);
        if (res === "201") {
            setNewBreak({ dayOfWeek: "", startTime: "", endTime: "", description: "" });
            setShowAddBreakModal(false);
            loadAllData();
        }
        triggerNotification(res);
    };

    const handleUpdateBreak = async () => {
        const res = await updateBreakPeriod(editingBreak.id, newBreak.dayOfWeek, newBreak.startTime, newBreak.endTime, newBreak.description);
        if (res === "200") {
            setEditingBreak(null);
            setShowAddBreakModal(false);
            loadAllData();
        }
        triggerNotification(res);
    };

    const handleDeleteBreak = async (id: number) => {
        const res = await deleteBreakPeriod(id);
        if (res === "204") loadAllData();
        triggerNotification(res);
    };

    const handleUpdateRole = async (id: number, role: string) => {
        const res = await updateAccountRole(id, role);
        if (res === "200") loadAllData();
        triggerNotification(res);
    };

    const handleSavePreset = async () => {
        const data = { facultyLoad, maxStudents };
        const res = await savePreset(newPresetName, data);
        if (res === "201") {
            setShowSavePresetModal(false);
            setNewPresetName("");
            loadAllData();
        }
        triggerNotification(res);
    };

    const handleLoadPreset = async (preset: any) => {
        if (preset.data.facultyLoad) setFacultyLoad(preset.data.facultyLoad);
        if (preset.data.maxStudents) setMaxStudents(preset.data.maxStudents);
        setActivePresetId(preset.preset_name);
        await updateSystemSetting('activePresetId', preset.preset_name);
        triggerNotification("200");
    };

    const handleDeletePresetAction = async (name: string) => {
        const res = await deletePreset(name);
        if (res === "204") loadAllData();
        triggerNotification(res);
    };

    return (
        <div className="p-8 h-full w-full overflow-y-auto font-sans">
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl" />
                </div>
            )}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Configure global parameters and user access</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                    <span className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">Active Preset</span>
                    <p className="text-sm font-semibold text-blue-900 dark:text-white">{activePresetId}</p>
                </div>
            </div>

            <Tabs aria-label="Settings categories" variant="underline">
                {/* Break Periods */}
                <TabItem title="Break Periods" icon={HiClock}>
                    <Card className="mt-6 border-none shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">Manage Mandatory Breaks</h3>
                            <Button size="sm" onClick={() => { setEditingBreak(null); setShowAddBreakModal(true); }}>
                                <HiPlus className="mr-2" /> Add Period
                            </Button>
                        </div>
                        <Table hoverable>
                            <TableHead>
                                <TableRow>
                                    <TableHeadCell>Day</TableHeadCell>
                                    <TableHeadCell>Start</TableHeadCell>
                                    <TableHeadCell>End</TableHeadCell>
                                    <TableHeadCell>Description</TableHeadCell>
                                    <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                                </TableRow>
                            </TableHead>
                            <TableBody className="divide-y">
                                {breakPeriods.map((period) => (
                                    <TableRow key={period.id}>
                                        <TableCell className="capitalize font-medium">{period.day_of_week}</TableCell>
                                        <TableCell>{period.start_time}</TableCell>
                                        <TableCell>{period.end_time}</TableCell>
                                        <TableCell className="text-gray-500">{period.description || "-"}</TableCell>
                                        <TableCell>
                                            <div className="flex space-x-2 justify-end">
                                                <Button color="alternative" size="xs" onClick={() => {
                                                    setEditingBreak(period);
                                                    setNewBreak({
                                                        dayOfWeek: period.day_of_week,
                                                        startTime: period.start_time,
                                                        endTime: period.end_time,
                                                        description: period.description
                                                    });
                                                    setShowAddBreakModal(true);
                                                }}>Edit</Button>
                                                <Button color="red" size="xs" onClick={() => handleDeleteBreak(period.id)}>
                                                    <HiTrash />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabItem>

                {/* Faculty Load */}
                <TabItem title="Faculty Load" icon={HiAcademicCap}>
                    <Card className="mt-6 border-none shadow-sm max-w-2xl">
                        <h3 className="text-lg font-bold mb-4">Teaching Load Parameters</h3>
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <Label htmlFor="ft">Full-Time (FT) Max Load</Label>
                                <TextInput id="ft" type="number" value={facultyLoad.FT} onChange={e => setFacultyLoad({...facultyLoad, FT: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <Label htmlFor="ptfl">Part-Time Full Load (PTFL)</Label>
                                <TextInput id="ptfl" type="number" value={facultyLoad.PTFL} onChange={e => setFacultyLoad({...facultyLoad, PTFL: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <Label htmlFor="pt">Part-Time (PT)</Label>
                                <TextInput id="pt" type="number" value={facultyLoad.PT} onChange={e => setFacultyLoad({...facultyLoad, PT: parseInt(e.target.value)})} />
                            </div>
                            <Button className="mt-4" onClick={handleSaveFacultyLoad}><HiSave className="mr-2" /> Save Load Configuration</Button>
                        </div>
                    </Card>
                </TabItem>

                {/* Class Settings */}
                <TabItem title="Class Settings" icon={HiUserGroup}>
                    <Card className="mt-6 border-none shadow-sm max-w-md">
                        <h3 className="text-lg font-bold mb-4">Enrollment Constraints</h3>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="maxStudents">Max Students per Section</Label>
                                <TextInput id="maxStudents" type="number" value={maxStudents} onChange={e => setMaxStudents(parseInt(e.target.value))} />
                            </div>
                            <Button onClick={handleSaveMaxStudents}><HiSave className="mr-2" /> Save Constraints</Button>
                        </div>
                    </Card>
                </TabItem>

                {/* Account Management */}
                <TabItem title="Users & Roles" icon={HiCog}>
                    <Card className="mt-6 border-none shadow-sm">
                        <h3 className="text-lg font-bold mb-4">Access Control</h3>
                        <Table hoverable>
                            <TableHead>
                                <TableRow>
                                    <TableHeadCell>User Email</TableHeadCell>
                                    <TableHeadCell>Current Role</TableHeadCell>
                                    <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                                </TableRow>
                            </TableHead>
                            <TableBody className="divide-y">
                                {authorizedAccounts.map(account => (
                                    <TableRow key={account.id}>
                                        <TableCell className="font-medium">{account.email}</TableCell>
                                        <TableCell>
                                            <Select value={account.role} onChange={(e) => handleUpdateRole(account.id, e.target.value)}>
                                                <option value="Faculty">Faculty</option>
                                                <option value="Administrator">Administrator</option>
                                                <option value="Scheduler">Scheduler</option>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right italic text-gray-400 text-xs">
                                            Role changes apply on next login
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabItem>

                {/* Presets */}
                <TabItem title="Presets" icon={HiDownload}>
                    <Card className="mt-6 border-none shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">Environment Presets</h3>
                            <Button onClick={() => setShowSavePresetModal(true)}>
                                <HiUpload className="mr-2" /> Save Current Snapshot
                            </Button>
                        </div>
                        <Table hoverable>
                            <TableHead>
                                <TableRow>
                                    <TableHeadCell>Preset Name</TableHeadCell>
                                    <TableHeadCell>Date Saved</TableHeadCell>
                                    <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                                </TableRow>
                            </TableHead>
                            <TableBody className="divide-y">
                                {presets.map((preset) => (
                                    <TableRow key={preset.preset_name}>
                                        <TableCell className="font-bold">{preset.preset_name}</TableCell>
                                        <TableCell>{new Date(preset.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex space-x-2 justify-end">
                                                <Button size="xs" color="alternative" onClick={() => handleLoadPreset(preset)}>
                                                    <HiDownload className="mr-2" /> Load
                                                </Button>
                                                <Button size="xs" color="red" onClick={() => handleDeletePresetAction(preset.preset_name)}>
                                                    <HiTrash />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabItem>
            </Tabs>

            {/* Modals */}
            <Modal show={showAddBreakModal} onClose={() => setShowAddBreakModal(false)}>
                <ModalHeader>{editingBreak ? 'Edit Break' : 'Add New Break'}</ModalHeader>
                <ModalBody className="space-y-4">
                    <div>
                        <Label>Day of Week</Label>
                        <Select value={newBreak.dayOfWeek} onChange={e => setNewBreak({...newBreak, dayOfWeek: e.target.value})}>
                            <option value="">Select Day</option>
                            <option value="monday">Monday</option>
                            <option value="tuesday">Tuesday</option>
                            <option value="wednesday">Wednesday</option>
                            <option value="thursday">Thursday</option>
                            <option value="friday">Friday</option>
                            <option value="saturday">Saturday</option>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Start Time</Label>
                            <Select value={newBreak.startTime} onChange={e => setNewBreak({...newBreak, startTime: e.target.value})}>
                                <option value="">Start</option>
                                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                        <div>
                            <Label>End Time</Label>
                            <Select value={newBreak.endTime} onChange={e => setNewBreak({...newBreak, endTime: e.target.value})}>
                                <option value="">End</option>
                                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label>Description</Label>
                        <TextInput value={newBreak.description} onChange={e => setNewBreak({...newBreak, description: e.target.value})} placeholder="e.g. Lunch" />
                    </div>
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => setShowAddBreakModal(false)}>Cancel</Button>
                    <Button onClick={editingBreak ? handleUpdateBreak : handleAddBreak}>
                        {editingBreak ? 'Update' : 'Add Period'}
                    </Button>
                </ModalFooter>
            </Modal>

            <Modal show={showSavePresetModal} onClose={() => setShowSavePresetModal(false)}>
                <ModalHeader>Save Preset</ModalHeader>
                <ModalBody>
                    <Label>Preset Name</Label>
                    <TextInput value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="e.g. 2nd Sem 2024" />
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => setShowSavePresetModal(false)}>Cancel</Button>
                    <Button onClick={handleSavePreset}>Save Snapshot</Button>
                </ModalFooter>
            </Modal>

            {/* Notifications */}
            <Toast className={`fixed z-60 bottom-10 right-10 transition-all ${showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center">
                    <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusCode.startsWith('2') ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
                        {statusCode.startsWith('2') ? <HiCheck className="h-5 w-5" /> : <HiExclamation className="h-5 w-5" />}
                    </div>
                    <div className="ml-3 text-sm font-normal">
                        {STATUS_MESSAGES[statusCode as keyof typeof STATUS_MESSAGES] || "Error occurred"}
                    </div>
                    <ToastToggle onDismiss={() => setShowToast(false)} />
                </div>
                <Progress progress={progress} size="sm" className="mt-2" color={statusCode.startsWith('2') ? "green" : "red"} />
            </Toast>
        </div>
    );
}
