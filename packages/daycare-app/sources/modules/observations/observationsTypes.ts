export type ObservationItem = {
    id: string;
    type: string;
    source: string;
    message: string;
    details: string | null;
    createdAt: number;
};
