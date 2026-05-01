import {useRouter} from "next/navigation";
import {use} from "react";

export default function ScheduleSummary({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const {id} = use(params);

}