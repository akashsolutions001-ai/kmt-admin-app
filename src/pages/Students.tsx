import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Plus,
    Pencil,
    Trash2,
    Phone,
    Upload,
    Download,
    FileSpreadsheet,
    Users,
    BarChart3,
    GraduationCap,
    Mail,
    Building2,
    MapPin,
} from 'lucide-react';
import { Student, StudentYear, StudentStatus, Route, Stop } from '@/types/admin';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch,
    Timestamp,
    query,
    orderBy,
} from 'firebase/firestore';

const DEPARTMENTS = [
    'Computer Science',
    'Electronics',
    'Mechanical',
    'Civil',
    'Electrical',
    'Information Technology',
    'Chemical',
    'Biotechnology',
];

const YEARS: StudentYear[] = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const CHART_COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
];

export default function Students() {
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [importData, setImportData] = useState<Partial<Student>[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        year: '1st Year' as StudentYear,
        department: DEPARTMENTS[0],
        password: '',
        status: 'active' as StudentStatus,
    });

    // Export filters
    const [exportFilterRoute, setExportFilterRoute] = useState<string>('all');
    const [exportFilterStop, setExportFilterStop] = useState<string>('all');

    // Load data from Firestore
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load students
            const studentsSnapshot = await getDocs(
                query(collection(db, 'students'), orderBy('name'))
            );
            const studentsData = studentsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Student[];
            setStudents(studentsData);

            // Load routes
            const routesSnapshot = await getDocs(collection(db, 'routes'));
            const routesData = routesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Route[];
            setRoutes(routesData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get stops for selected route
    const getStopsForRoute = (routeId: string): Stop[] => {
        const route = routes.find((r) => r.id === routeId);
        return route?.stops || [];
    };

    const handleAdd = () => {
        setSelectedStudent(null);
        setFormData({
            name: '',
            email: '',
            phone: '',
            year: '1st Year',
            department: DEPARTMENTS[0],
            password: '',
            status: 'active',
        });
        setIsFormOpen(true);
    };

    const handleEdit = (student: Student) => {
        setSelectedStudent(student);
        setFormData({
            name: student.name,
            email: student.email,
            phone: student.phone || '',
            year: student.year,
            department: student.department,
            password: '',
            status: student.status,
        });
        setIsFormOpen(true);
    };

    const handleDelete = (student: Student) => {
        setSelectedStudent(student);
        setIsDeleteOpen(true);
    };

    const handleSave = async () => {
        try {
            if (selectedStudent) {
                // Update existing student
                const studentRef = doc(db, 'students', selectedStudent.id);
                const updateData: Partial<Student> = {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    year: formData.year,
                    department: formData.department,
                    status: formData.status,
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }
                await updateDoc(studentRef, {
                    ...updateData,
                    updatedAt: Timestamp.now(),
                });
            } else {
                // Add new student
                await addDoc(collection(db, 'students'), {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    year: formData.year,
                    department: formData.department,
                    password: formData.password,
                    status: formData.status,
                    routeId: null,
                    stopId: null,
                    routeName: null,
                    stopName: null,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            }
            setIsFormOpen(false);
            loadData();
        } catch (error) {
            console.error('Error saving student:', error);
        }
    };

    const confirmDelete = async () => {
        if (selectedStudent) {
            try {
                const studentRef = doc(db, 'students', selectedStudent.id);
                await deleteDoc(studentRef);
                loadData();
            } catch (error) {
                console.error('Error deleting student:', error);
            }
        }
        setIsDeleteOpen(false);
    };

    // Excel Import
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportError(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                // Validate and map data
                const mappedData: Partial<Student>[] = jsonData.map((row: unknown) => {
                    const r = row as Record<string, unknown>;
                    const yearValue = String(r.year || r.Year || '1st Year');
                    let year: StudentYear = '1st Year';
                    if (yearValue.includes('1') || yearValue.toLowerCase().includes('first')) year = '1st Year';
                    else if (yearValue.includes('2') || yearValue.toLowerCase().includes('second')) year = '2nd Year';
                    else if (yearValue.includes('3') || yearValue.toLowerCase().includes('third')) year = '3rd Year';
                    else if (yearValue.includes('4') || yearValue.toLowerCase().includes('fourth')) year = '4th Year';

                    return {
                        name: String(r.name || r.Name || ''),
                        email: String(r.email || r.Email || ''),
                        phone: String(r.phone || r.Phone || r.mobile || r.Mobile || ''),
                        year,
                        department: String(r.department || r.Department || r.dept || r.Dept || DEPARTMENTS[0]),
                        password: String(r.password || r.Password || 'student123'),
                        status: 'active' as StudentStatus,
                    };
                });

                // Filter out empty rows
                const validData = mappedData.filter((d) => d.name && d.email);
                if (validData.length === 0) {
                    setImportError('No valid data found. Ensure columns: name, email, phone, year, department, password');
                    return;
                }

                setImportData(validData);
                setIsImportDialogOpen(true);
            } catch (error) {
                console.error('Error parsing Excel:', error);
                setImportError('Error parsing Excel file. Please check the format.');
            }
        };
        reader.readAsBinaryString(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const confirmImport = async () => {
        try {
            const batch = writeBatch(db);
            importData.forEach((student) => {
                const docRef = doc(collection(db, 'students'));
                batch.set(docRef, {
                    ...student,
                    routeId: null,
                    stopId: null,
                    routeName: null,
                    stopName: null,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            });
            await batch.commit();
            setImportData([]);
            setIsImportDialogOpen(false);
            loadData();
        } catch (error) {
            console.error('Error importing students:', error);
            setImportError('Error importing students. Please try again.');
        }
    };

    // Excel Export
    const handleExport = () => {
        let dataToExport = [...students];

        // Filter by route
        if (exportFilterRoute !== 'all') {
            dataToExport = dataToExport.filter((s) => s.routeId === exportFilterRoute);
        }

        // Filter by stop
        if (exportFilterStop !== 'all') {
            dataToExport = dataToExport.filter((s) => s.stopId === exportFilterStop);
        }

        const exportData = dataToExport.map((s) => ({
            Name: s.name,
            Email: s.email,
            Phone: s.phone,
            Year: s.year,
            Department: s.department,
            Route: s.routeName || 'Not Selected',
            Stop: s.stopName || 'Not Selected',
            Status: s.status,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');

        let filename = 'students';
        if (exportFilterRoute !== 'all') {
            const route = routes.find((r) => r.id === exportFilterRoute);
            filename += `_${route?.name.replace(/\s+/g, '_') || 'route'}`;
        }
        if (exportFilterStop !== 'all') {
            const stops = getStopsForRoute(exportFilterRoute);
            const stop = stops.find((s) => s.id === exportFilterStop);
            filename += `_${stop?.name.replace(/\s+/g, '_') || 'stop'}`;
        }
        filename += '.xlsx';

        XLSX.writeFile(wb, filename);
    };

    const downloadTemplate = () => {
        // Create instructions sheet
        const instructions = [
            ['Student Import Template - Instructions'],
            [''],
            ['How to use this template:'],
            ['1. Fill in student details in the "Student Data" sheet'],
            ['2. Required fields: name, email, year, department, password'],
            ['3. Optional field: phone'],
            ['4. Save the file and import it in the admin panel'],
            [''],
            ['Field Descriptions:'],
            ['Field', 'Description', 'Example', 'Required'],
            ['name', 'Full name of the student', 'John Doe', 'Yes'],
            ['email', 'Student email address', 'john@example.com', 'Yes'],
            ['phone', 'Contact number with country code', '+91 98765 43210', 'No'],
            ['year', 'Academic year (1st/2nd/3rd/4th Year)', '1st Year', 'Yes'],
            ['department', 'Department name', 'Computer Science', 'Yes'],
            ['password', 'Login password for student', 'student123', 'Yes'],
            [''],
            ['Valid Year Values:'],
            ['1st Year, 2nd Year, 3rd Year, 4th Year'],
            [''],
            ['Valid Departments:'],
            [DEPARTMENTS.join(', ')],
            [''],
            ['Note: Students can select their route and stop after logging in.'],
        ];

        // Create sample data sheet
        const sampleData = [
            {
                name: 'John Doe',
                email: 'john.doe@college.edu',
                phone: '+91 98765 43210',
                year: '1st Year',
                department: 'Computer Science',
                password: 'student123',
            },
            {
                name: 'Jane Smith',
                email: 'jane.smith@college.edu',
                phone: '+91 98765 43211',
                year: '2nd Year',
                department: 'Electronics',
                password: 'student123',
            },
            {
                name: 'Rahul Kumar',
                email: 'rahul.kumar@college.edu',
                phone: '+91 98765 43212',
                year: '3rd Year',
                department: 'Mechanical',
                password: 'student123',
            },
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Add instructions sheet
        const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

        // Style the instructions sheet (set column widths)
        wsInstructions['!cols'] = [
            { wch: 15 },
            { wch: 40 },
            { wch: 25 },
            { wch: 10 },
        ];

        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

        // Add sample data sheet
        const wsSample = XLSX.utils.json_to_sheet(sampleData);

        // Set column widths for sample data
        wsSample['!cols'] = [
            { wch: 20 }, // name
            { wch: 30 }, // email
            { wch: 18 }, // phone
            { wch: 12 }, // year
            { wch: 25 }, // department
            { wch: 15 }, // password
        ];

        XLSX.utils.book_append_sheet(wb, wsSample, 'Student Data');

        // Download the file
        XLSX.writeFile(wb, 'student_import_template.xlsx');
    };

    // Statistics calculations
    const getRouteStats = () => {
        const routeCount: Record<string, number> = {};
        routes.forEach((route) => {
            routeCount[route.name] = 0;
        });
        routeCount['Not Selected'] = 0;

        students.forEach((student) => {
            if (student.routeName) {
                routeCount[student.routeName] = (routeCount[student.routeName] || 0) + 1;
            } else {
                routeCount['Not Selected'] += 1;
            }
        });

        return Object.entries(routeCount)
            .map(([name, count]) => ({ name, students: count }))
            .filter((r) => r.students > 0)
            .sort((a, b) => b.students - a.students);
    };

    const getStopStatsForRoute = (routeId: string) => {
        const route = routes.find((r) => r.id === routeId);
        if (!route) return [];

        const stopCount: Record<string, number> = {};
        route.stops.forEach((stop) => {
            stopCount[stop.name] = 0;
        });

        students
            .filter((s) => s.routeId === routeId)
            .forEach((student) => {
                if (student.stopName) {
                    stopCount[student.stopName] = (stopCount[student.stopName] || 0) + 1;
                }
            });

        return Object.entries(stopCount)
            .map(([name, count]) => ({ name, students: count }))
            .sort((a, b) => b.students - a.students);
    };

    const [selectedStatsRoute, setSelectedStatsRoute] = useState<string>('');

    // Get max and min stops
    const getMinMaxStops = (routeId: string) => {
        const stats = getStopStatsForRoute(routeId);
        if (stats.length === 0) return { max: null, min: null };
        const max = stats[0];
        const min = stats[stats.length - 1];
        return { max, min };
    };

    const routeStats = getRouteStats();
    const selectedRouteStopStats = selectedStatsRoute ? getStopStatsForRoute(selectedStatsRoute) : [];
    const minMaxStops = selectedStatsRoute ? getMinMaxStops(selectedStatsRoute) : { max: null, min: null };

    if (isLoading) {
        return (
            <AdminLayout title="Students Management" subtitle="Loading...">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            title="Students Management"
            subtitle="Manage student data and view statistics"
            actions={
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="excel-upload"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadTemplate}
                        className="hidden md:flex"
                    >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Download Template
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="hidden sm:flex"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Import Excel
                    </Button>
                    <Button onClick={handleAdd} size="sm" className="sm:size-default">
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Add Student</span>
                    </Button>
                </div>
            }
        >
            <Tabs defaultValue="list" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="list" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Students</span>
                    </TabsTrigger>
                    <TabsTrigger value="export" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export</span>
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Statistics</span>
                    </TabsTrigger>
                </TabsList>

                {/* Students List Tab */}
                <TabsContent value="list" className="space-y-4">
                    {/* Excel Import Info Card */}
                    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                        <CardContent className="pt-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm mb-1">Bulk Import Students</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Download the Excel template, fill in student details, and import to add multiple students at once.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadTemplate}
                                        className="flex-1 sm:flex-none"
                                    >
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        Download Template
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 sm:flex-none"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Import Excel
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Import Error Display */}
                    {importError && (
                        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    <svg
                                        className="h-5 w-5"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm mb-1">Import Error</h4>
                                    <p className="text-sm">{importError}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setImportError(null)}
                                        className="mt-2 h-7 text-xs"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <GraduationCap className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{students.length}</p>
                                        <p className="text-xs text-muted-foreground">Total Students</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-green-500/10">
                                        <Users className="h-5 w-5 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {students.filter((s) => s.status === 'active').length}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Active</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                        <MapPin className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {students.filter((s) => s.routeId).length}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Assigned Route</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-amber-500/10">
                                        <Building2 className="h-5 w-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {new Set(students.map((s) => s.department)).size}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Departments</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block table-wrapper overflow-hidden">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th className="hidden md:table-cell">Email</th>
                                    <th className="hidden lg:table-cell">Phone</th>
                                    <th>Year</th>
                                    <th className="hidden md:table-cell">Department</th>
                                    <th className="hidden lg:table-cell">Route</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => (
                                    <tr key={student.id}>
                                        <td className="font-medium">{student.name}</td>
                                        <td className="hidden md:table-cell">{student.email}</td>
                                        <td className="hidden lg:table-cell">{student.phone || '—'}</td>
                                        <td>{student.year}</td>
                                        <td className="hidden md:table-cell">{student.department}</td>
                                        <td className="hidden lg:table-cell">
                                            {student.routeName || 'Not Selected'}
                                        </td>
                                        <td>
                                            <StatusBadge status={student.status} />
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(student)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(student)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3">
                        {students.map((student) => (
                            <div
                                key={student.id}
                                className="rounded-lg border bg-card p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <h3 className="font-medium text-sm">{student.name}</h3>
                                            <StatusBadge status={student.status} />
                                        </div>
                                        <div className="space-y-1.5 text-xs text-muted-foreground">
                                            <p className="flex items-center gap-1.5">
                                                <Mail className="h-3 w-3" />
                                                {student.email}
                                            </p>
                                            {student.phone && (
                                                <p className="flex items-center gap-1.5">
                                                    <Phone className="h-3 w-3" />
                                                    {student.phone}
                                                </p>
                                            )}
                                            <p>
                                                <span className="font-medium text-foreground">
                                                    {student.year}
                                                </span>{' '}
                                                • {student.department}
                                            </p>
                                            <p className="flex items-center gap-1.5">
                                                <MapPin className="h-3 w-3" />
                                                {student.routeName || 'No Route Selected'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(student)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(student)}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {students.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h3 className="font-medium text-lg">No students yet</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mt-1">
                                Add students individually or import from an Excel file to get started.
                            </p>
                            <div className="flex gap-2 mt-4">
                                <Button variant="outline" onClick={downloadTemplate}>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Download Template
                                </Button>
                                <Button onClick={handleAdd}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Student
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Export Tab */}
                <TabsContent value="export">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="h-5 w-5" />
                                Export Students Data
                            </CardTitle>
                            <CardDescription>
                                Export student data to Excel with optional filters by route and stop
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Filter by Route</Label>
                                    <Select
                                        value={exportFilterRoute}
                                        onValueChange={(value) => {
                                            setExportFilterRoute(value);
                                            setExportFilterStop('all');
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select route" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Routes</SelectItem>
                                            {routes.map((route) => (
                                                <SelectItem key={route.id} value={route.id}>
                                                    {route.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Filter by Stop</Label>
                                    <Select
                                        value={exportFilterStop}
                                        onValueChange={setExportFilterStop}
                                        disabled={exportFilterRoute === 'all'}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select stop" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Stops</SelectItem>
                                            {exportFilterRoute !== 'all' &&
                                                getStopsForRoute(exportFilterRoute).map((stop) => (
                                                    <SelectItem key={stop.id} value={stop.id}>
                                                        {stop.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">
                                    {exportFilterRoute === 'all'
                                        ? `Exporting all ${students.length} students`
                                        : exportFilterStop === 'all'
                                            ? `Exporting ${students.filter((s) => s.routeId === exportFilterRoute).length
                                            } students from ${routes.find((r) => r.id === exportFilterRoute)?.name}`
                                            : `Exporting ${students.filter(
                                                (s) =>
                                                    s.routeId === exportFilterRoute &&
                                                    s.stopId === exportFilterStop
                                            ).length
                                            } students`}
                                </p>
                            </div>

                            <Button onClick={handleExport} className="w-full sm:w-auto">
                                <Download className="h-4 w-4 mr-2" />
                                Export to Excel
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Statistics Tab */}
                <TabsContent value="stats" className="space-y-6">
                    {/* Route Distribution Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Students by Route
                            </CardTitle>
                            <CardDescription>
                                Distribution of students across different routes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {routeStats.length > 0 ? (
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={routeStats}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="name" type="category" width={100} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar
                                                dataKey="students"
                                                fill="#6366f1"
                                                radius={[0, 4, 4, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-64 flex items-center justify-center text-muted-foreground">
                                    No data available
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stop Distribution for Selected Route */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Students by Stop
                            </CardTitle>
                            <CardDescription>
                                Select a route to view stop-wise student distribution
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select
                                value={selectedStatsRoute}
                                onValueChange={setSelectedStatsRoute}
                            >
                                <SelectTrigger className="w-full md:w-80">
                                    <SelectValue placeholder="Select a route to view stats" />
                                </SelectTrigger>
                                <SelectContent>
                                    {routes.map((route) => (
                                        <SelectItem key={route.id} value={route.id}>
                                            {route.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedStatsRoute && selectedRouteStopStats.length > 0 ? (
                                <>
                                    {/* Min/Max Summary */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {minMaxStops.max && (
                                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                                <p className="text-sm text-green-600 font-medium">
                                                    Maximum Students
                                                </p>
                                                <p className="text-lg font-bold text-green-700">
                                                    {minMaxStops.max.name}
                                                </p>
                                                <p className="text-2xl font-bold text-green-600">
                                                    {minMaxStops.max.students} students
                                                </p>
                                            </div>
                                        )}
                                        {minMaxStops.min && (
                                            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                <p className="text-sm text-amber-600 font-medium">
                                                    Minimum Students
                                                </p>
                                                <p className="text-lg font-bold text-amber-700">
                                                    {minMaxStops.min.name}
                                                </p>
                                                <p className="text-2xl font-bold text-amber-600">
                                                    {minMaxStops.min.students} students
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={selectedRouteStopStats}
                                                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="name"
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={80}
                                                    interval={0}
                                                />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="students" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                                                    {selectedRouteStopStats.map((_, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            ) : selectedStatsRoute ? (
                                <div className="h-64 flex items-center justify-center text-muted-foreground">
                                    No students assigned to stops on this route
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* Route Pie Chart */}
                    {routeStats.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Route Distribution Overview</CardTitle>
                                <CardDescription>
                                    Percentage of students per route
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={routeStats}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) =>
                                                    `${name}: ${(percent * 100).toFixed(0)}%`
                                                }
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="students"
                                            >
                                                {routeStats.map((_, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Add/Edit Student Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-heading">
                            {selectedStudent ? 'Edit Student' : 'Add New Student'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            {selectedStudent
                                ? 'Edit the selected student details'
                                : 'Add a new student to the system'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                placeholder="e.g., Priya Sharma"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({ ...formData, email: e.target.value })
                                }
                                placeholder="e.g., priya@college.edu"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({ ...formData, phone: e.target.value })
                                }
                                placeholder="e.g., +91 98765 43210"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="year">Year</Label>
                                <Select
                                    value={formData.year}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, year: value as StudentYear })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {YEARS.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="department">Department</Label>
                                <Select
                                    value={formData.department}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, department: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS.map((dept) => (
                                            <SelectItem key={dept} value={dept}>
                                                {dept}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">
                                {selectedStudent ? 'Reset Password' : 'Password'}
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                                placeholder={
                                    selectedStudent ? 'Leave blank to keep current' : 'Enter password'
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, status: value as StudentStatus })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsFormOpen(false)}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!formData.name || !formData.email || (!selectedStudent && !formData.password)}
                            className="w-full sm:w-auto"
                        >
                            {selectedStudent ? 'Save Changes' : 'Add Student'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Preview Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-heading">Import Preview</DialogTitle>
                        <DialogDescription>
                            Review the data before importing {importData.length} students
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {importError && (
                            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                {importError}
                            </div>
                        )}
                        <div className="max-h-64 overflow-y-auto border rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Name</th>
                                        <th className="px-3 py-2 text-left">Email</th>
                                        <th className="px-3 py-2 text-left">Year</th>
                                        <th className="px-3 py-2 text-left">Department</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {importData.slice(0, 10).map((student, index) => (
                                        <tr key={index}>
                                            <td className="px-3 py-2">{student.name}</td>
                                            <td className="px-3 py-2">{student.email}</td>
                                            <td className="px-3 py-2">{student.year}</td>
                                            <td className="px-3 py-2">{student.department}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {importData.length > 10 && (
                                <p className="text-center py-2 text-sm text-muted-foreground">
                                    ... and {importData.length - 10} more
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setImportData([]);
                                setIsImportDialogOpen(false);
                            }}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button onClick={confirmImport} className="w-full sm:w-auto">
                            <Upload className="h-4 w-4 mr-2" />
                            Import {importData.length} Students
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                title="Delete Student"
                description={`Are you sure you want to delete ${selectedStudent?.name}? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AdminLayout>
    );
}
