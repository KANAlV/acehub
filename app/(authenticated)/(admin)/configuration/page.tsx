"use client";

import {useEffect, useState} from "react";
import {
    Button,
    Card,
    Label,
    List,
    ListItem,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Progress,
    Select,
    Spinner,
    TabItem,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeadCell,
    TableRow,
    Tabs,
    TextInput,
    Toast,
    ToastToggle
} from "flowbite-react";
import {
    HiAcademicCap,
    HiCheck,
    HiClock,
    HiDownload,
    HiExclamation,
    HiOutlinePlus,
    HiOutlineShieldCheck,
    HiPencilAlt,
    HiPlus,
    HiSave,
    HiTrash,
    HiUpload,
    HiUserGroup
} from "react-icons/hi";
import {
    deleteBreakPeriod,
    deleteDropdownValue,
    deletePreset,
    deleteUser,
    fetchAllDropdownValues,
    fetchAllRoles,
    fetchBreakPeriods,
    fetchPresets,
    fetchSystemSettings,
    fetchUserProfilesPaginated,
    getCurrentUser,
    insertBreakPeriod,
    insertUser,
    saveDropdownValue,
    savePreset,
    syncRolesWithDatabase,
    truncateTables,
    updateAccountRole,
    updateBreakPeriod,
    updateSystemSetting
} from "@/services/userService.ts";
import {BsDatabaseDash, BsDatabaseDown} from "react-icons/bs";
import {FaDatabase} from "react-icons/fa";
import {clampNumericValue, sanitizeDropdownValue} from "@/lib/validation";
import {IoMdArrowDropdownCircle} from "react-icons/io";
import {HiExclamationTriangle, HiPlusCircle} from "react-icons/hi2";

type DropdownValue = {
    value: string;
    value_for: string;
};

