import { Octicons } from "@expo/vector-icons";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

function Checkbox({ checked }: { checked: boolean }) {
    const { theme } = useUnistyles();
    return (
        <View
            style={[
                checkboxStyles.box,
                {
                    borderColor: checked ? theme.colors.primary : theme.colors.outline,
                    backgroundColor: checked ? theme.colors.primary : "transparent"
                }
            ]}
        >
            {checked && <Octicons name="check" size={12} color={theme.colors.surface} />}
        </View>
    );
}

const checkboxStyles = StyleSheet.create({
    box: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    }
});

export function TodosView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Today">
                <Item
                    title="Review agent heartbeat PR"
                    subtitle="Assigned by Jordan · High priority"
                    leftElement={<Checkbox checked={false} />}
                    detail="Due today"
                    showChevron={false}
                />
                <Item
                    title="Approve February cost report"
                    subtitle="Finance review needed"
                    leftElement={<Checkbox checked={false} />}
                    detail="Due today"
                    showChevron={false}
                />
                <Item
                    title="Fix Operator agent error logs"
                    subtitle="Failing since 2h ago"
                    leftElement={<Checkbox checked={false} />}
                    detail="Due today"
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="This Week">
                <Item
                    title="Write onboarding docs for new plugins"
                    subtitle="Docs · Medium priority"
                    leftElement={<Checkbox checked={false} />}
                    detail="Thu"
                    showChevron={false}
                />
                <Item
                    title="Set up staging environment for v3"
                    subtitle="Infrastructure · Low priority"
                    leftElement={<Checkbox checked={false} />}
                    detail="Fri"
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Completed">
                <Item
                    title="Deploy Builder agent v2.4.1"
                    subtitle="Completed yesterday"
                    leftElement={<Checkbox checked={true} />}
                    showChevron={false}
                />
                <Item
                    title="Update cron schedule for email digest"
                    subtitle="Completed Feb 26"
                    leftElement={<Checkbox checked={true} />}
                    showChevron={false}
                />
                <Item
                    title="Add cost tracking for S3 storage"
                    subtitle="Completed Feb 25"
                    leftElement={<Checkbox checked={true} />}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}
