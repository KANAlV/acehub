"use client";

import React, { useEffect, useState, use } from "react";
import { Button, Spinner } from "flowbite-react";
import { HiExclamation, HiArrowLeft } from "react-icons/hi";
import { useRouter } from "next/navigation";
import { fetchSchedulesList } from "@/services/userService.ts";

export default function ScheduleSummary({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [loading, setLoading] = useState(true);
    const [scheduleExists, setScheduleExists] = useState<boolean | null>(null);

    const checkScheduleExists = async () => {
        setLoading(true);
        try {
            const scheduleList = await fetchSchedulesList();
            const schedule = scheduleList.find((s: any) => s.id === id);
            
            if (schedule) {
                setScheduleExists(true);
            } else {
                setScheduleExists(false);
            }
        } catch (error) {
            console.error("Error checking schedule:", error);
            setScheduleExists(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkScheduleExists();
    }, [id]);

    if (loading) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <Spinner size="xl" />
                </div>
            </div>
        );
    }

    if (scheduleExists === false) {
        return (
            <div className="p-8 h-full w-full overflow-y-auto font-sans">
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                            <HiExclamation className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Schedule Not Found
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            The schedule with ID "{id}" does not exist or may have been deleted.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button 
                                color="alternative" 
                                onClick={() => router.push("/schedules")}
                            >
                                <HiArrowLeft className="mr-2" />
                                Back to Schedules
                            </Button>
                            <Button 
                                color="blue" 
                                onClick={() => window.location.reload()}
                            >
                                Try Again
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 h-full w-full overflow-y-auto font-sans">
            <div className="flex justify-between items-center">
                <Button color="gray" size="sm" onClick={() => router.push(`/schedules/${id}`)}>
                    <HiArrowLeft />
                </Button>
                <h1 className="text-2xl font-bold">Teacher Analysis - Schedule {id}</h1>
                <div></div>
            </div>
            
            <div className="text-center py-12 text-gray-400 italic">
                Teacher analysis page is under development.
            </div>
        </div>
    );
}