type Pagination = {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    sortBy: "username" | "email";
    sortDir: "ASC" | "DESC";
}

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [editorId, setEditorId] = useState("")

    // UI State
    const [showToast, setShowToast] = useState(false);
    const [statusCode, setStatusCode] = useState("200");
    const [progress, setProgress] = useState(100);
    const [usersRolePagination, setUsersRolePagination] = useState<Pagination|null>(null);

    // Settings State
    const [facultyLoad, setFacultyLoad] = useState({ FT: 24, PTFL: 18, PT: 12 });
    const [maxStudents, setMaxStudents] = useState(40);
    const [prepLimits, setPrepLimits] = useState({ FT: 6, PTFL: 4, PT: 3 });
    const [overloadMax, setOverloadMax] = useState(6);
    const [breakPeriods, setBreakPeriods] = useState<any[]>([]);
    const [authorizedAccounts, setAuthorizedAccounts] = useState<any[]>([]);
    const [presets, setPresets] = useState<any[]>([]);
    const [activePresetId, setActivePresetId] = useState<string>('current');
    const [dropdownValues, setDropdownValues] = useState<DropdownValue[]>([]);
    const [newDropdownValue, setNewDropdownValue] = useState("")
    const [newDropdownValueFor, setNewDropdownValueFor] = useState("")

    // Modal State
    const [showAddLaboratoryTypeModal, setShowAddLaboratoryTypeModal] = useState(false);
    const [showAddSpecializationTypeModal, setShowAddSpecializationTypeModal] = useState(false);
    const [showAddBreakModal, setShowAddBreakModal] = useState(false);
    const [editingBreak, setEditingBreak] = useState<any>(null);
    const [newBreak, setNewBreak] = useState({ dayOfWeek: "", startTime: "", endTime: "", description: "" });

    const [showAddAccountModal, setShowAddAccountModal] = useState(false);
    const [newAccount, setNewAccount] = useState({ username: "", email: "", role: "" });
    const [showDeleteDropdownModal, setShowDeleteDropdownModal] = useState(false);

    // Truncate Table Modal
    const [showTruncateModal, setShowTruncateModal] = useState(false);
    const [tablesToTruncate, setTablesToTruncate] = useState({
        courses: false,
        rooms: false,
        schedules: false,
        subjects: false,
        teachers: false,
        users: false
    });

    // Role conts
    const [showSavePresetModal, setShowSavePresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState("");
    const [isSuperUser, setIsSuperUser] = useState(false);
    const [userRole, setUserRole] = useState("");

    const [openRoleSaveConfirmationModal, setOpenRoleSaveConfirmationModal] = useState(false);
    const [showRoleWarning, setShowRoleWarning] = useState(false);
    const [roleListLoaded, setRoleListLoaded] = useState(false);
    const [showRoleList, setShowRoleList] = useState(false);
    const [oldRoles, setOldRoles] = useState<any[]>([]);
    const [newRoles, setNewRoles] = useState<any[]>([]);
    const [editingRoleId, setEditingRoleId] = useState<number | string | null>(null);
    const [isNewRoleAdding, setIsNewRoleAdding] = useState(false); // Helps prevent multiple empty row initializations

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
            const [settings, breaks, accounts, availablePresets, ddValues] = await Promise.all([
                fetchSystemSettings(),
                fetchBreakPeriods(),
                handleLoadUsers(),
                fetchPresets(),
                fetchAllDropdownValues()
            ]);

            if (settings.facultyLoad) setFacultyLoad(settings.facultyLoad);
            if (settings.maxStudents) setMaxStudents(settings.maxStudents);
            if (settings.prepLimits) setPrepLimits(settings.prepLimits);
            if (settings.overloadMax) setOverloadMax(settings.overloadMax);
            if (settings.activePresetId) setActivePresetId(settings.activePresetId);
            if (ddValues) setDropdownValues(ddValues);

            setBreakPeriods(breaks);
            setAuthorizedAccounts(accounts);
            setPresets(availablePresets);
        } catch (error) {
            triggerNotification("500");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
        handleFetchRolesData();
        checkUserRole();
    }, []);

    const handleLoadUsers = async () => {
        const res = await fetchUserProfilesPaginated({ page: 1, limit: 10 });

        // Check status code directly
        if (res.status === "200") {
            setUsersRolePagination(res.pagination);
            return res.users;
        } else {
            triggerNotification(res.status); // Triggers toast with "500"
        }
    };

    const checkUserRole = async () => {
        const fetchedUser = await getCurrentUser();
        const edId = fetchedUser.id;
        setEditorId(edId);
        const role = fetchedUser.role;
        setUserRole(role);
    };

    const triggerNotification = (code: string) => {
        setStatusCode(code);
        setShowToast(true);
        setProgress(100);
    };

    useEffect(() => {
        if (showToast) {
            const interval = setInterval(() => setProgress(p => Math.max(0, p - 2)), 50);
            const timer = setTimeout(() => setShowToast(false), 5000);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [showToast]);

    const handlePositiveIntegerInput = (
        value: string,
        maxLimit: number,
        currentValue: string | number, // Added to track the active value before the keypress
        setter: (value: number) => void
    ) => {
        // Pass the currentValue into the validator to allow strict rejection fallbacks
        const sanitized = clampNumericValue(value, maxLimit, currentValue);
        setter(sanitized === '' ? 0 : parseInt(sanitized, 10));
    };

    /** Actions **/
    const handleSaveFacultyLoad = async () => {
        const res = await updateSystemSetting('facultyLoad', facultyLoad);
        triggerNotification(res);
    };

    const handleSaveMaxStudents = async () => {
        const res = await updateSystemSetting('maxStudents', maxStudents);
        triggerNotification(res);
    };

    const handleSavePrepLimits = async () => {
        const res = await updateSystemSetting('prepLimits', prepLimits);
        triggerNotification(res);
    };

    const handleSaveOverloadMax = async () => {
        const res = await updateSystemSetting('overloadMax', overloadMax);
        triggerNotification(res);
    };

    const handleAddBreak = async () => {
        const res = await insertBreakPeriod(newBreak.dayOfWeek, newBreak.startTime, newBreak.endTime, newBreak.description);
        if (res === "201") {
            setNewBreak({ dayOfWeek: "", startTime: "", endTime: "", description: "" });
            setShowAddBreakModal(false);
            await loadAllData();
        }
        triggerNotification(res);
    };

    const handleUpdateBreak = async () => {
        const res = await updateBreakPeriod(editingBreak.id, newBreak.dayOfWeek, newBreak.startTime, newBreak.endTime, newBreak.description);
        if (res === "200") {
            setEditingBreak(null);
            setShowAddBreakModal(false);
            await loadAllData();
        }
        triggerNotification(res);
    };

    const handleDeleteBreak = async (id: number) => {
        const res = await deleteBreakPeriod(id);
        if (res === "204") await loadAllData();
        triggerNotification(res);
    };

    const handleUpdateRole = async (id: string, role: string) => {
        const res = await updateAccountRole(id, role, editorId);
        if (res === "200") await loadAllData();
        triggerNotification(res);
    };

    const handleAddUser = async () => {
        if (!newAccount.email.endsWith("@alabang.sti.edu.ph")) {
            triggerNotification("400");
            return;
        }
        const res = await insertUser(newAccount.username, newAccount.email, newAccount.role, editorId);
        if (res === "201") {
            setShowAddAccountModal(false);
            setNewAccount({ username: "", email: "", role: "" });
            await loadAllData();
        }
        triggerNotification(res);
    };

    const handleDeleteUserAction = async (id: string) => {
        // 1. Guard check prompt confirmation loop
        if (!confirm("Are you sure you want to remove roles from this user?")) return;

        // 2. Dispatch action to the backend service layer
        const res = await deleteUser(id);

        // 3. React to status code pipeline response
        if (res === "204") {
            await loadAllData(); // Refresh list to reflect updates or show the empty state row
        }

        // 4. Fire standard toast notification event
        triggerNotification(res);
    };

    const handleSavePreset = async () => {
        const data = { facultyLoad, maxStudents, prepLimits, overloadMax };
        const res = await savePreset(newPresetName, data);
        if (res === "201") {
            setShowSavePresetModal(false);
            setNewPresetName("");
            await loadAllData();
        }
        triggerNotification(res);
    };

    const handleLoadPreset = async (preset: any) => {
        if (preset.data.facultyLoad) setFacultyLoad(preset.data.facultyLoad);
        if (preset.data.maxStudents) setMaxStudents(preset.data.maxStudents);
        if (preset.data.prepLimits) setPrepLimits(preset.data.prepLimits);
        if (preset.data.overloadMax) setOverloadMax(preset.data.overloadMax);
        setActivePresetId(preset.preset_name);
        await updateSystemSetting('activePresetId', preset.preset_name);
        triggerNotification("200");
    };

    const capitalize = (text: string) => {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    const clearDropdownValues = () => {
        setNewDropdownValue("");
        setNewDropdownValueFor("");
    }

    const resetRolesState = () => {
        setNewRoles([]);
        setRoleListLoaded(false); // Crucial: This ensures a fresh fetch next time they open it
        handleFetchRolesData();
    };

    const handleFetchRolesData = async () => {
        if (!roleListLoaded) {
            try {
                const roles = await fetchAllRoles();
                setOldRoles(roles);
                setNewRoles(roles);
                setRoleListLoaded(true);
            } catch (error) {
                console.error("Error loading roles on demand:", error);
            }
        }
    };

    const handlePermissionToggle = (roleId: number, permissionKey: string) => {
        setNewRoles((prevRoles) =>
            prevRoles.map((role) =>
                role.role_id === roleId
                    ? { ...role, [permissionKey]: !role[permissionKey] }
                    : role
            )
        );
    };

    const handleAddNewRoleRow = () => {
        // Generate a temporary unique ID for the client state
        const tempId = `temp-${Date.now()}`;

        const newRoleTemplate = {
            role_id: tempId,
            role_name: "", // Leaves empty so placeholder "New Role" shows up
            booking: false,
            personal_schedule: false,
            academic_qualifications: false,
            schedules: false,
            courses: false,
            rooms: false,
            subjects: false,
            teachers: false,
            maq: false,
            fcce: false,
            help: false,
        };

        setNewRoles((prev) => [...prev, newRoleTemplate]);
        setEditingRoleId(tempId); // Instantly put the new row into edit mode
    };

    const handleRoleNameChange = (roleId: number | string, newName: string) => {
        setNewRoles((prevRoles) =>
            prevRoles.map((role) =>
                role.role_id === roleId ? { ...role, role_name: newName } : role
            )
        );
    };

    const rolesHasChanges = () => {
        // CRITICAL GUARD: If any role name is empty or just spaces, block saving entirely
        const hasInvalidNames = newRoles.some(r => !r.role_name || r.role_name.trim() === "");
        if (hasInvalidNames) return false; // Forces save button to stay disabled

        // 1. If the quantity of roles doesn't match, changes have occurred (Add/Delete)
        if (oldRoles.length !== newRoles.length) return true;

        // 2. Deep compare every key-value pair for matching IDs
        for (const oldRole of oldRoles) {
            const correspondingNewRole = newRoles.find(r => r.role_id === oldRole.role_id);

            // If a matching role cannot be found in the new list, it was removed
            if (!correspondingNewRole) return true;

            // Compare all schema keys
            const keysToCompare = [
                'role_name', 'booking', 'personal_schedule', 'academic_qualifications',
                'schedules', 'courses', 'rooms', 'subjects', 'teachers', 'maq', 'fcce', 'help'
            ];

            for (const key of keysToCompare) {
                if (oldRole[key] !== correspondingNewRole[key]) {
                    return true; // A difference was spotted!
                }
            }
        }

        // Check if any newly added 'temp' rows exist
        return newRoles.some(r => String(r.role_id).startsWith('temp-'));

         // Pristine state matches perfectly
    };

    const saveRolesToDatabase = async (currentNewRoles: any[]) => {
        // Identify DELETED roles
        const rolesToDelete = oldRoles
            .filter(oldR => !currentNewRoles.some(newR => newR.role_id === oldR.role_id))
            .map(role => role.role_id);

        // Identify INSERTED roles
        const rolesToInsert = currentNewRoles
            .filter(newR => String(newR.role_id).startsWith('temp-'))
            .map(({ role_id, ...rest }) => rest);

        // Identify UPDATED roles
        const rolesToUpdate = currentNewRoles.filter(newR => {
            const correspondingOld = oldRoles.find(oldR => oldR.role_id === newR.role_id);
            if (!correspondingOld) return false;

            const keysToCompare = [
                'role_name', 'booking', 'personal_schedule', 'academic_qualifications',
                'schedules', 'courses', 'rooms', 'subjects', 'teachers', 'maq', 'fcce', 'help'
            ];
            return keysToCompare.some(key => correspondingOld[key] !== newR[key]);
        });

        // Directly execute and return the "200" or "500" code from your database action
        return await syncRolesWithDatabase({
            inserts: rolesToInsert,
            updates: rolesToUpdate,
            deletes: rolesToDelete
        });
    };

    const handleSaveRolesConfiguration = async () => {
        // Fire your database sync mapping function
        const res = await saveRolesToDatabase(newRoles);

        // Display the notification code instantly ("200" / "500")
        triggerNotification(res);

        // Close and flush state only if everything succeeded smoothly
        if (res === "200") {
            location.reload();
        }
    };

    const handleSaveDropdownValue = async (forValue: string) => {
        if (newDropdownValue.trim().length === 0) {
            triggerNotification("400");
            return;
        }

        setLoading(true)
        const res = await saveDropdownValue(newDropdownValue.trim(), forValue);
        if (res === "500") {
            triggerNotification("500");
            setLoading(false);
        }

        if (res === "409") {
            clearDropdownValues();
            setShowAddLaboratoryTypeModal(false);
            setShowAddSpecializationTypeModal(false);
            await loadAllData()
            setLoading(false);
            triggerNotification("409");
        }

        if (res === "201") {
            clearDropdownValues();
            setShowAddLaboratoryTypeModal(false);
            setShowAddSpecializationTypeModal(false);
            await loadAllData()
            setLoading(false);
            triggerNotification("201");
        }
    }

    const handleDeleteDDValue = async (value: string, value_for: string) => {
        const res = await deleteDropdownValue(value, value_for);
        if (res === "204") await loadAllData();
        setShowDeleteDropdownModal(false);
        triggerNotification(res);
        clearDropdownValues();
    }

    const handleDeletePresetAction = async (name: string) => {
        const res = await deletePreset(name);
        if (res === "204") await loadAllData();
        triggerNotification(res);
    };

    const handleDatabaseExport = async () => {
        try {
            setLoading(true);
            console.log('Starting database export...');
            
            // First, check if the export is configured
            const response = await fetch('/api/export-database', {
                method: 'GET',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Export failed:', errorData);
                
                if (response.status === 503) {
                    alert('Database export is not configured. Please set the DUMP_URL environment variable in your .env.local file.');
                } else {
                    alert(`Export failed: ${errorData.error || 'Unknown error'}`);
                }
                triggerNotification("500");
                setLoading(false)
                return;
            }

            const contentType = response.headers.get('content-type');
            
            // If it's a JSON response, it means there's a configuration issue
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (data.error) {
                    alert(`Database export error: ${data.message || data.error}`);
                    triggerNotification("500");
                    setLoading(false)
                    return;
                }
            }

            // If we get here, it should be a file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const timestamp = Date.now();
            a.download = `neon_backup_${timestamp}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            triggerNotification("200");
            setLoading(false)
            
        } catch (error) {
            console.error('Database export failed:', error);
            alert('Database export failed. Please check your internet connection and try again.');
            triggerNotification("500");
            setLoading(false)
        }
    };

    const handleTruncateTables = async () => {
        const selectedTables = Object.entries(tablesToTruncate)
            .filter(([_, selected]) => selected)
            .map(([table, _]) => table);

        if (selectedTables.length === 0) {
            alert('Please select at least one table to truncate.');
            return;
        }

        const confirmMessage = `Are you sure you want to truncate the following tables?\n\n${selectedTables.join(', ')}\n\nThis action cannot be undone!`;
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            setLoading(true);
            
            // Map checkbox state to stored procedure parameters
            const truncateParams = {
                schedules: tablesToTruncate.schedules,
                programs: tablesToTruncate.courses, // Note: courses maps to programs table
                rooms: tablesToTruncate.rooms,
                subjects: tablesToTruncate.subjects,
                teachers: tablesToTruncate.teachers,
                users: tablesToTruncate.users
            };
            
            const result = await truncateTables(truncateParams);
            
            console.log('Truncate results:', result);
            
            // Show success message with details
            const successMessage = result
                .filter((row: any) => row.status === 'truncated' || row.status === 'deleted non-SuperAdmin users')
                .map((row: any) => `${row.table_name}: ${row.rows_affected} rows`)
                .join('\n');
            
            alert(`Tables truncated successfully:\n\n${successMessage}`);
            
            // Reset checkboxes
            setTablesToTruncate({
                courses: false,
                rooms: false,
                schedules: false,
                subjects: false,
                teachers: false,
                users: false
            });
            
            // Close modal
            setShowTruncateModal(false);
            
            // Reload data
            await loadAllData();
            
            triggerNotification("200");
            setLoading(false);
            
        } catch (error) {
            console.error('Table truncation failed:', error);
            alert('Failed to truncate tables. Please check console for details.');
            triggerNotification("500");
            setLoading(false);
        }
    };

    const displayTabs = () => {
        if(userRole == "SuperAdmin") {
            return (
                <Tabs aria-label="Settings categories" variant="underline">
                    <TabItem title="Users & Roles" icon={HiUserGroup}>
                        <Card className="mt-6 border-none shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold">User Access Control</h3>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                        ⚠️ Warning: Role modifications take effect instantly.
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Button size="sm" color="purple" onClick={() => setShowRoleWarning(true)}>
                                        <HiOutlineShieldCheck className="mr-2" /> Edit Role Permissions
                                    </Button>

                                    <Button size="sm" onClick={() => setShowAddAccountModal(true)}>
                                        <HiPlus className="mr-2" /> Add User
                                    </Button>
                                </div>
                            </div>
                            <Table hoverable>
                                <TableHead>
                                    <TableRow>
                                        <TableHeadCell>Username</TableHeadCell>
                                        <TableHeadCell>Email</TableHeadCell>
                                        <TableHeadCell>Role</TableHeadCell>
                                        <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody className="divide-y">
                                    {authorizedAccounts.length > 0 ? (
                                        authorizedAccounts.map(account => (
                                            <TableRow key={account.email}>
                                                <TableCell className="font-medium">{account.username}</TableCell>
                                                <TableCell>{account.email}</TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={account.role_id}
                                                        onChange={(e) => handleUpdateRole(account.id, e.target.value)}
                                                    >
                                                        {oldRoles.length > 0 ? (
                                                            oldRoles.map((role) => (
                                                                <option key={role.role_id} value={role.role_id}>
                                                                    {role.role_name}
                                                                </option>
                                                            ))
                                                        ) : null}
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end">
                                                        <Button
                                                            color="red"
                                                            size="xs"
                                                            onClick={() => handleDeleteUserAction(account.role_assignment_id)}
                                                        >
                                                            <HiTrash />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                                No authorized accounts found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabItem>

                    <TabItem title="Database Management" icon={FaDatabase}>
                        <Card className="mt-6 border-none shadow-sm max-w-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold">DB Controls</h3>
                            </div>
                            <Button size="lg" onClick={handleDatabaseExport}>
                                <BsDatabaseDown size={22} className="mr-2" /> Export Database
                            </Button>

                            <Button size="lg" onClick={() => setShowTruncateModal(true)}>
                                <BsDatabaseDash size={22} className="mr-2" /> Truncate Table Data
                            </Button>
                        </Card>
                    </TabItem>
                </Tabs>
            );
        } else if (userRole == "Administrator") {
            return (
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
                        <div className="space-y-6">
                            {/* Teaching Load Parameters */}
                            <Card className="border-none shadow-sm max-w-2xl">
                                <h3 className="text-lg font-bold mb-4">Teaching Load Parameters</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <Label htmlFor="ft">Full-Time (FT) Max Load (Max: 30)</Label>
                                        <TextInput
                                            id="ft"
                                            type="text"
                                            inputMode="numeric"
                                            min="0"
                                            max="30"
                                            value={facultyLoad.FT}
                                            onKeyDown={(e) => {
                                                if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                            }}
                                            onChange={(e) => handlePositiveIntegerInput(e.target.value, 30, facultyLoad.FT, (value) => setFacultyLoad({...facultyLoad, FT: value}))}/>
                                    </div>
                                    <div>
                                        <Label htmlFor="ptfl">Part-Time Full Load (PTFL) (Max: 30)</Label>
                                        <TextInput id="ptfl"
                                                   type="text"
                                                   inputMode="numeric"
                                                   min="0"
                                                   max="30"
                                                   value={facultyLoad.PTFL}
                                                   onKeyDown={(e) => {
                                                       if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                   }}
                                                   onChange={(e) => handlePositiveIntegerInput(e.target.value, 30, facultyLoad.PTFL, (value) => setFacultyLoad({...facultyLoad, PTFL: value}))}/>
                                    </div>
                                    <div>
                                        <Label htmlFor="pt">Part-Time (PT) (Max: 30)</Label>
                                        <TextInput id="pt"
                                                   type="text"
                                                   inputMode="numeric"
                                                   min="0"
                                                   max="30"
                                                   value={facultyLoad.PT}
                                                   onKeyDown={(e) => {
                                                       if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                   }}
                                                   onChange={(e) => handlePositiveIntegerInput(e.target.value, 30, facultyLoad.PT, (value) => setFacultyLoad({...facultyLoad, PT: value}))}/>
                                    </div>
                                    <Button className="mt-4" onClick={handleSaveFacultyLoad}><HiSave className="mr-2" /> Save Load Configuration</Button>
                                </div>
                            </Card>

                            {/* Prep Limits */}
                            <Card className="border-none shadow-sm max-w-2xl">
                                <h3 className="text-lg font-bold mb-4">Prep Limits (Number of Subjects)</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <Label htmlFor="prep-ft">Full-Time (FT) Max Subjects (Max: 10)</Label>
                                        <TextInput  id="prep-ft"
                                                    type="text"
                                                    inputMode="numeric"
                                                    min="0"
                                                    max="10"
                                                    value={prepLimits.FT}
                                                    onKeyDown={(e) => {
                                                        if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                    }}
                                                    onChange={(e) => handlePositiveIntegerInput(e.target.value, 10, prepLimits.FT, (value) => setPrepLimits({...prepLimits, FT: value}))}/>
                                    </div>
                                    <div>
                                        <Label htmlFor="prep-ptfl">Part-Time Full Load (PTFL) Max Subjects (Max: 10)</Label>
                                        <TextInput id="prep-ptfl"
                                                   type="text"
                                                   inputMode="numeric"
                                                   min="0"
                                                   max="10"
                                                   value={prepLimits.PTFL}
                                                   onKeyDown={(e) => {
                                                       if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                   }}
                                                   onChange={(e) => handlePositiveIntegerInput(e.target.value, 10, prepLimits.PTFL, (value) => setPrepLimits({...prepLimits, PTFL: value}))} />
                                    </div>
                                    <div>
                                        <Label htmlFor="prep-pt">Part-Time (PT) Max Subjects (Max: 10)</Label>
                                        <TextInput  id="prep-pt"
                                                    type="text"
                                                    inputMode="numeric"
                                                    min="0"
                                                    max="10"
                                                    value={prepLimits.PT}
                                                    onKeyDown={(e) => {
                                                        if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                    }}
                                                    onChange={(e) => handlePositiveIntegerInput(e.target.value, 10, prepLimits.PT, (value) => setPrepLimits({...prepLimits, PT: value}))}/>
                                    </div>
                                    <Button className="mt-4" onClick={handleSavePrepLimits}><HiSave className="mr-2" /> Save Prep Configuration</Button>
                                </div>
                            </Card>

                            {/* Overloading Max */}
                            <Card className="border-none shadow-sm max-w-2xl">
                                <h3 className="text-lg font-bold mb-4">Overloading Parameters</h3>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="overload-max">Maximum Units Above Load Limit (Max: 10)</Label>
                                        <TextInput id="overload-max"
                                                   type="text"
                                                   inputMode="numeric"
                                                   min="0"
                                                   max="10"
                                                   value={overloadMax}
                                                   onKeyDown={(e) => {
                                                       if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                   }}
                                                   onChange={(e) => handlePositiveIntegerInput(e.target.value, 10, overloadMax, setOverloadMax)} />
                                        <p className="text-sm text-gray-500 mt-1">Maximum additional units a teacher can take beyond their standard load limit</p>
                                    </div>
                                    <Button onClick={handleSaveOverloadMax}><HiSave className="mr-2" /> Save Overload Configuration</Button>
                                </div>
                            </Card>
                        </div>
                    </TabItem>

                    {/* Class Settings */}
                    <TabItem title="Class Settings" icon={HiUserGroup}>
                        <Card className="mt-6 border-none shadow-sm max-w-md">
                            <h3 className="text-lg font-bold mb-4">Enrollment Constraints</h3>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="maxStudents">Max Students per Section (Max: 50)</Label>
                                    <TextInput  id="max-students"
                                                type="text"
                                                inputMode="numeric"
                                                min="0"
                                                max="50"
                                                value={maxStudents}
                                                onKeyDown={(e) => {
                                                    if (["-", ".", "e", "+"].includes(e.key)) e.preventDefault();
                                                }}
                                                onChange={(e) => handlePositiveIntegerInput(e.target.value, 50, maxStudents, setMaxStudents)}/>
                                </div>
                                <Button onClick={handleSaveMaxStudents}><HiSave className="mr-2" /> Save Constraints</Button>
                            </div>
                        </Card>
                    </TabItem>

                    {/* Dropdown Values */}
                    <TabItem
                        title={"Dropdown Values"}
                        icon={IoMdArrowDropdownCircle}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                            {/* Laboratory Types */}
                            <div className="border-none shadow-sm p-4 bg-gray-500/20 rounded-xl">
                                <div className="flex justify-between mb-6">
                                    <h3 className="text-lg font-bold">Laboratory Types</h3>

                                    <Button onClick={() => setShowAddLaboratoryTypeModal(true)}
                                            className={"cursor-pointer"}>
                                        <HiOutlinePlus className="mr-2" />
                                        Add Value
                                    </Button>
                                </div>

                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableHeadCell>Value</TableHeadCell>
                                            <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dropdownValues.filter((ddValues) => ddValues.value_for === "laboratory").length > 0 ? (
                                            dropdownValues
                                                .filter((ddValues) => ddValues.value_for === "laboratory")
                                                .map((ddValues) => (
                                                    <TableRow key={ddValues.value + ddValues.value_for}
                                                              className={"hover:bg-gray-500/20"}>
                                                        <TableCell>{ddValues.value}</TableCell>
                                                        <TableCell className={"flex justify-end"}>
                                                            <Button color={"red"}
                                                                    className={"cursor-pointer"}
                                                                    onClick={() => {
                                                                        setShowDeleteDropdownModal(true);
                                                                        setNewDropdownValue(ddValues.value);
                                                                        setNewDropdownValueFor(ddValues.value_for)}}>
                                                                <HiTrash/>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-gray-500">
                                                    No entries found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Specializations */}
                            <div className="border-none shadow-sm p-4 bg-gray-500/20 rounded-xl">
                                <div className="flex justify-between mb-6">
                                    <h3 className="text-lg font-bold">Specializations</h3>

                                    <Button onClick={() => setShowAddSpecializationTypeModal(true)}
                                            className={"cursor-pointer"}>
                                        <HiOutlinePlus className="mr-2" />
                                        Add Value
                                    </Button>
                                </div>

                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableHeadCell>Value</TableHeadCell>
                                            <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dropdownValues.filter((ddValues) => ddValues.value_for === "specialization").length > 0 ? (
                                            dropdownValues
                                                .filter((ddValues) => ddValues.value_for === "specialization")
                                                .map((ddValues) => (
                                                    <TableRow key={ddValues.value + ddValues.value_for}
                                                              className={"hover:bg-gray-500/20"}>
                                                        <TableCell>{ddValues.value}</TableCell>
                                                        <TableCell className={"flex justify-end"}>
                                                            <Button color={"red"}
                                                                    className={"cursor-pointer"}
                                                                    onClick={() => {
                                                                        setShowDeleteDropdownModal(true);
                                                                        setNewDropdownValue(ddValues.value);
                                                                        setNewDropdownValueFor(ddValues.value_for)}}>
                                                                <HiTrash/>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-gray-500">
                                                    No entries found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
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
                                                    <Button size="xs" color="failure" onClick={() => handleDeletePresetAction(preset.preset_name)}>
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
            );
        } else {
            <div className={"w-full h-full flex items-center justify-center"}>
                Fetching User Role...
            </div>
        }
    }
    
    return (
        <div className="p-8 h-full w-full overflow-y-auto font-sans">
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl" />
                </div>
            )}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configuration</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Configure global parameters and user access</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                    <span className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">Active Preset</span>
                    <p className="text-sm font-semibold text-blue-900 dark:text-white">{activePresetId}</p>
                </div>
            </div>

            {/* Displayed Tabs */
                displayTabs()
            }

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

            {/* Role Warning Modal */}
            <Modal show={showRoleWarning} onClose={() => setShowRoleWarning(false)}>
                <ModalHeader>
                    <div className={"flex items-center"}><HiExclamationTriangle color={"yellow"} className={"mr-2"} /> Warning Disclaimer</div>
                </ModalHeader>
                <ModalBody className="space-y-4">
                    <List>
                        <h3 className="text-lg font-semibold">You are modifying a core system role definition.</h3>
                        <ListItem>Cascading Effect: Any changes made to these permission toggles (e.g., Booking, Schedules, Courses) will immediately alter the access rights of every user currently assigned to this role group.</ListItem>
                        <ListItem>Potential Session Disruptions: Users currently logged in under this role may experience immediate changes in interface accessibility or encounter authorization errors mid-session.</ListItem>
                        <ListItem>System Stability: Restricting permissions for high-level roles (like Admin) can lock administrators out of essential management features. Please cross-verify dependencies before saving.</ListItem>
                    </List>
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => setShowRoleWarning(false)}>Cancel</Button>
                    <Button onClick={() => {handleFetchRolesData(); setShowRoleWarning(false); setShowRoleList(true)}}>
                        Proceed
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Roles Modal */}
            <Modal size={"7xl"} show={showRoleList} onClose={() => setShowRoleList(false)}>
                <ModalHeader>
                    <div className={"flex items-center"}>Roles & Permissions Management</div>
                </ModalHeader>
                <ModalBody className="space-y-4">
                    {roleListLoaded ? (
                        /* Added overflow protection wrapper and forced table to occupy full width */
                        <div className="w-full overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg p-1">
                            <Table className="w-full table-fixed min-w-225">
                                <TableHead>
                                    <TableRow>
                                        {/* Actions + Name combined on the left side to save horizontal footprint */}
                                        <TableHeadCell className="w-15 text-center"><span className="sr-only">Delete</span></TableHeadCell>
                                        <TableHeadCell className="w-50">Role Name</TableHeadCell>

                                        {/* Condensed column headers */}
                                        <TableHeadCell className="w-20 text-center px-1 text-xs">Booking</TableHeadCell>
                                        <TableHeadCell className="w-22.5 text-center px-1 text-xs">Pers. Schedule</TableHeadCell>
                                        <TableHeadCell className="w-25 text-center px-1 text-xs">Acad. Qual.</TableHeadCell>
                                        <TableHeadCell className="w-21.25 text-center px-1 text-xs">Schedules</TableHeadCell>
                                        <TableHeadCell className="w-20 text-center px-1 text-xs">Courses</TableHeadCell>
                                        <TableHeadCell className="w-20 text-center px-1 text-xs">Rooms</TableHeadCell>
                                        <TableHeadCell className="w-20 text-center px-1 text-xs">Subjects</TableHeadCell>
                                        <TableHeadCell className="w-20 text-center px-1 text-xs">Teachers</TableHeadCell>
                                        <TableHeadCell className="w-17.5 text-center px-1 text-xs">MAQ</TableHeadCell>
                                        <TableHeadCell className="w-17.5 text-center px-1 text-xs">FCCE</TableHeadCell>
                                        <TableHeadCell className="w-17.5 text-center px-1 text-xs">Help</TableHeadCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {newRoles.length > 0 ? (
                                        newRoles.map((role) => (
                                            <TableRow key={role.role_id} className="hover:bg-gray-500/10">
                                                {/* Action Column moved to the front (Left side anchor) */}
                                                <TableCell className="text-center p-2">
                                                    <button
                                                        type="button"
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer"
                                                        onClick={() => {
                                                            setNewRoles(prev => prev.filter(r => r.role_id !== role.role_id));
                                                        }}
                                                    >
                                                        <HiTrash className="text-base" />
                                                    </button>
                                                </TableCell>

                                                {/* Name Column */}
                                                <TableCell className="font-medium text-gray-900 dark:text-white p-2">
                                                    {editingRoleId === role.role_id ? (
                                                        <input
                                                            type="text"
                                                            value={role.role_name}
                                                            placeholder="New Role"
                                                            onChange={(e) => handleRoleNameChange(role.role_id, e.target.value)}
                                                            onBlur={() => setEditingRoleId(null)}
                                                            onKeyDown={(e) => e.key === 'Enter' && setEditingRoleId(null)}
                                                            className="w-full bg-transparent border-b border-indigo-500 text-sm py-0.5 focus:outline-none dark:text-white"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2 group justify-between">
                                                <span className="truncate max-w-37.5">
                                                    {role.role_name || <span className="text-gray-400 italic">New Role</span>}
                                                </span>
                                                            <button
                                                                onClick={() => setEditingRoleId(role.role_id)}
                                                                className="text-gray-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                title="Edit Role Name"
                                                            >
                                                                <HiPencilAlt className="text-sm" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </TableCell>

                                                {/* Checkboxes Loop */}
                                                {[
                                                    'booking',
                                                    'personal_schedule',
                                                    'academic_qualifications',
                                                    'schedules',
                                                    'courses',
                                                    'rooms',
                                                    'subjects',
                                                    'teachers',
                                                    'maq',
                                                    'fcce',
                                                    'help',
                                                ].map((field) => (
                                                    <TableCell key={field} className="text-center p-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!role[field]}
                                                            onChange={() => handlePermissionToggle(role.role_id, field)}
                                                            className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer mx-auto block"
                                                        />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={13} className="text-center text-gray-500 py-8">
                                                No global system roles found.
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {/* Append Action Row */}
                                    <TableRow className="border-t border-dashed border-gray-300 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                        <TableCell colSpan={13} className="p-0">
                                            <button
                                                type="button"
                                                onClick={handleAddNewRoleRow}
                                                className="flex items-center justify-center gap-2 w-full py-3.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                            >
                                                <HiPlusCircle className="text-lg" />
                                                Create & Add New System Role
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-3 border-blue-600"></div>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter className="justify-end">
                    {/* EXIT WITHOUT CHANGES */}
                    <Button
                        color={"gray"}
                        onClick={() => {
                            setShowRoleList(false);
                            resetRolesState(); // Wipes out all pending unsaved edits safely
                        }}
                    >
                        Exit Without Changes
                    </Button>

                    {/* SAVE CHANGES */}
                    <Button
                        disabled={!rolesHasChanges()}
                        onClick={() => setOpenRoleSaveConfirmationModal(true)}
                    >
                        Save Changes
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Roles Save Confirmation Modal */}
            <Modal
                size="md"
                show={openRoleSaveConfirmationModal}
                onClose={() => setOpenRoleSaveConfirmationModal(false)}
                popup
            >
                <ModalHeader>
                    <span className="p-4 text-xl font-medium text-gray-900 dark:text-white block">
                        Confirm Changes
                    </span>
                </ModalHeader>

                <ModalBody>
                    <div className="space-y-3 p-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            Are you sure you want to save these modifications? This will permanently update the global system roles matrix in the database.
                        </p>
                        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
                            <strong>Warning:</strong> Any deleted roles will immediately revoke access permissions for users currently assigned to them.
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter className="justify-end gap-2">
                    <Button
                        color="gray"
                        onClick={() => setOpenRoleSaveConfirmationModal(false)}
                        className="cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button
                        color="indigo"
                        className="cursor-pointer"
                        onClick={async () => {
                            try {
                                // Close this confirmation alert backdrop first
                                setOpenRoleSaveConfirmationModal(false);

                                // Dispatch the network requests and handle notification triggers
                                await handleSaveRolesConfiguration();
                            } catch (error) {
                                console.error("Failed to save changes:", error);
                            }
                        }}
                    >
                        Confirm & Save
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Add User Modal */}
            <Modal show={showAddAccountModal} onClose={() => setShowAddAccountModal(false)}>
                <ModalHeader>Add Authorized User</ModalHeader>
                <ModalBody className="space-y-4">
                    <div>
                        <Label>Full Name</Label>
                        <TextInput value={newAccount.username} onChange={e => setNewAccount({...newAccount, username: e.target.value})} placeholder="John Doe" />
                    </div>
                    <div>
                        <Label>Email (@alabang.sti.edu.ph)</Label>
                        <TextInput type="email" value={newAccount.email} onChange={e => setNewAccount({...newAccount, email: e.target.value})} placeholder="john.doe@alabang.sti.edu.ph" />
                    </div>
                    <div>
                        <Label>Initial Role</Label>
                        <Select value={newAccount.role || ""} onChange={e => setNewAccount({...newAccount, role: e.target.value})}>
                            <option value="" disabled hidden>--- Select Option ---</option>
                            {oldRoles.length > 0 ? (
                                oldRoles.map((role) => (
                                    <option key={role.role_id} value={role.role_id}>
                                        {role.role_name}
                                    </option>
                                ))
                            ) : null}
                        </Select>
                    </div>
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => setShowAddAccountModal(false)}>Cancel</Button>
                    <Button
                        onClick={handleAddUser}
                        disabled={!newAccount.username?.trim() || !newAccount.email?.trim() || !newAccount.role}
                    >
                        Add User
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

            <Modal size="sm" show={showTruncateModal} onClose={() => setShowTruncateModal(false)}>
                <ModalHeader>Select Tables to Truncate</ModalHeader>
                <ModalBody>
                    <div className="flex space-x-6 pl-4">
                        <div className="space-y-3">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="courses"
                                    checked={tablesToTruncate.courses}
                                    onChange={(e) => setTablesToTruncate({...tablesToTruncate, courses: e.target.checked})}
                                    className="mr-2 h-6 w-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:cursor-pointer"
                                />
                                <label htmlFor="courses" className="text-md font-medium text-gray-900 dark:text-gray-300 hover:cursor-pointer select-none">
                                    Courses
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="rooms"
                                    checked={tablesToTruncate.rooms}
                                    onChange={(e) => setTablesToTruncate({...tablesToTruncate, rooms: e.target.checked})}
                                    className="mr-2 h-6 w-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:cursor-pointer"
                                />
                                <label htmlFor="rooms" className="text-md font-medium text-gray-900 dark:text-gray-300 hover:cursor-pointer select-none">
                                    Rooms
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="schedules"
                                    checked={tablesToTruncate.schedules}
                                    onChange={(e) => setTablesToTruncate({...tablesToTruncate, schedules: e.target.checked})}
                                    className="mr-2 h-6 w-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:cursor-pointer"
                                />
                                <label htmlFor="schedules" className="text-md font-medium text-gray-900 dark:text-gray-300 hover:cursor-pointer select-none">
                                    Schedules
                                </label>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="subjects"
                                    checked={tablesToTruncate.subjects}
                                    onChange={(e) => setTablesToTruncate({...tablesToTruncate, subjects: e.target.checked})}
                                    className="mr-2 h-6 w-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:cursor-pointer"
                                />
                                <label htmlFor="subjects" className="text-md font-medium text-gray-900 dark:text-gray-300 hover:cursor-pointer select-none">
                                    Subjects
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="teachers"
                                    checked={tablesToTruncate.teachers}
                                    onChange={(e) => setTablesToTruncate({...tablesToTruncate, teachers: e.target.checked})}
                                    className="mr-2 h-6 w-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:cursor-pointer"
                                />
                                <label htmlFor="teachers" className="text-md font-medium text-gray-900 dark:text-gray-300 hover:cursor-pointer select-none">
                                    Teachers
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="users"
                                    checked={tablesToTruncate.users}
                                    onChange={(e) => setTablesToTruncate({...tablesToTruncate, users: e.target.checked})}
                                    className="mr-2 h-6 w-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 hover:cursor-pointer"
                                />
                                <label htmlFor="users" className="text-md font-medium text-gray-900 dark:text-gray-300 hover:cursor-pointer select-none">
                                    Users
                                </label>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => setShowTruncateModal(false)}>Cancel</Button>
                    <Button onClick={handleTruncateTables}>Truncate</Button>
                </ModalFooter>
            </Modal>

            {/* Add laboratory types */}
            <Modal show={showAddLaboratoryTypeModal} onClose={() => setShowAddLaboratoryTypeModal(false)}>
                <ModalHeader>Add Laboratory Type</ModalHeader>
                <ModalBody>
                    <Label>Laboratory Type</Label>
                    <TextInput value={newDropdownValue} onChange={e => setNewDropdownValue(sanitizeDropdownValue(e.target.value))} placeholder="Computer Laboratory" />
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => {setShowAddLaboratoryTypeModal(false); clearDropdownValues()}}>Cancel</Button>
                    <Button onClick={() => handleSaveDropdownValue("laboratory")}>Save</Button>
                </ModalFooter>
            </Modal>

            {/* Add specializations */}
            <Modal show={showAddSpecializationTypeModal} onClose={() => setShowAddSpecializationTypeModal(false)}>
                <ModalHeader>Add Specializations</ModalHeader>
                <ModalBody>
                    <Label>Specialization</Label>
                    <TextInput value={newDropdownValue} onChange={e => setNewDropdownValue(sanitizeDropdownValue(e.target.value))} placeholder="Information Technology" />
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => {setShowAddSpecializationTypeModal(false); clearDropdownValues()}}>Cancel</Button>
                    <Button onClick={() => handleSaveDropdownValue("specialization")}>Save</Button>
                </ModalFooter>
            </Modal>

            {/* Dropdown delete Modal */}
            <Modal show={showDeleteDropdownModal} onClose={() => setShowDeleteDropdownModal(false)}>
                <ModalHeader>Delete Dropdown Value</ModalHeader>
                <ModalBody>
                    <Label>Are You sure you want to delete <b>"{newDropdownValue}"</b> for <b>"{capitalize(newDropdownValueFor)}"</b>?</Label>
                </ModalBody>
                <ModalFooter className="justify-end">
                    <Button color="gray" onClick={() => (setShowDeleteDropdownModal(false), clearDropdownValues())}>Cancel</Button>
                    <Button color={"red"} onClick={() => handleDeleteDDValue(newDropdownValue, newDropdownValueFor)}>Delete</Button>
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
                    <ToastToggle onDismiss={() => { setShowToast(false); setProgress(0); }} />
                </div>
                <Progress progress={progress} size="sm" className="mt-2" color={statusCode.startsWith('2') ? "green" : "red"} />
            </Toast>
        </div>
    );
}
