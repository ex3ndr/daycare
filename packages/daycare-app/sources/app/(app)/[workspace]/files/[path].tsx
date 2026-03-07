import { useLocalSearchParams } from "expo-router";
import { filesPathDecode } from "@/modules/files/filesPathEncode";
import { FilesView } from "@/views/files/FilesView";

export default function FilesPathRoute() {
    const { path } = useLocalSearchParams<{ path: string }>();
    if (!path) return null;
    return <FilesView dirPath={filesPathDecode(path)} />;
}
