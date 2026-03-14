import { Octicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

type NavItem = {
    key: string;
    route: string;
    icon: React.ComponentProps<typeof Octicons>["name"];
    label: string;
};

const navItems: NavItem[] = [
    { key: "agents", route: "agents", icon: "device-desktop", label: "Agents" },
    { key: "fragments", route: "fragments", icon: "note", label: "Fragments" },
    { key: "automations", route: "automations", icon: "clock", label: "Automations" },
    { key: "files", route: "files", icon: "file-directory", label: "Files" },
    { key: "vault", route: "vault", icon: "file", label: "Vault" },
    { key: "skills", route: "skills", icon: "zap", label: "Skills" },
    { key: "tools", route: "tools", icon: "tools", label: "Tools" },
    { key: "members", route: "members", icon: "people", label: "Members" },
    { key: "costs", route: "costs", icon: "credit-card", label: "Costs" }
];

const devItems: NavItem[] = [{ key: "dev", route: "dev", icon: "code-square", label: "Dev" }];

/**
 * Home dashboard view. On mobile, shows navigation items
 * that mirror the desktop sidebar for quick access.
 */
export function HomeView() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const { workspaceId } = useWorkspace();

    return (
        <ItemList>
            <ItemGroup>
                {navItems.map((item) => (
                    <Item
                        key={item.key}
                        title={item.label}
                        icon={<Octicons name={item.icon} size={20} color={theme.colors.onSurfaceVariant} />}
                        onPress={() => router.push(`/${workspaceId}/${item.route}` as Href)}
                    />
                ))}
            </ItemGroup>
            <ItemGroup>
                {devItems.map((item) => (
                    <Item
                        key={item.key}
                        title={item.label}
                        icon={<Octicons name={item.icon} size={20} color={theme.colors.onSurfaceVariant} />}
                        onPress={() => router.push(`/${workspaceId}/${item.route}` as Href)}
                    />
                ))}
            </ItemGroup>
        </ItemList>
    );
}
