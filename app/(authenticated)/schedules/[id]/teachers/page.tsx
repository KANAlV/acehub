import {use} from "react";

export default function ScheduleSummary({ params }: { params: Promise<{ id: string }> }) {
    const {id} = use(params);

}